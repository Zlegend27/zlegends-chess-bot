/* The numbers Rank Bot's rating keeps. How he plays is in engine/shadowBot.js. */
export const RANK_BOT_DEFAULT_ELO = 1400;
/* Plies (both sides) treated as the opening, which don't count as tracked
   moves. */
export const RANK_BOT_OPENING_PLIES = 8;
/* Minimum tracked (post-opening) player moves for an abandoned game to
   still count toward the assessment -- players who bail mid-game and hit
   New would otherwise never complete 3 "games". */
export const RANK_BOT_MIN_TRACKED_MOVES = 8;
/* The live estimate shifts from game to game, which is a bad number to show
   directly. Every RANK_BOT_ASSESSMENT_EVERY completed games, this averages
   that batch into one displayed Elo. */
export const RANK_BOT_ASSESSMENT_EVERY = 3;
/* A rating closes a third of the gap to what was measured, and never moves
   more than this in one game, so one rough game can't sink it. */
const RATING_CLOSE_SHARE = 1 / 3;
const MAX_RATING_STEP = 75;
export function nextRankRating(rating, measured) {
  const move = (measured - rating) * RATING_CLOSE_SHARE;
  return Math.round(rating + Math.max(-MAX_RATING_STEP, Math.min(MAX_RATING_STEP, move)));
}
