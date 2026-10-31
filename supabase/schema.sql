-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists public.dtr_kv (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.dtr_kv enable row level security;

-- The app logs users in itself (no Supabase Auth), so the public anon key
-- needs read/write access to this one table.
drop policy if exists "dtr anon all" on public.dtr_kv;
create policy "dtr anon all" on public.dtr_kv
  for all to anon
  using (true) with check (true);

-- Live updates between devices
alter publication supabase_realtime add table public.dtr_kv;
