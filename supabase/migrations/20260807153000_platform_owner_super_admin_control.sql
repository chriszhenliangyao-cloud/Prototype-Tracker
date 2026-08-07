create or replace function private.guard_workspace_admin_account_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace_id uuid;
  target_user_id uuid;
  target_email text;
  target_governance_role text;
  existing_role text;
  requested_role text;
begin
  target_workspace_id := old.workspace_id;

  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_account_cannot_move';
  end if;

  if tg_table_name = 'workspace_authorizations' then
    target_email := lower(old.email);
    existing_role := old.role;
    requested_role := case when tg_op = 'UPDATE' then new.role else null end;
    select u.id
    into target_user_id
    from auth.users u
    where lower(u.email) = target_email
    limit 1;
  else
    target_user_id := old.user_id;
    existing_role := old.role;
    requested_role := case when tg_op = 'UPDATE' then new.role else null end;
    select lower(u.email)
    into target_email
    from auth.users u
    where u.id = target_user_id;
  end if;

  select r.role
  into target_governance_role
  from public.workspace_platform_roles r
  where r.workspace_id = target_workspace_id
    and (
      (target_user_id is not null and r.user_id = target_user_id)
      or (target_email is not null and lower(r.email) = target_email)
    )
  limit 1;

  if target_governance_role = 'platform_owner' then
    raise exception 'platform_owner_cannot_be_modified';
  end if;

  if (
       target_governance_role = 'super_admin'
       or existing_role = 'admin'
       or requested_role = 'admin'
     )
     and not private.is_platform_owner(target_workspace_id) then
    raise exception 'protected_account_change_requires_owner';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_workspace_authorization_admins
on public.workspace_authorizations;
create trigger protect_workspace_authorization_admins
before update or delete on public.workspace_authorizations
for each row execute function private.guard_workspace_admin_account_mutation();

drop trigger if exists protect_workspace_member_admins
on public.workspace_members;
create trigger protect_workspace_member_admins
before update or delete on public.workspace_members
for each row execute function private.guard_workspace_admin_account_mutation();

create or replace function private.set_workspace_super_admin(
  p_workspace_id uuid,
  p_email text,
  p_enabled boolean
)
returns table(email text, role text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  target_user_id uuid;
  target_governance_role text;
  target_authorization public.workspace_authorizations%rowtype;
  saved_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.is_platform_owner(p_workspace_id) then
    raise exception 'platform_owner_permission_required';
  end if;
  if normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;

  select a.*
  into target_authorization
  from public.workspace_authorizations a
  where a.workspace_id = p_workspace_id
    and lower(a.email) = normalized_email
    and a.revoked_at is null
  for update;

  if not found then raise exception 'workspace_authorization_required'; end if;

  select u.id
  into target_user_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'workspace_member_activation_required';
  end if;

  select r.role
  into target_governance_role
  from public.workspace_platform_roles r
  where r.workspace_id = p_workspace_id
    and r.user_id = target_user_id
  for update;

  if target_governance_role = 'platform_owner' then
    raise exception 'platform_owner_cannot_be_demoted';
  end if;

  update public.workspace_authorizations
  set role = case when p_enabled then 'admin' else 'editor' end,
      authorized_by = auth.uid(),
      activated_at = coalesce(activated_at, saved_at),
      updated_at = saved_at
  where id = target_authorization.id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (
    p_workspace_id,
    target_user_id,
    case when p_enabled then 'admin' else 'editor' end
  )
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  if p_enabled then
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
      normalized_email,
      'super_admin',
      auth.uid(),
      saved_at,
      saved_at
    )
    on conflict (workspace_id, user_id) do update
    set email = excluded.email,
        role = 'super_admin',
        assigned_by = auth.uid(),
        updated_at = saved_at;
  else
    delete from public.workspace_platform_roles
    where workspace_id = p_workspace_id
      and user_id = target_user_id
      and role = 'super_admin';
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
      when p_enabled then 'governance.super_admin_granted'
      else 'governance.super_admin_revoked'
    end,
    'projectTrackingAccess.v1',
    jsonb_build_object(
      'target_email', normalized_email,
      'workspace_role', case when p_enabled then 'admin' else 'editor' end
    ),
    saved_at
  );

  return query
  select normalized_email,
         case when p_enabled then 'admin' else 'editor' end,
         'active'::text;
end;
$$;

create or replace function public.set_workspace_super_admin(
  p_workspace_id uuid,
  p_email text,
  p_enabled boolean
)
returns table(email text, role text, status text)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select *
  from private.set_workspace_super_admin(p_workspace_id, p_email, p_enabled);
$$;

revoke execute on function private.guard_workspace_admin_account_mutation()
from public, anon, authenticated;
revoke execute on function private.set_workspace_super_admin(uuid, text, boolean)
from public, anon;
grant execute on function private.set_workspace_super_admin(uuid, text, boolean)
to authenticated;

revoke execute on function public.set_workspace_super_admin(uuid, text, boolean)
from public, anon;
grant execute on function public.set_workspace_super_admin(uuid, text, boolean)
to authenticated;

notify pgrst, 'reload schema';
