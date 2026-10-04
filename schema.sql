-- Схема бази для трекера. Виконати один раз у Supabase → SQL Editor → New query.
-- Зберігає весь стан трекера (тренування, заміри, профіль) одним JSON-документом на користувача.

create table if not exists public.tracker_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: кожен бачить і змінює тільки свій рядок.
-- Без цього будь-хто з публічним ключем міг би читати чужі дані.
alter table public.tracker_state enable row level security;

drop policy if exists "власні дані: читання" on public.tracker_state;
create policy "власні дані: читання"
  on public.tracker_state for select
  using (auth.uid() = user_id);

drop policy if exists "власні дані: створення" on public.tracker_state;
create policy "власні дані: створення"
  on public.tracker_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "власні дані: оновлення" on public.tracker_state;
create policy "власні дані: оновлення"
  on public.tracker_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "власні дані: видалення" on public.tracker_state;
create policy "власні дані: видалення"
  on public.tracker_state for delete
  using (auth.uid() = user_id);
