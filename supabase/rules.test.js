/* Builds the site's database locally (PGlite, a small Postgres) from the
   same SQL files run in the Supabase dashboard, then checks who can do
   what: as a signed-out visitor (role anon) and as signed-in players (role
   authenticated). This is how a rule change gets tested before it's run
   for real.

   What's stood in for Supabase: the two roles, auth.uid() (read from the
   same setting Supabase's API sets), auth.users, storage.objects, the
   realtime schema (its messages table and realtime.topic()), and
   Supabase's habit of granting both roles access to everything in the
   public schema, leaving row level security as the gate. */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const FILES = [
  "../supabase_setup.sql", "001_link_accounts.sql", "002_ios_sign_in_handoff.sql", "003_rank_bot_detail.sql",
  "004_delete_account.sql", "005_events.sql", "006_leaderboard_safety.sql", "007_private_data.sql", "008_lobby_access.sql",
  "009_tactica_leaderboard.sql", "010_run_leaderboard.sql", "012_abuse_limits.sql",
];
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

let db;
/** Runs `fn` as a visitor (`uid` null) or a signed-in player. */
async function as(uid, fn) {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const game = (client, user = null, label = "1000 Elo") =>
  db.query("insert into games (client_id, user_id, difficulty_label, player_color, winner, result_reason, pgn) values ($1, $2, $3, 1, 1, 'Checkmate', '1. e4')", [client, user, label]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema storage;
    create table storage.objects (bucket_id text);
    alter table storage.objects enable row level security;
    create schema realtime;
    create table realtime.messages (topic text, extension text);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$
      select nullif(current_setting('realtime.topic', true), '')
    $$;
    grant usage on schema realtime to anon, authenticated;
    grant all on realtime.messages to anon, authenticated;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
  `);
  for (const file of FILES) {
    try { await db.exec(readFileSync(new URL(file, import.meta.url), "utf8")); } catch (e) { throw new Error(`${file}: ${e.message}`); }
  }
}, 60000);

describe("saved games are private", () => {
  test("a visitor can save a game and read it back only with their own browser id", async () => {
    await as(null, async () => {
      await game("browser-a");
      expect(await rows("select * from my_games('browser-a')")).toHaveLength(1);
      expect(await rows("select * from my_games('browser-b')")).toHaveLength(0);
      /* The table itself shows nothing. */
      expect(await rows("select * from games")).toHaveLength(0);
    });
  });

  test("signing in claims this browser's games, and they follow the account to another device", async () => {
    await as(null, () => game("alice-phone"));
    await as(ALICE, async () => {
      await db.query("select claim_my_data('alice-phone')");
      expect(await rows("select * from my_games('alice-laptop')")).toHaveLength(1);
    });
    /* Nobody else gets them: not Bob, not a visitor on the same phone. */
    await as(BOB, async () => expect(await rows("select * from my_games('alice-phone')")).toHaveLength(0));
    await as(null, async () => expect(await rows("select * from my_games('alice-phone')")).toHaveLength(0));
  });

  test("a visitor can't claim, and a player can't save a game under someone else's account", async () => {
    await expect(as(null, () => db.query("select claim_my_data('browser-a')"))).rejects.toThrow();
    await expect(as(BOB, () => game("bob-pc", ALICE))).rejects.toThrow();
    await as(BOB, () => game("bob-pc", BOB));
  });

  test("the rating estimate reads only this browser's finished games against the rated bots", async () => {
    await as(null, async () => {
      await game("rated", null, "1500 Elo");
      await game("rated", null, "Rank Bot");
      await db.query("insert into games (client_id, difficulty_label, player_color, result_reason, pgn) values ('rated', '1500 Elo', 1, 'Abandoned', '1. e4')");
      expect(await rows("select * from my_rated_games('rated', array['1000 Elo','1500 Elo','2000 Elo'])")).toHaveLength(1);
      expect(await rows("select * from my_rated_games('someone-else', array['1500 Elo'])")).toHaveLength(0);
    });
  });

  test("nobody can change or delete a saved game, or read Rank Bot's move log, with the public key", async () => {
    await as(null, async () => {
      expect((await db.query("update games set winner = -1")).affectedRows).toBe(0);
      expect((await db.query("delete from games")).affectedRows).toBe(0);
      await db.query("insert into rank_bot_moves (client_id, game_uid, ply, loss, elo_before, elo_after) values ('browser-a', gen_random_uuid(), 2, 10, 1000, 1000)");
      expect(await rows("select * from rank_bot_moves")).toHaveLength(0);
    });
  });
});

describe("a player's rating row", () => {
  test("is saved and read back only through its own browser id", async () => {
    await as(null, async () => {
      await db.query("select sync_player('browser-a', 'Zed', 1200, 3)");
      await db.query("select sync_player('browser-a', 'Zed', 1250, 4)");
      expect(await rows("select * from my_player('browser-a')")).toEqual([{ rank_elo: 1250, rank_games: 4 }]);
      expect(await rows("select * from my_player('browser-b')")).toHaveLength(0);
      expect(await rows("select * from players")).toHaveLength(0);
    });
  });

  test("can't be overwritten directly any more", async () => {
    await as(null, async () => {
      expect((await db.query("update players set rank_elo = 3000")).affectedRows).toBe(0);
      await expect(db.query("insert into players (client_id, rank_elo) values ('fake', 3000)")).rejects.toThrow();
    });
    await as(BOB, async () => expect((await db.query("update players set rank_elo = 3000")).affectedRows).toBe(0));
  });

  test("once claimed by an account, only that account can change it", async () => {
    await as(null, () => db.query("select sync_player('alice-phone', 'Alice', 1400, 9)"));
    await as(ALICE, () => db.query("select claim_my_data('alice-phone')"));
    await as(null, () => db.query("select sync_player('alice-phone', 'Hacked', 100, 0)"));
    await as(BOB, () => db.query("select sync_player('alice-phone', 'Hacked', 100, 0)"));
    await as(ALICE, async () => {
      expect(await rows("select * from my_player('alice-phone')")).toEqual([{ rank_elo: 1400, rank_games: 9 }]);
      await db.query("select sync_player('alice-phone', 'Alice', 1450, 10)");
      expect(await rows("select * from my_player('alice-phone')")).toEqual([{ rank_elo: 1450, rank_games: 10 }]);
    });
  });
});

describe("the Rush leaderboard", () => {
  test("shows scores without anyone's browser id, and the table itself can't be read", async () => {
    await as(null, async () => {
      await db.query("insert into rush_scores (client_id, display_name, duration_seconds, solved) values ('browser-a', 'Zed', 180, 12)");
      const board = await rows("select * from rush_leaderboard where duration_seconds = 180");
      expect(board).toHaveLength(1);
      expect(Object.keys(board[0]).sort()).toEqual(["created_at", "display_name", "duration_seconds", "mode", "player_key", "solved"]);
      expect(board[0].player_key).not.toBe("browser-a");
      expect(await rows("select * from rush_scores")).toHaveLength(0);
    });
  });

  test("refuses impossible scores, odd durations and long names", async () => {
    const add = (duration, solved, name = "Zed") => as(null, () => db.query("insert into rush_scores (client_id, display_name, duration_seconds, solved) values ('cheat', $1, $2, $3)", [name, duration, solved]));
    await expect(add(60, 61)).rejects.toThrow();
    await expect(add(60, -1)).rejects.toThrow();
    await expect(add(45, 5)).rejects.toThrow();
    await expect(add(60, 5, "x".repeat(25))).rejects.toThrow();
    await add(60, 60);
  });

  test("keeps Puzzle Rush Tactica scores on their own board", async () => {
    await as(null, async () => {
      await db.query("insert into rush_scores (client_id, display_name, duration_seconds, solved, mode) values ('tactica-a', 'Tia', 180, 9, 'tactica')");
      expect(await rows("select display_name from rush_leaderboard where mode = 'tactica'")).toEqual([{ display_name: "Tia" }]);
      expect(await rows("select 1 from rush_leaderboard where mode = 'rush' and display_name = 'Tia'")).toHaveLength(0);
      /* Tactica is three minutes only, and there are just the two games. */
      await expect(db.query("insert into rush_scores (client_id, duration_seconds, solved, mode) values ('tactica-a', 60, 9, 'tactica')")).rejects.toThrow();
      await expect(db.query("insert into rush_scores (client_id, duration_seconds, solved, mode) values ('tactica-a', 180, 9, 'other')")).rejects.toThrow();
    });
  });

  test("stops a flood from one browser", async () => {
    await as(null, async () => {
      for (let i = 0; i < 40; i++) await db.query("insert into rush_scores (client_id, duration_seconds, solved) values ('flood', 60, 1)");
      await expect(db.query("insert into rush_scores (client_id, duration_seconds, solved) values ('flood', 60, 1)")).rejects.toThrow(/too many/);
      await db.query("insert into rush_scores (client_id, duration_seconds, solved) values ('someone-else', 60, 1)");
    });
  });
});

describe("the Rogue Chess Run leaderboard", () => {
  test("anyone can add a run; the board shows it without the browser's id; the table stays closed", async () => {
    await as(null, async () => {
      await db.query("insert into run_scores (client_id, display_name, score, floor) values ('runner-pc-1', 'Rae', 23, 17)");
      await expect(db.query("select * from run_scores")).rejects.toThrow(/permission denied/);
      const board = await rows("select * from run_leaderboard where display_name = 'Rae'");
      expect(board).toHaveLength(1);
      expect(board[0]).toMatchObject({ score: 23, floor: 17, won: false, hard: false });
      expect(board[0].client_id).toBeUndefined();
      expect(board[0].player_key).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  test("impossible runs are refused", async () => {
    await as(null, async () => {
      for (const [score, floor, won] of [[101, 40, true], [-1, 1, false], [5, 41, false], [5, 0, false], [30, 20, true]]) {
        await expect(db.query("insert into run_scores (client_id, score, floor, won) values ('runner-pc-2', $1, $2, $3)", [score, floor, won])).rejects.toThrow();
      }
      await expect(db.query("insert into run_scores (client_id, display_name, score, floor) values ('runner-pc-2', $1, 1, 1)", ["x".repeat(25)])).rejects.toThrow();
    });
  });

  test("a signed-in player's run is theirs, and they can't post one as someone else", async () => {
    await as(ALICE, async () => {
      await db.query("insert into run_scores (client_id, score, floor, won) values ('alice-pc', 80, 40, true)");
      await expect(db.query("insert into run_scores (client_id, user_id, score, floor) values ('alice-pc', $1, 1, 1)", [BOB])).rejects.toThrow();
    });
    expect(await rows("select user_id from run_scores where client_id = 'alice-pc'")).toEqual([{ user_id: ALICE }]);
  });

  test("floods are refused", async () => {
    await as(null, async () => {
      for (let i = 0; i < 20; i++) await db.query("insert into run_scores (client_id, score, floor) values ('flood-runner', 1, 2)");
      await expect(db.query("insert into run_scores (client_id, score, floor) values ('flood-runner', 1, 2)")).rejects.toThrow(/too many/);
    });
  });
});

describe("the 1v1 lobby and matches (private channels)", () => {
  /* Supabase sets the topic being joined; realtime.topic() reads it. */
  const join = (uid, topic) => as(uid, async () => {
    await db.query("select set_config('realtime.topic', $1, false)", [topic]);
    await db.query("insert into realtime.messages (topic, extension) values ($1, 'presence')", [topic]);
    return (await rows("select * from realtime.messages where topic = $1", [topic])).length;
  });
  const aliceMatch = "match-t0-1794700000000-" + ALICE.slice(0, 8) + "-99999999";
  const tacticaMatch = "match-tc-t2-1794700000000-00000000-" + ALICE.slice(0, 8);

  test("a signed-in player can use both lobbies and their own matches", async () => {
    for (const topic of ["lobby-v1", "tactica-lobby-v1", aliceMatch, tacticaMatch]) expect(await join(ALICE, topic)).toBeGreaterThan(0);
  });

  test("a player can't join someone else's match, or any other channel", async () => {
    await expect(join(BOB, aliceMatch)).rejects.toThrow();
    await expect(join(ALICE, "some-other-room")).rejects.toThrow();
    /* Listening is refused too, not just sending. */
    await as(BOB, async () => {
      await db.query("select set_config('realtime.topic', $1, false)", [aliceMatch]);
      expect(await rows("select * from realtime.messages")).toHaveLength(0);
    });
  });

  test("a visitor who isn't signed in can't use private channels at all", async () => {
    await expect(join(null, "lobby-v1")).rejects.toThrow();
  });
});

describe("usage events", () => {
  test("anyone can add one, nobody can read them with the public key, and a player can't sign someone else's", async () => {
    await as(null, async () => {
      await db.query("insert into events (name, detail, client_id) values ('page', '{\"view\":\"home\"}', 'browser-a')");
      await expect(db.query("select * from events")).rejects.toThrow(/permission denied/);
    });
    await as(BOB, async () => {
      await db.query("insert into events (name, client_id, user_id) values ('page', 'bob-pc', $1)", [BOB]);
      await expect(db.query("insert into events (name, client_id, user_id) values ('page', 'bob-pc', $1)", [ALICE])).rejects.toThrow();
    });
  });
});

describe("deleting an account", () => {
  test("a visitor can't call it", async () => {
    await expect(as(null, () => db.query("select delete_my_account()"))).rejects.toThrow();
  });

  test("removes that player's games, scores, rating, events and account, and nobody else's", async () => {
    await as(BOB, async () => {
      await db.query("insert into rush_scores (client_id, user_id, duration_seconds, solved) values ('bob-pc', $1, 60, 3)", [BOB]);
      await db.query("insert into run_scores (client_id, score, floor) values ('bob-browser', 12, 9)");
      await db.query("select delete_my_account()");
    });
    const left = async (table) => Number((await rows(`select count(*) as n from ${table} where user_id = $1`, [BOB]))[0].n);
    for (const table of ["games", "rush_scores", "players", "events", "run_scores"]) expect(await left(table)).toBe(0);
    expect(await rows("select 1 from auth.users where id = $1", [BOB])).toHaveLength(0);
    /* Alice is untouched. */
    expect(await rows("select 1 from auth.users where id = $1", [ALICE])).toHaveLength(1);
    expect(Number((await rows("select count(*) as n from games where user_id = $1", [ALICE]))[0].n)).toBeGreaterThan(0);
  });
});

describe("size limits and flood guard (012)", () => {
  const big = "x".repeat(20001);
  test("oversized rows are refused, normal ones still go in", async () => {
    await as(null, async () => {
      await expect(db.query("insert into games (client_id, pgn) values ('size-test', $1)", [big])).rejects.toThrow(/games_sane/);
      await expect(db.query("insert into games (client_id, pgn) values ($1, '1. e4')", ["c".repeat(65)])).rejects.toThrow(/games_sane/);
      await expect(db.query("insert into blind_utterances (client_id, text) values ('size-test', $1)", ["y".repeat(501)])).rejects.toThrow(/blind_utterances_sane/);
      await db.query("insert into blind_utterances (client_id, text) values ('size-test', 'knight to eff three')");
      await expect(db.query("insert into rank_bot_moves (client_id, game_uid, ply, loss, elo_before, elo_after, detail) values ('size-test', gen_random_uuid(), 1, 0, 1000, 1000, $1)", [JSON.stringify({ pad: "z".repeat(3000) })])).rejects.toThrow(/rank_bot_moves_sane/);
    });
    await game("size-test");
  });

  test("the guard can't be called directly", async () => {
    await expect(as(null, () => db.query("select flood_guard()"))).rejects.toThrow();
  });

  test("a table takes its cap of new rows a minute, then refuses more", async () => {
    const recent = Number((await rows("select count(*) as n from games where created_at > now() - interval '1 minute'"))[0].n);
    await as(null, async () => {
      for (let i = recent; i < 120; i++) await db.query("insert into games (client_id, pgn) values ('flood-test', '1. e4')");
      await expect(db.query("insert into games (client_id, pgn) values ('flood-test', '1. e4')")).rejects.toThrow(/Too many new rows/);
    });
    /* Other tables are unaffected. */
    await as(null, () => db.query("insert into events (name, client_id) values ('page', 'flood-test')"));
  });
});
