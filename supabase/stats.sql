-- Site numbers. Paste any one of these into the Supabase SQL Editor and run
-- it. They only read. (They need supabase/005_events.sql to have been run,
-- and some days of visits, before they show much.)

-- 1. The last 14 days at a glance: visitors, games, sign-ups, crashes per day.
select
  date_trunc('day', created_at)::date as day,
  count(distinct client_id) filter (where name = 'app_open') as visitors,
  count(*) filter (where name = 'page') as pages_opened,
  count(*) filter (where name = 'sign_in') as sign_ins,
  count(*) filter (where name = 'error') as crashes
from public.events
where created_at > now() - interval '14 days'
group by 1 order by 1 desc;

-- 2. Which pages and features get used (last 30 days).
select name, detail->>'view' as page, detail->>'mode' as mode, count(*) as times, count(distinct client_id) as people
from public.events
where created_at > now() - interval '30 days' and name in ('page', 'tactica_mode', 'lesson_open', 'trainer_open', 'review_run')
group by 1, 2, 3 order by times desc;

-- 3. Puzzles: solved against failed, by kind (last 30 days).
select detail->>'kind' as kind,
  count(*) filter (where (detail->>'solved')::boolean) as solved,
  count(*) filter (where not (detail->>'solved')::boolean) as failed
from public.events
where name = 'puzzle' and created_at > now() - interval '30 days'
group by 1;

-- 4. Chess Tactica: runs and scores (last 30 days).
select name, count(*) as runs, count(distinct client_id) as people,
  round(avg((detail->>'score')::numeric), 1) as average_score, max((detail->>'score')::int) as best_score
from public.events
where name in ('tactica_blitz_end', 'tactica_run_end') and created_at > now() - interval '30 days'
group by 1;

-- 5. Rank Bot: how games felt, against how they ended (last 30 days).
select detail->>'feel' as felt, detail->>'result' as result, count(*) as answers
from public.events
where name = 'rankbot_feel' and created_at > now() - interval '30 days'
group by 1, 2 order by answers desc;

-- 6. Rank Bot results by design version (all time).
select (m.detail->>'v')::int as design, count(distinct g.game_uid) as games,
  count(distinct g.game_uid) filter (where g.winner = g.player_color) as player_wins,
  count(distinct g.game_uid) filter (where g.result_reason = 'Abandoned') as abandoned
from public.games g join public.rank_bot_moves m on m.game_uid = g.game_uid
where m.detail is not null
group by 1 order by 1;

-- 7. Crashes: the most common ones (last 14 days).
select detail->>'message' as message, detail->>'view' as page, app_version, count(*) as times, count(distinct client_id) as people
from public.events
where name = 'error' and created_at > now() - interval '14 days'
group by 1, 2, 3 order by times desc limit 25;

-- 8. Coming back: of the people first seen each week, how many returned on a later day.
with firsts as (
  select client_id, min(created_at)::date as first_day from public.events where name = 'app_open' group by 1
)
select date_trunc('week', f.first_day)::date as week, count(*) as new_people,
  count(*) filter (where exists (
    select 1 from public.events e where e.client_id = f.client_id and e.name = 'app_open' and e.created_at::date > f.first_day
  )) as came_back
from firsts f group by 1 order by 1 desc;
