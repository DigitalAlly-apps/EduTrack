-- EduTrack: hardening tabel sinkronisasi per akun
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor, pada project EduTrack.
-- Tabel yang dipakai aplikasi: public.app_sync (id = auth.users.id).

begin;

revoke all on table public.app_sync from anon;
grant select, insert, update, delete on table public.app_sync to authenticated;

alter table public.app_sync enable row level security;

drop policy if exists "Users can manage their own app sync" on public.app_sync;
drop policy if exists "app_sync_select_own" on public.app_sync;
drop policy if exists "app_sync_insert_own" on public.app_sync;
drop policy if exists "app_sync_update_own" on public.app_sync;
drop policy if exists "app_sync_delete_own" on public.app_sync;

create policy "app_sync_select_own" on public.app_sync
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "app_sync_insert_own" on public.app_sync
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "app_sync_update_own" on public.app_sync
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "app_sync_delete_own" on public.app_sync
  for delete to authenticated
  using ((select auth.uid()) = id);

-- Dibutuhkan agar pembaruan dari perangkat lain tetap masuk Realtime.
do $$
begin
  alter publication supabase_realtime add table public.app_sync;
exception
  when duplicate_object then null;
end;
$$;

commit;
