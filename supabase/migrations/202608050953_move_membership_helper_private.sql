create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_workspace_member(p_workspace_id uuid)
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

drop policy if exists workspaces_read_member on public.workspaces;
drop policy if exists members_read_workspace on public.workspace_members;
drop policy if exists documents_read_workspace on public.workspace_documents;
drop policy if exists events_read_workspace on public.workspace_events;

create policy workspaces_read_member on public.workspaces for select using (private.is_workspace_member(id));
create policy members_read_workspace on public.workspace_members for select using (private.is_workspace_member(workspace_id));
create policy documents_read_workspace on public.workspace_documents for select using (private.is_workspace_member(workspace_id));
create policy events_read_workspace on public.workspace_events for select using (private.is_workspace_member(workspace_id));

revoke execute on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
drop function if exists public.is_workspace_member(uuid);
