create table public.workspace_protected_module_grants (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (
    module_key in (
      'roadmap',
      'master_data',
      'system_config',
      'permission_governance',
      'audit'
    )
  ),
  access_level text not null check (access_level in ('view', 'edit', 'manage')),
  reason text not null check (length(trim(reason)) >= 4),
  expires_at timestamptz,
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, module_key)
);

create index workspace_protected_module_grants_user_idx
  on public.workspace_protected_module_grants (user_id, workspace_id);

create index workspace_protected_module_grants_granted_by_idx
  on public.workspace_protected_module_grants (granted_by);

create index workspace_protected_module_grants_active_idx
  on public.workspace_protected_module_grants (workspace_id, module_key, expires_at);

comment on table public.workspace_protected_module_grants is
  'Explicit access grants for protected modules. Role templates, including Super Admin, never imply access.';

alter table public.workspace_protected_module_grants enable row level security;

revoke all privileges on table public.workspace_protected_module_grants
from public, anon, authenticated;
grant select on table public.workspace_protected_module_grants to authenticated;

create policy protected_module_grants_read_own_or_owner
on public.workspace_protected_module_grants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.workspace_platform_roles owner_role
    where owner_role.workspace_id = workspace_protected_module_grants.workspace_id
      and owner_role.user_id = (select auth.uid())
      and owner_role.role = 'platform_owner'
  )
);

create or replace function private.resolve_workspace_protected_module_permission(
  p_workspace_id uuid,
  p_module_key text,
  p_user_id uuid default auth.uid()
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  resolved_level text;
begin
  if p_user_id is null then return 'none'; end if;
  if p_module_key not in (
    'roadmap',
    'master_data',
    'system_config',
    'permission_governance',
    'audit'
  ) then
    return 'none';
  end if;

  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = p_workspace_id
      and member.user_id = p_user_id
  ) then
    return 'none';
  end if;

  if exists (
    select 1
    from public.workspace_platform_roles owner_role
    where owner_role.workspace_id = p_workspace_id
      and owner_role.user_id = p_user_id
      and owner_role.role = 'platform_owner'
  ) then
    return 'manage';
  end if;

  select grant_row.access_level
  into resolved_level
  from public.workspace_protected_module_grants grant_row
  where grant_row.workspace_id = p_workspace_id
    and grant_row.user_id = p_user_id
    and grant_row.module_key = p_module_key
    and (grant_row.expires_at is null or grant_row.expires_at > now());

  return coalesce(resolved_level, 'none');
end;
$$;

-- Preserve explicit Roadmap choices from the access document without carrying
-- forward any access that existed only because of a broad role.
insert into public.workspace_protected_module_grants (
  workspace_id,
  user_id,
  module_key,
  access_level,
  reason,
  granted_by,
  created_at,
  updated_at
)
select
  document.workspace_id,
  auth_user.id,
  'roadmap',
  access_member #>> '{modulePermissions,roadmap}',
  'Migrated from explicit Roadmap access',
  owner_role.user_id,
  now(),
  now()
from public.workspace_documents document
cross join lateral jsonb_array_elements(document.payload) access_member
join auth.users auth_user
  on lower(auth_user.email) = lower(access_member ->> 'email')
join public.workspace_members member
  on member.workspace_id = document.workspace_id
 and member.user_id = auth_user.id
join public.workspace_platform_roles owner_role
  on owner_role.workspace_id = document.workspace_id
 and owner_role.role = 'platform_owner'
where document.document_key = 'projectTrackingAccess.v1'
  and jsonb_typeof(document.payload) = 'array'
  and coalesce(access_member ->> 'status', 'active') = 'active'
  and access_member #>> '{modulePermissions,roadmap}' in ('view', 'edit', 'manage')
  and auth_user.id <> owner_role.user_id
on conflict (workspace_id, user_id, module_key) do nothing;

create or replace function private.workspace_roadmap_permission(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.resolve_workspace_protected_module_permission(
    p_workspace_id,
    'roadmap',
    p_user_id
  );
$$;

create or replace function private.list_workspace_protected_module_permissions(
  p_workspace_id uuid
)
returns table (
  user_id uuid,
  email text,
  platform_role text,
  module_key text,
  access_level text,
  is_explicit boolean,
  reason text,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.is_platform_owner(p_workspace_id) then
    raise exception 'platform_owner_permission_required';
  end if;

  return query
  select
    member.user_id,
    lower(coalesce(auth_user.email, profile.email, '')),
    coalesce(governance_role.role, 'member'),
    module.module_key,
    private.resolve_workspace_protected_module_permission(
      p_workspace_id,
      module.module_key,
      member.user_id
    ),
    grant_row.user_id is not null,
    grant_row.reason,
    grant_row.expires_at,
    grant_row.updated_at
  from public.workspace_members member
  join auth.users auth_user on auth_user.id = member.user_id
  left join public.profiles profile on profile.id = member.user_id
  left join public.workspace_platform_roles governance_role
    on governance_role.workspace_id = member.workspace_id
   and governance_role.user_id = member.user_id
  cross join (
    values
      ('roadmap'::text),
      ('master_data'::text),
      ('system_config'::text),
      ('permission_governance'::text),
      ('audit'::text)
  ) module(module_key)
  left join public.workspace_protected_module_grants grant_row
    on grant_row.workspace_id = member.workspace_id
   and grant_row.user_id = member.user_id
   and grant_row.module_key = module.module_key
  where member.workspace_id = p_workspace_id
  order by lower(coalesce(auth_user.email, profile.email, '')), module.module_key;
end;
$$;

create or replace function public.list_workspace_protected_module_permissions(
  p_workspace_id uuid
)
returns table (
  user_id uuid,
  email text,
  platform_role text,
  module_key text,
  access_level text,
  is_explicit boolean,
  reason text,
  expires_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog
as $$
  select *
  from private.list_workspace_protected_module_permissions(p_workspace_id);
$$;

create or replace function public.get_my_protected_module_permissions(
  p_workspace_id uuid
)
returns table (
  module_key text,
  access_level text,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    module.module_key,
    private.resolve_workspace_protected_module_permission(
      p_workspace_id,
      module.module_key,
      auth.uid()
    ),
    grant_row.expires_at
  from (
    values
      ('roadmap'::text),
      ('master_data'::text),
      ('system_config'::text),
      ('permission_governance'::text),
      ('audit'::text)
  ) module(module_key)
  left join public.workspace_protected_module_grants grant_row
    on grant_row.workspace_id = p_workspace_id
   and grant_row.user_id = auth.uid()
   and grant_row.module_key = module.module_key;
$$;

create or replace function private.set_workspace_protected_module_permission(
  p_workspace_id uuid,
  p_email text,
  p_module_key text,
  p_access_level text,
  p_reason text,
  p_expires_at timestamptz default null
)
returns table (
  email text,
  module_key text,
  access_level text,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_reason text := trim(coalesce(p_reason, ''));
  target_user_id uuid;
  prior_level text;
  saved_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.is_platform_owner(p_workspace_id) then
    raise exception 'platform_owner_permission_required';
  end if;
  if p_module_key not in (
    'roadmap',
    'master_data',
    'system_config',
    'permission_governance',
    'audit'
  ) then
    raise exception 'invalid_protected_module';
  end if;
  if p_access_level not in ('none', 'view', 'edit', 'manage') then
    raise exception 'invalid_protected_module_access';
  end if;
  if p_module_key in ('master_data', 'system_config')
     and p_access_level not in ('none', 'manage') then
    raise exception 'invalid_protected_module_access';
  end if;
  if p_module_key in ('permission_governance', 'audit')
     and p_access_level not in ('none', 'view') then
    raise exception 'invalid_protected_module_access';
  end if;
  if length(normalized_reason) < 4 then
    raise exception 'protected_module_reason_required';
  end if;
  if p_expires_at is not null and p_expires_at <= saved_at then
    raise exception 'protected_module_expiry_must_be_future';
  end if;

  select auth_user.id
  into target_user_id
  from auth.users auth_user
  join public.workspace_members member
    on member.workspace_id = p_workspace_id
   and member.user_id = auth_user.id
  where lower(auth_user.email) = normalized_email
  limit 1;

  if target_user_id is null then raise exception 'workspace_member_not_found'; end if;
  if private.is_platform_owner(p_workspace_id, target_user_id) then
    raise exception 'platform_owner_protected_access_is_fixed';
  end if;

  prior_level := private.resolve_workspace_protected_module_permission(
    p_workspace_id,
    p_module_key,
    target_user_id
  );

  if p_access_level = 'none' then
    delete from public.workspace_protected_module_grants grant_row
    where grant_row.workspace_id = p_workspace_id
      and grant_row.user_id = target_user_id
      and grant_row.module_key = p_module_key;
  else
    insert into public.workspace_protected_module_grants (
      workspace_id,
      user_id,
      module_key,
      access_level,
      reason,
      expires_at,
      granted_by,
      created_at,
      updated_at
    ) values (
      p_workspace_id,
      target_user_id,
      p_module_key,
      p_access_level,
      normalized_reason,
      p_expires_at,
      auth.uid(),
      saved_at,
      saved_at
    )
    on conflict (workspace_id, user_id, module_key) do update
    set access_level = excluded.access_level,
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        granted_by = auth.uid(),
        updated_at = saved_at;
  end if;

  insert into public.workspace_events (
    workspace_id,
    actor_id,
    action,
    document_key,
    metadata,
    created_at
  ) values (
    p_workspace_id,
    auth.uid(),
    case
      when p_access_level = 'none' then 'governance.protected_module_revoked'
      else 'governance.protected_module_granted'
    end,
    'protectedModulePermissions.v1',
    jsonb_build_object(
      'target_email', normalized_email,
      'module_key', p_module_key,
      'previous_access', prior_level,
      'new_access', p_access_level,
      'reason', normalized_reason,
      'expires_at', p_expires_at
    ),
    saved_at
  );

  return query
  select
    normalized_email,
    p_module_key,
    p_access_level,
    p_expires_at,
    saved_at;
end;
$$;

create or replace function public.set_workspace_protected_module_permission(
  p_workspace_id uuid,
  p_email text,
  p_module_key text,
  p_access_level text,
  p_reason text,
  p_expires_at timestamptz default null
)
returns table (
  email text,
  module_key text,
  access_level text,
  expires_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog
as $$
  select *
  from private.set_workspace_protected_module_permission(
    p_workspace_id,
    p_email,
    p_module_key,
    p_access_level,
    p_reason,
    p_expires_at
  );
$$;

revoke execute on function private.resolve_workspace_protected_module_permission(uuid, text, uuid)
from public, anon;
grant execute on function private.resolve_workspace_protected_module_permission(uuid, text, uuid)
to authenticated;

revoke execute on function private.list_workspace_protected_module_permissions(uuid)
from public, anon;
grant execute on function private.list_workspace_protected_module_permissions(uuid)
to authenticated;

revoke execute on function private.set_workspace_protected_module_permission(uuid, text, text, text, text, timestamptz)
from public, anon;
grant execute on function private.set_workspace_protected_module_permission(uuid, text, text, text, text, timestamptz)
to authenticated;

revoke execute on function public.list_workspace_protected_module_permissions(uuid)
from public, anon;
grant execute on function public.list_workspace_protected_module_permissions(uuid)
to authenticated;

revoke execute on function public.get_my_protected_module_permissions(uuid)
from public, anon;
grant execute on function public.get_my_protected_module_permissions(uuid)
to authenticated;

revoke execute on function public.set_workspace_protected_module_permission(uuid, text, text, text, text, timestamptz)
from public, anon;
grant execute on function public.set_workspace_protected_module_permission(uuid, text, text, text, text, timestamptz)
to authenticated;

revoke execute on function private.workspace_roadmap_permission(uuid, uuid)
from public, anon, authenticated;

comment on function private.resolve_workspace_protected_module_permission(uuid, text, uuid) is
  'Resolves protected module access. Platform Owner is fixed at manage; every other account requires an unexpired explicit grant.';
comment on function public.set_workspace_protected_module_permission(uuid, text, text, text, text, timestamptz) is
  'Platform Owner-only mutation for protected module access with mandatory reason and immutable workspace audit event.';

notify pgrst, 'reload schema';
