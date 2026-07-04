/* Kid-friendly slice of the real Lichess puzzle database (see
   src/utils/puzzles-lichess.json + scripts/import-puzzles.mjs), capped
   at 1600 so Kinnda never hands a kid a puzzle rated for club players.
   Each puzzle's `moves` list already alternates solver/auto-played reply
   (see puzzles-lichess.js's own header) so onPuzzleSquare here mirrors
   the multi-move puzzleMove logic in the main App.jsx instead of the
   old single-move version this file used to have. */
import puzzlesData from "../src/utils/puzzles-lichess.json";

const THEME_HINTS = {
  mateIn1: "Look for a checkmate in one move!",
  mateIn2: "You can force checkmate in just two moves!",
  mate: "There's a checkmate hiding in this position!",
  fork: "One of your pieces can attack two things at once!",
  pin: "An enemy piece can't move without exposing something bigger behind it.",
  skewer: "Attack the piece in front so a bigger piece behind it falls too!",
  hangingPiece: "A black piece is just sitting there undefended!",
  discoveredAttack: "Moving one piece out of the way unleashes another!",
  discoveredCheck: "Moving one piece out of the way gives check with another!",
  backRankMate: "The enemy king is stuck on the back row with no escape!",
  sacrifice: "Sometimes giving up a piece leads to something even better!",
  advancedPawn: "Your pawn is close to becoming a queen!",
  kingsideAttack: "The enemy king's side of the board is looking shaky!",
  exposedKing: "The enemy king doesn't have much cover!",
  deflection: "Pull a defender away from the piece it's protecting!",
  attraction: "Lure the enemy piece to a bad square!",
  quietMove: "Not every good move is a capture — look for a quiet, sneaky one!",
};

function hintFor(themes) {
  for (const t of themes) if (THEME_HINTS[t]) return THEME_HINTS[t];
  return "Look for your best, safest move!";
}

const MAX_RATING = 1600;
const BANDS = [
  { id: "easy", label: "Easy", min: 0, max: 900 },
  { id: "medium", label: "Medium", min: 900, max: 1200 },
  { id: "hard", label: "Hard", min: 1200, max: MAX_RATING },
];

const ALL = puzzlesData.puzzles
  .filter(p => p.rating < MAX_RATING)
  .map(p => ({ ...p, hint: hintFor(p.themes) }));

export const KID_PUZZLE_BANDS = BANDS;
export function kidPuzzlesInBand(bandId) {
  const band = BANDS.find(b => b.id === bandId);
  if (!band) return ALL;
  return ALL.filter(p => p.rating >= band.min && p.rating < band.max);
}
