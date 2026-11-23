-- Site numbers. Paste any one of these into the Supabase SQL Editor and run
-- it. They only read. (They need supabase/005_events.sql to have been run,
-- and some days of visits, before they show much.)
--
-- Since 2026-11-23 events aren't tied to a person: client_id is a number
-- made for one visit and never stored, and user_id is always empty. So
-- "distinct client_id" counts VISITS, not people, and returning visitors
-- can't be counted (older rows still carry the old ids).

-- 1. The last 14 days at a glance: visits, pages, sign-ins, crashes per day.
select
  date_trunc('day', created_at)::date as day,
  count(distinct client_id) filter (where name = 'app_open') as visits,
  count(*) filter (where name = 'page') as pages_opened,
  count(*) filter (where name = 'sign_in') as sign_ins,
  count(*) filter (where name = 'error') as crashes
from public.events
where created_at > now() - interval '14 days'
group by 1 order by 1 desc;

-- 2. Which pages and features get used (last 30 days).
select name, detail->>'view' as page, detail->>'mode' as mode, count(*) as times, count(distinct client_id) as visits
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
select name, count(*) as runs, count(distinct client_id) as visits,
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
select detail->>'message' as message, detail->>'view' as page, app_version, count(*) as times, count(distinct client_id) as visits
from public.events
where name = 'error' and created_at > now() - interval '14 days'
group by 1, 2, 3 order by times desc limit 25;

-- 8. Signed in or not: how many visits each week were by signed-in players.
-- (Returning visitors can't be counted any more: see the note at the top.)
select date_trunc('week', created_at)::date as week,
  count(*) as visits,
  count(*) filter (where (detail->>'signedIn')::boolean) as signed_in
from public.events where name = 'app_open'
group by 1 order by 1 desc;

-- 9. Chess Tactica: how hard each Rogue Run floor is (last 30 days). For each
-- floor: how often it was cleared or ended the run, time taken, wrong moves
-- and timer rushes. A floor where many runs end, or that eats a lot of
-- health, is too hard for where it sits.
select (detail->>'floor')::int as floor, detail->>'world' as world,
  count(*) filter (where detail->>'how' = 'cleared') as cleared,
  count(*) filter (where detail->>'how' <> 'cleared') as runs_ended_here,
  round(avg((detail->>'seconds')::numeric)) as avg_seconds,
  round(avg((detail->>'wrong')::numeric), 2) as avg_wrong,
  round(avg((detail->>'rushes')::numeric), 2) as avg_rushes,
  round(avg((detail->>'healthBefore')::numeric - (detail->>'healthAfter')::numeric), 1) as avg_health_lost
from public.events
where name = 'tactica_floor' and created_at > now() - interval '30 days'
group by 1, 2 order by 1;

-- 10. Speed for real visitors (Core Web Vitals, last 28 days), by first page
-- and phone vs computer. Google's "good" lines: LCP under 2500 ms, INP under
-- 200 ms, CLS under 0.1, judged at the 75th percentile (p75) as here.
-- Safari sends no LCP or INP, so those columns count other browsers only.
select detail->>'path' as page,
  case when (detail->>'width')::int < 768 then 'phone' else 'computer' end as device,
  count(*) as visits,
  percentile_cont(0.75) within group (order by (detail->>'lcp')::numeric) as lcp_p75_ms,
  percentile_cont(0.75) within group (order by (detail->>'inp')::numeric) as inp_p75_ms,
  percentile_cont(0.75) within group (order by (detail->>'cls')::numeric) as cls_p75,
  round(100.0 * count(*) filter (where (detail->>'lcp')::numeric <= 2500) / nullif(count(detail->>'lcp'), 0)) as lcp_good_pct
from public.events
where name = 'vitals' and created_at > now() - interval '28 days'
group by 1, 2 having count(*) >= 5 order by visits desc;

-- 11. Feedback sent from the menu (newest first): what they wrote, bug or
-- idea, the page they were on, and their browser.
select created_at, detail->>'kind' as kind, detail->>'text' as text, detail->>'view' as page,
  detail->>'browser' as browser, (detail->>'width')::int as width, app_version
from public.events
where name = 'feedback'
order by created_at desc limit 50;
