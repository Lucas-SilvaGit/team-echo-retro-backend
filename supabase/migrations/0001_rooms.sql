create table if not exists public.retro_rooms (
  id text primary key,
  state jsonb not null,
  created_at timestamptz not null default now()
);
