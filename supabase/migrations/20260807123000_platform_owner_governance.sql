create table if not exists public.workspace_platform_roles (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('platform_owner', 'super_admin')),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create unique index if not exists workspace_platform_roles_owner_idx
  on public.workspace_platform_roles (workspace_id)
  where role = 'platform_owner';

create unique index if not exists workspace_platform_roles_email_idx
  on public.workspace_platform_roles (workspace_id, lower(email));

create index if not exists workspace_platform_roles_user_idx
  on public.workspace_platform_roles (user_id);

comment on table public.workspace_platform_roles is
  'Protected workspace governance roles. Exactly one platform owner may hold final access-control authority.';

alter table public.workspace_platform_roles enable row level security;

revoke all privileges on table public.workspace_platform_roles from anon;
revoke all privileges on table public.workspace_platform_roles from authenticated;
grant select on table public.workspace_platform_roles to authenticated;

drop policy if exists platform_roles_read_workspace on public.workspace_platform_roles;
create policy platform_roles_read_workspace
on public.workspace_platform_roles
for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create or replace function private.is_platform_owner(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_platform_roles r
    where r.workspace_id = p_workspace_id
      and r.user_id = p_user_id
      and r.role = 'platform_owner'
  );
$$;

create or replace function private.transfer_workspace_ownership(
  p_workspace_id uuid,
  p_new_owner_email text
)
returns table(previous_owner_email text, new_owner_email text, changed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(p_new_owner_email, '')));
  target_user_id uuid;
  target_email text;
  prior_owner_email text;
  saved_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.is_platform_owner(p_workspace_id) then
    raise exception 'platform_owner_permission_required';
  end if;
  if normalized_email = '' or position('@' in normalized_email) <= 1 then
    raise exception 'invalid_email';
  end if;

  select u.id, lower(u.email)
  into target_user_id, target_email
  from auth.users u
  join public.workspace_members m
    on m.workspace_id = p_workspace_id
   and m.user_id = u.id
  where lower(u.email) = normalized_email
  limit 1;

  if target_user_id is null then raise exception 'platform_owner_not_found'; end if;

  select r.email
  into prior_owner_email
  from public.workspace_platform_roles r
  where r.workspace_id = p_workspace_id
    and r.role = 'platform_owner'
  for update;

  update public.workspace_platform_roles
  set role = 'super_admin',
      assigned_by = auth.uid(),
      updated_at = saved_at
  where workspace_id = p_workspace_id
    and role = 'platform_owner'
    and user_id <> target_user_id;

  insert into public.workspace_platform_roles (
    workspace_id,
    user_id,
    email,
    role,
    assigned_by,
    created_at,
    updated_at
  ) values (
    p_workspace_id,
    target_user_id,
    target_email,
    'platform_owner',
    auth.uid(),
    saved_at,
    saved_at
  )
  on conflict (workspace_id, user_id) do update
  set email = excluded.email,
      role = 'platform_owner',
      assigned_by = auth.uid(),
      updated_at = saved_at;

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
    'governance.owner_transferred',
    'projectTrackingAccess.v1',
    jsonb_build_object(
      'previous_owner_email', prior_owner_email,
      'new_owner_email', target_email
    ),
    saved_at
  );

  return query select prior_owner_email, target_email, saved_at;
end;
$$;

create or replace function public.transfer_workspace_ownership(
  p_workspace_id uuid,
  p_new_owner_email text
)
returns table(previous_owner_email text, new_owner_email text, changed_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select * from private.transfer_workspace_ownership(p_workspace_id, p_new_owner_email);
$$;

create or replace function private.save_workspace_document(
  p_workspace_id uuid,
  p_document_key text,
  p_payload jsonb,
  p_base_version bigint,
  p_client_mutation_id uuid
)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_version bigint;
  current_payload jsonb;
  saved_at timestamptz := now();
  existing_version bigint;
  existing_saved_at timestamptz;
  protected_before jsonb;
  protected_after jsonb;
  document_exists boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_document_key is null or length(trim(p_document_key)) = 0 then raise exception 'invalid_document_key'; end if;

  if p_document_key = 'projectTrackingAccess.v1' then
    if not private.has_workspace_role(p_workspace_id, array['admin']) then
      raise exception 'admin_permission_required';
    end if;
  elsif not private.has_workspace_role(p_workspace_id, array['admin', 'editor']) then
    raise exception 'write_permission_required';
  end if;

  select e.document_version, e.created_at
  into existing_version, existing_saved_at
  from public.workspace_events e
  where e.client_mutation_id = p_client_mutation_id
    and e.actor_id = auth.uid();

  if found then
    return query select existing_version, existing_saved_at;
    return;
  end if;

  select d.version, d.payload
  into current_version, current_payload
  from public.workspace_documents d
  where d.workspace_id = p_workspace_id
    and d.document_key = p_document_key
  for update;
  document_exists := found;

  if p_document_key = 'projectTrackingAccess.v1'
     and not private.is_platform_owner(p_workspace_id) then
    select coalesce(
      jsonb_agg(member order by coalesce(lower(member ->> 'email'), member ->> 'id')),
      '[]'::jsonb
    )
    into protected_before
    from jsonb_array_elements(coalesce(current_payload, '[]'::jsonb)) member
    where member ->> 'platformRole' in ('platform_owner', 'super_admin');

    select coalesce(
      jsonb_agg(member order by coalesce(lower(member ->> 'email'), member ->> 'id')),
      '[]'::jsonb
    )
    into protected_after
    from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) member
    where member ->> 'platformRole' in ('platform_owner', 'super_admin');

    if protected_before is distinct from protected_after then
      raise exception 'protected_role_change_requires_owner';
    end if;
  end if;

  if not document_exists then
    if coalesce(p_base_version, 0) <> 0 then raise exception 'version_conflict'; end if;
    current_version := 1;
    insert into public.workspace_documents (
      workspace_id, document_key, payload, version, updated_by, updated_at
    ) values (
      p_workspace_id, p_document_key, p_payload, current_version, auth.uid(), saved_at
    );
  else
    if current_version <> coalesce(p_base_version, 0) then raise exception 'version_conflict'; end if;
    current_version := current_version + 1;
    update public.workspace_documents
    set payload = p_payload,
        version = current_version,
        updated_by = auth.uid(),
        updated_at = saved_at
    where workspace_id = p_workspace_id
      and document_key = p_document_key;
  end if;

  insert into public.workspace_document_versions (
    workspace_id, document_key, version, payload, operation,
    created_by, client_mutation_id, created_at
  ) values (
    p_workspace_id, p_document_key, current_version, p_payload, 'save',
    auth.uid(), p_client_mutation_id, saved_at
  );

  insert into public.workspace_events (
    workspace_id, actor_id, action, document_key, document_version,
    client_mutation_id, metadata, created_at
  ) values (
    p_workspace_id, auth.uid(), 'document.saved', p_document_key, current_version,
    p_client_mutation_id,
    jsonb_build_object(
      'backup_created', true,
      'governance_protected', p_document_key = 'projectTrackingAccess.v1'
    ),
    saved_at
  );

  return query select current_version, saved_at;
end;
$$;

revoke execute on function private.is_platform_owner(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.transfer_workspace_ownership(uuid, text) from public, anon, authenticated;
revoke execute on function private.save_workspace_document(uuid, text, jsonb, bigint, uuid) from public, anon;
grant execute on function private.save_workspace_document(uuid, text, jsonb, bigint, uuid) to authenticated;

revoke execute on function public.transfer_workspace_ownership(uuid, text) from public, anon;
grant execute on function public.transfer_workspace_ownership(uuid, text) to authenticated;

notify pgrst, 'reload schema';
