create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_documents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_key text not null,
  payload jsonb,
  version bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, document_key)
);

create table public.workspace_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  document_key text,
  document_version bigint,
  client_mutation_id uuid unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_documents_updated_at_idx on public.workspace_documents(workspace_id, updated_at desc);
create index workspace_events_created_at_idx on public.workspace_events(workspace_id, created_at desc);
create index workspace_members_user_idx on public.workspace_members(user_id);

insert into public.workspaces (slug, name)
values ('operations-planning', '运营计划协同平台')
on conflict (slug) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  member_role text;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  select id into target_workspace from public.workspaces where slug = 'operations-planning';
  select case when exists (select 1 from public.workspace_members where workspace_id = target_workspace) then 'editor' else 'admin' end into member_role;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace, new.id, member_role)
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.save_workspace_document(
  p_workspace_id uuid,
  p_document_key text,
  p_payload jsonb,
  p_base_version bigint,
  p_client_mutation_id uuid
)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version bigint;
  saved_at timestamptz := now();
  existing_version bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role in ('admin', 'editor')
  ) then raise exception 'write_permission_required'; end if;

  select document_version into existing_version
  from public.workspace_events
  where client_mutation_id = p_client_mutation_id and actor_id = auth.uid();
  if found then
    return query select existing_version, saved_at;
    return;
  end if;

  select d.version into current_version
  from public.workspace_documents d
  where d.workspace_id = p_workspace_id and d.document_key = p_document_key
  for update;

  if not found then
    if coalesce(p_base_version, 0) <> 0 then raise exception 'version_conflict'; end if;
    insert into public.workspace_documents (workspace_id, document_key, payload, version, updated_by, updated_at)
    values (p_workspace_id, p_document_key, p_payload, 1, auth.uid(), saved_at);
    current_version := 1;
  else
    if current_version <> coalesce(p_base_version, 0) then raise exception 'version_conflict'; end if;
    current_version := current_version + 1;
    update public.workspace_documents
    set payload = p_payload, version = current_version, updated_by = auth.uid(), updated_at = saved_at
    where workspace_id = p_workspace_id and document_key = p_document_key;
  end if;

  insert into public.workspace_events (workspace_id, actor_id, action, document_key, document_version, client_mutation_id)
  values (p_workspace_id, auth.uid(), 'document.saved', p_document_key, current_version, p_client_mutation_id);
  return query select current_version, saved_at;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_documents enable row level security;
alter table public.workspace_events enable row level security;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create policy profiles_read_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_read_member on public.workspaces for select using (public.is_workspace_member(id));
create policy members_read_workspace on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy documents_read_workspace on public.workspace_documents for select using (public.is_workspace_member(workspace_id));
create policy events_read_workspace on public.workspace_events for select using (public.is_workspace_member(workspace_id));

grant usage on schema public to authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members, public.workspace_documents, public.workspace_events to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.save_workspace_document(uuid, text, jsonb, bigint, uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.save_workspace_document(uuid, text, jsonb, bigint, uuid) from public, anon;

alter publication supabase_realtime add table public.workspace_documents;
