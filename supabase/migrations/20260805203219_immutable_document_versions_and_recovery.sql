create table if not exists public.workspace_document_versions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_key text not null,
  version bigint not null check (version > 0),
  payload jsonb,
  operation text not null default 'save' check (operation in ('backfill', 'save', 'restore')),
  source_version bigint,
  created_by uuid references auth.users(id) on delete set null,
  client_mutation_id uuid,
  created_at timestamptz not null default now(),
  primary key (workspace_id, document_key, version),
  unique (client_mutation_id)
);

create index if not exists workspace_document_versions_created_at_idx
  on public.workspace_document_versions (workspace_id, created_at desc);
create index if not exists workspace_document_versions_document_idx
  on public.workspace_document_versions (workspace_id, document_key, version desc);
create index if not exists workspace_document_versions_created_by_idx
  on public.workspace_document_versions (created_by);

comment on table public.workspace_document_versions is
  'Append-only full payload history for every synchronized workspace document version.';
comment on column public.workspace_document_versions.source_version is
  'Original version used when operation is restore.';

insert into public.workspace_document_versions (
  workspace_id,
  document_key,
  version,
  payload,
  operation,
  created_by,
  created_at
)
select
  workspace_id,
  document_key,
  version,
  payload,
  'backfill',
  updated_by,
  updated_at
from public.workspace_documents
on conflict (workspace_id, document_key, version) do nothing;

alter table public.workspace_document_versions enable row level security;

revoke all privileges on table public.workspace_document_versions from anon;
revoke all privileges on table public.workspace_document_versions from authenticated;
grant select on table public.workspace_document_versions to authenticated;

drop policy if exists document_versions_read_workspace on public.workspace_document_versions;
create policy document_versions_read_workspace
on public.workspace_document_versions
for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

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
  saved_at timestamptz := now();
  existing_version bigint;
  existing_saved_at timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_document_key is null or length(trim(p_document_key)) = 0 then raise exception 'invalid_document_key'; end if;
  if not private.has_workspace_role(p_workspace_id, array['admin', 'editor']) then
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

  select d.version
  into current_version
  from public.workspace_documents d
  where d.workspace_id = p_workspace_id
    and d.document_key = p_document_key
  for update;

  if not found then
    if coalesce(p_base_version, 0) <> 0 then raise exception 'version_conflict'; end if;
    current_version := 1;
    insert into public.workspace_documents (
      workspace_id,
      document_key,
      payload,
      version,
      updated_by,
      updated_at
    ) values (
      p_workspace_id,
      p_document_key,
      p_payload,
      current_version,
      auth.uid(),
      saved_at
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
    workspace_id,
    document_key,
    version,
    payload,
    operation,
    created_by,
    client_mutation_id,
    created_at
  ) values (
    p_workspace_id,
    p_document_key,
    current_version,
    p_payload,
    'save',
    auth.uid(),
    p_client_mutation_id,
    saved_at
  );

  insert into public.workspace_events (
    workspace_id,
    actor_id,
    action,
    document_key,
    document_version,
    client_mutation_id,
    metadata,
    created_at
  ) values (
    p_workspace_id,
    auth.uid(),
    'document.saved',
    p_document_key,
    current_version,
    p_client_mutation_id,
    jsonb_build_object('backup_created', true),
    saved_at
  );

  return query select current_version, saved_at;
end;
$$;

create or replace function public.save_workspace_document(
  p_workspace_id uuid,
  p_document_key text,
  p_payload jsonb,
  p_base_version bigint,
  p_client_mutation_id uuid
)
returns table(version bigint, updated_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select *
  from private.save_workspace_document(
    p_workspace_id,
    p_document_key,
    p_payload,
    p_base_version,
    p_client_mutation_id
  );
$$;

create or replace function private.restore_workspace_document_version(
  p_workspace_id uuid,
  p_document_key text,
  p_source_version bigint,
  p_client_mutation_id uuid
)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_payload jsonb;
  current_version bigint;
  restored_at timestamptz := now();
  existing_version bigint;
  existing_saved_at timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.has_workspace_role(p_workspace_id, array['admin']) then
    raise exception 'admin_permission_required';
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

  select v.payload
  into source_payload
  from public.workspace_document_versions v
  where v.workspace_id = p_workspace_id
    and v.document_key = p_document_key
    and v.version = p_source_version;

  if not found then raise exception 'backup_version_not_found'; end if;

  select d.version
  into current_version
  from public.workspace_documents d
  where d.workspace_id = p_workspace_id
    and d.document_key = p_document_key
  for update;

  if not found then raise exception 'document_not_found'; end if;

  current_version := current_version + 1;
  update public.workspace_documents
  set payload = source_payload,
      version = current_version,
      updated_by = auth.uid(),
      updated_at = restored_at
  where workspace_id = p_workspace_id
    and document_key = p_document_key;

  insert into public.workspace_document_versions (
    workspace_id,
    document_key,
    version,
    payload,
    operation,
    source_version,
    created_by,
    client_mutation_id,
    created_at
  ) values (
    p_workspace_id,
    p_document_key,
    current_version,
    source_payload,
    'restore',
    p_source_version,
    auth.uid(),
    p_client_mutation_id,
    restored_at
  );

  insert into public.workspace_events (
    workspace_id,
    actor_id,
    action,
    document_key,
    document_version,
    client_mutation_id,
    metadata,
    created_at
  ) values (
    p_workspace_id,
    auth.uid(),
    'document.restored',
    p_document_key,
    current_version,
    p_client_mutation_id,
    jsonb_build_object('source_version', p_source_version, 'backup_created', true),
    restored_at
  );

  return query select current_version, restored_at;
end;
$$;

create or replace function public.restore_workspace_document_version(
  p_workspace_id uuid,
  p_document_key text,
  p_source_version bigint,
  p_client_mutation_id uuid default gen_random_uuid()
)
returns table(version bigint, updated_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select *
  from private.restore_workspace_document_version(
    p_workspace_id,
    p_document_key,
    p_source_version,
    p_client_mutation_id
  );
$$;

revoke execute on function private.save_workspace_document(uuid, text, jsonb, bigint, uuid) from public, anon;
grant execute on function private.save_workspace_document(uuid, text, jsonb, bigint, uuid) to authenticated;
revoke execute on function public.save_workspace_document(uuid, text, jsonb, bigint, uuid) from public, anon;
grant execute on function public.save_workspace_document(uuid, text, jsonb, bigint, uuid) to authenticated;

revoke execute on function private.restore_workspace_document_version(uuid, text, bigint, uuid) from public, anon;
grant execute on function private.restore_workspace_document_version(uuid, text, bigint, uuid) to authenticated;
revoke execute on function public.restore_workspace_document_version(uuid, text, bigint, uuid) from public, anon;
grant execute on function public.restore_workspace_document_version(uuid, text, bigint, uuid) to authenticated;

notify pgrst, 'reload schema';
