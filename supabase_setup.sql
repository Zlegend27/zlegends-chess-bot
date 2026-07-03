create table games (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  created_at timestamptz not null default now(),
  engine_version text,
  difficulty_label text,
  style text,
  player_color int,
  moves jsonb,
  pgn text,
  result_text text,
  result_reason text,
  winner int,
  final_eval int
);

create index games_client_id_idx on games (client_id);

alter table games enable row level security;

-- Anonymous per-browser design (no login): anyone holding the public anon
-- key can insert and read rows. That's fine for low-stakes personal game
-- history with no sensitive data, but note it's not truly private per
-- user -- there's no server-side enforcement tying a row to a specific
-- browser beyond the client-supplied client_id.
create policy "Allow anonymous insert" on games
  for insert
  to anon
  with check (true);

create policy "Allow anonymous select" on games
  for select
  to anon
  using (true);

-- Migration for a table created before the `style` column existed
-- (the `games` table on this project was already live): run just this
-- line in the SQL Editor instead of the CREATE TABLE above.
-- alter table games add column style text;
