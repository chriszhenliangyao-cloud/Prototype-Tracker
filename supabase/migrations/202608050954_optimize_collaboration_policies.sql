create index if not exists workspace_documents_updated_by_idx on public.workspace_documents(updated_by);
create index if not exists workspace_events_actor_idx on public.workspace_events(actor_id);
create index if not exists workspaces_created_by_idx on public.workspaces(created_by);

drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read_own on public.profiles for select using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
