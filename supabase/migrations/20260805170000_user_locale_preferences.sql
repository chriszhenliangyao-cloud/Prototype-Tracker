create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'zh-CN' check (locale in ('zh-CN', 'en-GB')),
  timezone text not null default 'Europe/Madrid',
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

revoke all privileges on table public.user_preferences from anon;
revoke all privileges on table public.user_preferences from authenticated;

drop policy if exists "users read own preferences" on public.user_preferences;
create policy "users read own preferences"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users insert own preferences" on public.user_preferences;
create policy "users insert own preferences"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users update own preferences" on public.user_preferences;
create policy "users update own preferences"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_preferences to authenticated;
