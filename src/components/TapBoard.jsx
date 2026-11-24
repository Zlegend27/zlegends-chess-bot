/* A board to answer on by tapping (the Blind Chess Trainer): squares light
   up when pressed. It can show the pieces or not, the coordinates or not,
   and the square colours or not (grey, for the colour drill). After an
   answer, squares can be marked right or wrong. Every square is a button
   named for screen readers ("e4, white knight"). */
import { getPieceSet } from "../utils/pieceSets";

const PIECES = "pnbrqk";

/** a1 is dark; colours alternate along every rank and file. (The first
 *  version had this backwards, drawing a1 light.) */
export const isLightSquare = (square) => ("abcdefgh".indexOf(square[0]) + Number(square[1])) % 2 === 0;
const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

export default function TapBoard({
  fen = null, coords = true, colored = true, flipped = false, pieceSetId = "classic", colors,
  onTap, picked = null, marks = {}, disabled = false, label = "Board",
}) {
  const grid = {};
  if (fen) {
    fen.split(" ")[0].split("/").forEach((row, i) => {
      let f = 0;
      for (const c of row) {
        if (/\d/.test(c)) { f += Number(c); continue; }
        grid["abcdefgh"[f] + (8 - i)] = c;
        f++;
      }
    });
  }
  const set = getPieceSet(pieceSetId);
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? "hgfedcba" : "abcdefgh";

  return (
    <div className={"tapBoard" + (colored ? "" : " plain")} role="group" aria-label={label}>
      {ranks.map((r) => [...files].map((f, fi) => {
        const name = f + r;
        const light = isLightSquare(name);
        const piece = grid[name];
        const mark = marks[name];
        /* Without colours every square is the same grey (two greys would
           still give the pattern away), split by thin lines. */
        const bg = colored ? (light ? colors.light : colors.dark) : "var(--tapGrey)";
        return (
          <button
            key={name}
            type="button"
            className={"tapSq" + (picked === name ? " picked" : "") + (mark ? " " + mark : "")}
            style={{ background: bg }}
            disabled={disabled}
            onClick={() => onTap?.(name)}
            aria-label={`${name}${piece ? `, ${piece === piece.toUpperCase() ? "white" : "black"} ${NAMES[piece.toLowerCase()]}` : ""}${picked === name ? ", picked" : ""}`}
          >
            {piece && <img src={set.svgUrl(PIECES.indexOf(piece.toLowerCase()) + 1, piece === piece.toUpperCase())} alt="" draggable={false} />}
            {coords && fi === 0 && <span className="tapRank" aria-hidden="true">{r}</span>}
            {coords && r === ranks[7] && <span className="tapFile" aria-hidden="true">{f}</span>}
          </button>
        );
      }))}
    </div>
  );
}
