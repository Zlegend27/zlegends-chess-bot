import { STOCKFISH_MIN_ELO } from "../engine/stockfishEngine";

/* Casual and Master keep this app's own homemade engine (they're the top
   two tiers and were never in question). The three tiers below them are
   backed by a real Stockfish build instead of guessed search-time
   budgets, so "1000/1500/2000" are meant to actually mean something
   against chess.com's own rating scale -- see stockfishEngine.js for why.
   Stockfish's UCI_Elo has a hard floor of 1320, so the "1000" tier adds
   an extra blunder chance on top of that floor to push it down further. */
export const DIFFICULTIES = [
  { label: "1000 Elo", stockfishElo: STOCKFISH_MIN_ELO, blunderChance: 0.3, moveTimeMs: 500 },
  { label: "1500 Elo", stockfishElo: 1500, moveTimeMs: 700 },
  { label: "2000 Elo", stockfishElo: 2000, moveTimeMs: 1000 },
  { label: "Rank Bot", id: "rank", adaptive: true, moveTimeMs: 900 },
  /* styleBook: Casual's opening picks lean into the bot's daily
     personality (see STYLE_BOOK_BIAS in openingBook.js). Master stays on
     the neutral popularity-weighted book, and the Stockfish tiers don't
     use a book at all. */
  { label: "Casual", ms: 600, book: true, styleBook: true },
  { label: "Master", ms: 12000, book: true },
];
