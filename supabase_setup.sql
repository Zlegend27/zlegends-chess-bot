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

-- Player identity: one row per browser (client_id), holding the
-- player-chosen display name shown on Rush leaderboard entries. Also
-- reserves rank_elo/rank_games now for the planned adaptive "Rank Bot"
-- feature, so that feature won't need a second migration later.
create table players (
  client_id text primary key,
  display_name text,
  rank_elo int,
  rank_games int not null default 0,
  updated_at timestamptz not null default now()
);

alter table players enable row level security;

create policy "Allow anonymous upsert players" on players
  for insert
  to anon
  with check (true);

create policy "Allow anonymous update own player" on players
  for update
  to anon
  using (true);

create policy "Allow anonymous select players" on players
  for select
  to anon
  using (true);

-- Puzzle Rush leaderboard: one row per completed run (not "best score
-- only"), so it doubles as a simple history if that's ever useful.
create table rush_scores (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  display_name text,
  duration_seconds int not null,
  solved int not null,
  created_at timestamptz not null default now()
);

create index rush_scores_leaderboard_idx on rush_scores (duration_seconds, solved desc, created_at asc);

alter table rush_scores enable row level security;

create policy "Allow anonymous insert rush_scores" on rush_scores
  for insert
  to anon
  with check (true);

create policy "Allow anonymous select rush_scores" on rush_scores
  for select
  to anon
  using (true);
