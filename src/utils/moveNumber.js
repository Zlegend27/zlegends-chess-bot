/* Chess counts a move as White's turn plus Black's reply, but the app stores
   one entry per half-move (a "ply"). Anything shown to a player as "move N"
   goes through here, so a 56-move game never reads as 112. */

/** Full moves played after `plies` half-moves: 0 -> 0, 1 -> 1, 2 -> 1, 3 -> 2. */
export const fullMoves = (plies) => Math.ceil(Math.max(0, plies) / 2);

/** "56/56" for a position `ply` half-moves in, out of `total`. After Black's
 *  reply the number gets "…", as in chess notation, so stepping one half-move
 *  at a time never looks stuck. */
export const moveCounter = (ply, total) => `${fullMoves(ply)}${ply > 0 && ply % 2 === 0 ? "…" : ""}/${fullMoves(total)}`;
