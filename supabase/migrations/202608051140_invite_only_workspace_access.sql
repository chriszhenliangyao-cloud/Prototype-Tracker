create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index workspace_invitations_email_idx on public.workspace_invitations(lower(email));
create index workspace_invitations_invited_by_idx on public.workspace_invitations(invited_by);
alter table public.workspace_invitations enable row level security;

create or replace function private.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

create policy invitations_read_admin on public.workspace_invitations for select
using (private.has_workspace_role(workspace_id, array['admin']));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  select i.* into invitation
  from public.workspace_invitations i
  where lower(i.email) = lower(coalesce(new.email, ''))
    and i.accepted_at is null
  order by i.created_at
  limit 1;

  if found then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (invitation.workspace_id, new.id, invitation.role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
    update public.workspace_invitations set accepted_at = now() where id = invitation.id;
  end if;
  return new;
end;
$$;

create or replace function public.invite_workspace_member(
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
  existing_user uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.has_workspace_role(p_workspace_id, array['admin']) then raise exception 'admin_permission_required'; end if;
  if p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'invalid_role'; end if;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
  values (p_workspace_id, lower(trim(p_email)), p_role, auth.uid())
  on conflict (workspace_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by, accepted_at = null, created_at = now();

  select id into existing_user from auth.users where lower(auth.users.email) = lower(trim(p_email)) limit 1;
  if existing_user is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace_id, existing_user, p_role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
    update public.workspace_invitations
    set accepted_at = now()
    where workspace_id = p_workspace_id and lower(workspace_invitations.email) = lower(trim(p_email));
  end if;

  return query select lower(trim(p_email)), p_role, case when existing_user is null then 'invited' else 'active' end;
end;
$$;

revoke all on public.workspace_invitations from anon;
grant select on public.workspace_invitations to authenticated;
revoke execute on function private.has_workspace_role(uuid, text[]) from public, anon;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.invite_workspace_member(uuid, text, text) from public, anon;
grant execute on function public.invite_workspace_member(uuid, text, text) to authenticated;
