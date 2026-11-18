-- Marks the game's creator, which shows the Boss viewer in Chess Tactica
-- (Rogue Chess Run's first screen: jump to any world's boss, nothing saved).
--
-- Run once in the Supabase dashboard's SQL Editor, after putting YOUR
-- sign-in email between the quotes below. Then sign out of the site and
-- back in (the role travels in the sign-in token, so an old token won't
-- have it yet).
--
-- Why app_metadata: players can change their own user_metadata from the
-- browser, but only the server (this editor, or the service key) can
-- change app_metadata, so nobody can give themselves the role.
--
-- To take the role away again: the same statement with
--   raw_app_meta_data - 'role'
-- in place of the || part.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "creator"}'::jsonb
where lower(email) = lower('PUT-YOUR-EMAIL-HERE');

-- Should list exactly one account, with role "creator".
select id, email, raw_app_meta_data ->> 'role' as role
from auth.users
where raw_app_meta_data ->> 'role' = 'creator';
