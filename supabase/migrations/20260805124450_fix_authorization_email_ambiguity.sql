create or replace function private.authorize_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role text default 'editor'
)
returns table(email text, role text, status text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(p_email));
  existing_user uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.has_workspace_role(p_workspace_id, array['admin']) then raise exception 'admin_permission_required'; end if;
  if normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'invalid_role'; end if;

  select u.id into existing_user
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  insert into public.workspace_authorizations (
    workspace_id, email, role, authorized_by, activated_at, revoked_at, created_at, updated_at
  )
  values (
    p_workspace_id,
    normalized_email,
    p_role,
    auth.uid(),
    case when existing_user is null then null else now() end,
    null,
    now(),
    now()
  )
  on conflict on constraint workspace_authorizations_workspace_id_email_key do update
    set role = excluded.role,
        authorized_by = excluded.authorized_by,
        activated_at = case
          when existing_user is null then public.workspace_authorizations.activated_at
          else coalesce(public.workspace_authorizations.activated_at, now())
        end,
        revoked_at = null,
        updated_at = now();

  if existing_user is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace_id, existing_user, p_role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  end if;

  return query
    select normalized_email, p_role, case when existing_user is null then 'authorized' else 'active' end;
end;
$$;

revoke execute on function private.authorize_workspace_member(uuid, text, text) from public, anon;
grant execute on function private.authorize_workspace_member(uuid, text, text) to authenticated;
