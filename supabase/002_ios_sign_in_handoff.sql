-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run.
--
-- The mailbox that lets an iPhone home-screen app finish a Discord sign-in
-- (see src/utils/authHandoff.js). The sign-in tab can't reach the app
-- directly, so it leaves a one-time code here for the app to collect.
--
-- Security note: a code is useless without the PKCE verifier that stays in
-- the app, so reading one wouldn't sign anyone in. The table still has no
-- policies, so nobody can list it: these two functions are the only way
-- in, and each needs the random nonce that only that sign-in knows.

create table if not exists public.auth_handoffs (
  nonce uuid primary key,
  code text not null check (char_length(code) <= 2048),
  created_at timestamptz not null default now()
);

alter table public.auth_handoffs enable row level security;
revoke all on public.auth_handoffs from anon, authenticated;

-- First writer wins, so a sign-in's code can't be swapped afterwards. Each
-- call also clears out codes that were never collected.
create or replace function public.auth_handoff_put(handoff uuid, auth_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_handoffs where created_at < now() - interval '10 minutes';
  insert into public.auth_handoffs (nonce, code) values (handoff, auth_code)
    on conflict (nonce) do nothing;
$$;

-- Deleting as it reads means a code can only ever be collected once.
create or replace function public.auth_handoff_take(handoff uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_handoffs
    where nonce = handoff and created_at >= now() - interval '10 minutes'
    returning code;
$$;

revoke all on function public.auth_handoff_put(uuid, text) from public;
revoke all on function public.auth_handoff_take(uuid) from public;
grant execute on function public.auth_handoff_put(uuid, text) to anon, authenticated;
grant execute on function public.auth_handoff_take(uuid) to anon, authenticated;
