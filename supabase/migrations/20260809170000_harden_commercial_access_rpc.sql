create or replace function private.get_commercial_planning_access()
returns table(
  email text,
  display_name text,
  platform_role text,
  app_role text
)
language sql
stable
security definer
set search_path = public, commercial_planning, auth, pg_temp
as $$
  select
    p.email,
    p.display_name,
    wm.role,
    coalesce(
      aur."role"::text,
      case wm.role
        when 'admin' then 'ADMIN'
        when 'editor' then 'SALES_MANAGER'
        else 'VIEWER'
      end
    )
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  join public.profiles p on p.id = wm.user_id
  left join commercial_planning.app_user_roles aur on aur."userId" = wm.user_id
  where wm.user_id = auth.uid()
    and w.slug = 'operations-planning'
  limit 1;
$$;

create or replace function public.get_commercial_planning_access()
returns table(
  email text,
  display_name text,
  platform_role text,
  app_role text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select * from private.get_commercial_planning_access();
$$;

revoke all on function private.get_commercial_planning_access()
  from public, anon;
grant execute on function private.get_commercial_planning_access()
  to authenticated;

revoke all on function public.get_commercial_planning_access()
  from public, anon;
grant execute on function public.get_commercial_planning_access()
  to authenticated;

comment on function public.get_commercial_planning_access() is
  'Security-invoker API wrapper for the signed-in user commercial-planning access lookup.';

notify pgrst, 'reload schema';
