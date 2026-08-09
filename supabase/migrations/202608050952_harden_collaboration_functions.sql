revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.save_workspace_document(uuid, text, jsonb, bigint, uuid) from public, anon;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.save_workspace_document(uuid, text, jsonb, bigint, uuid) to authenticated;
