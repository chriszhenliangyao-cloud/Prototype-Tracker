create or replace function private.workspace_roadmap_permission(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  member_role text;
  member_email text;
  access_payload jsonb;
  access_member jsonb;
  explicit_permission text;
  platform_role text;
  functional_roles jsonb;
begin
  if p_user_id is null then return 'none'; end if;

  select m.role
  into member_role
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id;

  if member_role is null then return 'none'; end if;
  if member_role = 'admin' then return 'manage'; end if;
  if member_role = 'viewer' then return 'view'; end if;

  select lower(coalesce(u.email, ''))
  into member_email
  from auth.users u
  where u.id = p_user_id;

  select d.payload
  into access_payload
  from public.workspace_documents d
  where d.workspace_id = p_workspace_id
    and d.document_key = 'projectTrackingAccess.v1';

  if jsonb_typeof(access_payload) = 'array' then
    select item
    into access_member
    from jsonb_array_elements(access_payload) item
    where lower(coalesce(item ->> 'email', '')) = member_email
    limit 1;
  end if;

  if access_member is null or coalesce(access_member ->> 'status', 'active') <> 'active' then
    return 'none';
  end if;

  explicit_permission := access_member #>> '{modulePermissions,roadmap}';
  if explicit_permission in ('none', 'view', 'edit', 'manage') then
    return explicit_permission;
  end if;

  platform_role := coalesce(access_member ->> 'platformRole', 'member');
  functional_roles := coalesce(access_member -> 'functionalRoles', '[]'::jsonb);

  if platform_role in ('platform_owner', 'super_admin') then return 'manage'; end if;
  if platform_role = 'auditor' then return 'view'; end if;
  if platform_role in ('permission_admin', 'external') then return 'none'; end if;

  if functional_roles ? 'plan_admin' then return 'manage'; end if;
  if functional_roles ?| array['management', 'pmo', 'business_planning', 'marketing_growth'] then return 'edit'; end if;
  if functional_roles ?| array['sales_forecast', 'supply_planner'] then return 'view'; end if;

  return 'none';
end;
$$;

create or replace function private.enforce_workspace_document_module_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  permission text;
begin
  if new.document_key = 'productRoadmap.v1' then
    permission := private.workspace_roadmap_permission(new.workspace_id, auth.uid());
    if permission not in ('edit', 'manage') then
      raise exception 'roadmap_write_permission_required';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_workspace_document_module_permission
on public.workspace_documents;

create trigger enforce_workspace_document_module_permission
before insert or update on public.workspace_documents
for each row
execute function private.enforce_workspace_document_module_permission();

revoke execute on function private.workspace_roadmap_permission(uuid, uuid)
from public, anon, authenticated;
revoke execute on function private.enforce_workspace_document_module_permission()
from public, anon, authenticated;

comment on function private.workspace_roadmap_permission(uuid, uuid) is
  'Resolves independent Product Roadmap access from protected platform governance and the versioned access document.';
comment on function private.enforce_workspace_document_module_permission() is
  'Rejects Product Roadmap document writes unless the authenticated member has edit or manage access.';

notify pgrst, 'reload schema';
