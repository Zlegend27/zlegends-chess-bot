-- Adds one flexible column to Rank Bot's per-move log, holding what the bot saw
-- and why it chose its move (see the note in src/engine/shadowBot.js).
-- Safe to run more than once. Run it in the Supabase dashboard's SQL editor.
alter table public.rank_bot_moves add column if not exists detail jsonb;
