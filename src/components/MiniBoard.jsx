const PIECE_TYPES = "pnbrqk";

/** A small picture of a position, for cards. Nothing here is interactive, so
 *  it reads the FEN directly instead of standing up an engine. */
/** `flipped` puts Black at the bottom. By default the side to move is. */
/* `marks`: square names (e.g. ["f3"]) outlined, for pointing at what a
   question was about (the Blind Chess Trainer). */
export default function MiniBoard({ fen, colors, pieceImgSrc, size = 104, flipped, label = "Today's puzzle position", marks = [] }) {
  const [placement, side] = fen.split(" ");
  const squares = placement.split("/").flatMap((row) =>
    [...row].flatMap((c) => (/\d/.test(c) ? Array(Number(c)).fill(null) : [c]))
  );
  /* The solver sits at the bottom, the way the puzzle itself will open. */
  const isFlipped = flipped ?? side === "b";
  const oriented = isFlipped ? [...squares].reverse() : squares;
  const nameAt = (i) => { const j = isFlipped ? 63 - i : i; return "abcdefgh"[j % 8] + (8 - Math.floor(j / 8)); };

  return (
    <div
      role="img"
      aria-label={label}
      className="grid shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-lg"
      style={{ width: size, height: size }}
    >
      {oriented.map((piece, i) => {
        const light = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
        return (
          <div key={i} style={{ background: light ? colors.light : colors.dark, boxShadow: marks.includes(nameAt(i)) ? "inset 0 0 0 3px var(--cyan)" : undefined }}>
            {piece && (
              <img
                src={pieceImgSrc(PIECE_TYPES.indexOf(piece.toLowerCase()) + 1, piece === piece.toUpperCase())}
                alt=""
                className="block size-full object-contain"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
