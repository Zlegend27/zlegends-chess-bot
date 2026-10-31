import { STOCKFISH_MIN_ELO } from "../engine/stockfishEngine";

/* Rank Bot: rather than one fixed Elo, the target Stockfish strength is a
   dial that moves after every move the player makes based on how strong
   (or weak) the move actually was -- see adjustRankBotDial and the v3
   estimator notes at rankBotLossToPerf below. Game results feed in too
   (RANK_BOT_RESULT_STEP), and sandbagging -- deliberately hanging pieces
   to make the bot easy -- is detected and damped. The opening is excluded
   entirely (both from measurement and from the bot's own strength limit
   -- it plays theory at full strength, then drops to the dial). Below
   Stockfish's 1320 floor, blunderChance stands in for "weaker than
   Stockfish can go", same as the "1000 Elo" tier. */
export const RANK_BOT_MIN_ELO = 600;
/* Full engine strength -- the dial can climb all the way to "actually
   unbeatable" for players who earn it (v2 capped at 2200, which strong
   players simply plateaued against). */
export const RANK_BOT_MAX_ELO = 3190;
export const RANK_BOT_DEFAULT_ELO = 1400;
export const RANK_BOT_CALIBRATION_GAMES = 3;
export const RANK_BOT_CALIBRATION_MULT = 1.5;
export const RANK_BOT_PROBE_MS = 250;
/* Plies (both sides) treated as opening theory: the bot plays them at
   full strength and the dial ignores them. */
export const RANK_BOT_OPENING_PLIES = 8;
/* Minimum tracked (post-opening) player moves for an abandoned game to
   still count toward the assessment -- players who bail mid-game and hit
   New would otherwise never complete 3 "games". */
export const RANK_BOT_MIN_TRACKED_MOVES = 8;
/* v3 estimator. v2's threshold steps had no equilibrium -- a player's
   loss distribution doesn't change as the dial moves, so whichever
   direction their mix netted, the dial ran to that clamp and stayed
   (confirmed from rank_bot_moves telemetry: every 1400 start crashed to
   the 600 floor; even loss=0 moves averaged +3 because each blunder also
   sat in the rolling window dragging the next four steps down).

   Instead: map each move's cp loss to the Elo whose typical play it
   resembles (buckets sanity-checked against the logged loss
   distribution -- median 42, p75 275 -- and rough public ACPL-vs-rating
   curves), then pull the dial toward that with a small EWMA step. This
   self-limits in both directions: the dial converges to the average
   implied strength of the moves actually being played, climbing for
   clean play and settling low for weak play, no clamp-hugging. */
export function rankBotLossToPerf(loss) {
  if (loss === 0) return 3000;
  if (loss < 20) return 2400;
  if (loss < 60) return 1700;
  if (loss < 150) return 1150;
  if (loss < 300) return 800;
  return 450;
}
/* EWMA pull per move toward the implied perf -- half-life ~11 moves, so
   one game meaningfully moves the dial but one move can't hijack it. */
export const RANK_BOT_EWMA_K = 0.06;
/* A cp loss this big is a "throw" (hung piece / mate-in-sight ignored). */
export const RANK_BOT_THROW_CP = 300;
/* Sandbagging/erratic-play guards: once throws pile up in the recent
   window (more than THROWS_TO_SUSPECT of them), the dial moves at
   quarter weight in BOTH directions -- v3 dampened only the downs,
   which live telemetry showed backfiring for genuinely erratic players
   (see the v3.1 notes in adjustRankBotDial). No single game may drag
   the dial down more than MAX_GAME_DROP points total, however it's
   played. Genuine collapses still register (capped), while the material
   override + full-strength swing check elsewhere means the bot punishes
   the hung pieces themselves either way. */
export const RANK_BOT_THROWS_TO_SUSPECT = 2;
export const RANK_BOT_SUSPECT_WEIGHT = 0.25;
export const RANK_BOT_MAX_GAME_DROP = 250;
/* Soft counterpart to MAX_GAME_DROP, for climbing instead of falling.
   Climbing isn't adversarial the way sandbagging is -- it just means the
   dial started too low -- so this doesn't wall it off, it tapers the step
   linearly to zero as the game's climb approaches this many points (see
   the taper in adjustRankBotDial). Deliberately looser than the drop cap:
   telemetry showed one calibration-window game climb 1115 points in a
   single sitting (600 -> 1751, gradual, not a bug -- just an accurate
   dial finally catching up to a player who started at the floor), which
   is the kind of fast recognition worth mostly preserving, just not
   letting run fully unbounded. */
export const RANK_BOT_MAX_GAME_CLIMB = 600;
/* Game outcome feedback (v3): move quality is the primary signal, but
   the result is real evidence too -- the bot plays AT the player's
   estimated level, so beating it says the estimate is too low. Losing
   is close to expected and worth less; a draw leans mildly positive.
   Also blunts sandbagging: throwing pieces now mostly just loses the
   game, and a loss is worth far less dial movement than the throws
   would have been without the caps above. */
export const RANK_BOT_RESULT_STEP = { win: 120, draw: 20, loss: -80 };
/* The per-move dial above only updates *after* the player moves, and only
   by a small step -- fine for a slow-moving skill estimate, but it means
   a bot sitting on a weak dial would blunder-roll right past a just-hung
   queen because "skill this low" says so. Material/tactical reality has
   to trump the calibration in the moment: a big swing overrides the dial
   for that one move only (never persisted), snapping to full strength to
   grab (or dodge) it, and easing off when the bot is already dominating
   so the game doesn't turn into a blowout. */
export const RANK_BOT_SWING_CP = 400;
/* Budget for the full-strength sanity search in stockfishMove -- short
   since it's only checking "is there something decisive right now", not
   doing real analysis; confirmed reliable at this length even at only
   300ms in testing. Adds this much to Rank Bot's per-move latency. */
export const RANK_BOT_SANITY_MS = 400;
export const RANK_BOT_DOMINANT_CAP = 900;
/* The live dial above drives actual in-game difficulty and never stops
   moving -- but that's a bad number to show the player directly (it can
   swing mid-game). Every RANK_BOT_ASSESSMENT_EVERY completed games, this
   averages that batch's ending dial values into one displayed Elo,
   smoothing out one unusually easy/hard game rather than trusting
   whichever number the dial happened to land on last. */
export const RANK_BOT_ASSESSMENT_EVERY = 3;
export function rankBotBlunderChance(elo) {
  if (elo >= STOCKFISH_MIN_ELO) return 0;
  const deficit = STOCKFISH_MIN_ELO - elo;
  return Math.min(0.75, 0.3 + deficit / 1000);
}
