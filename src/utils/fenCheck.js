/* Checks a position typed or pasted as FEN (Watch Bots' "Paste a
   position"), before the bots are asked to play it. Returns
   { fen } (tidied) or { error } in plain words. */
import { createEngine } from "../engine/chessEngine.js";

const SQUARES = /^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+$/;

export function checkFen(text) {
  const raw = String(text || "").trim().replace(/\s+/g, " ");
  if (!raw) return { error: "Paste a position first." };
  const [placement, side = "w", castling = "-", ep = "-", half = "0", full = "1"] = raw.split(" ");
  if (!SQUARES.test(placement)) return { error: "That doesn't look like a FEN position. It should start like rnbqkbnr/pppppppp/8/…" };
  const rows = placement.split("/");
  if (rows.some((r) => [...r].reduce((n, c) => n + (/\d/.test(c) ? Number(c) : 1), 0) !== 8)) return { error: "Each row of the position needs exactly 8 squares." };
  if (!/^[wb]$/.test(side)) return { error: "The side to move should be w or b." };
  const count = (c) => [...placement].filter((x) => x === c).length;
  if (count("K") !== 1 || count("k") !== 1) return { error: "The position needs exactly one white king and one black king." };
  if (/[pP]/.test(rows[0]) || /[pP]/.test(rows[7])) return { error: "Pawns can't stand on the first or last row." };
  if (count("P") > 8 || count("p") > 8) return { error: "Too many pawns for one side." };
  const fen = [
    placement, side,
    /^(-|[KQkq]{1,4})$/.test(castling) ? castling : "-",
    /^(-|[a-h][36])$/.test(ep) ? ep : "-",
    /^\d+$/.test(half) ? half : "0",
    /^\d+$/.test(full) ? full : "1",
  ].join(" ");
  const eng = createEngine();
  try { eng.loadFen(fen); } catch { return { error: "That position couldn't be read." }; }
  /* The side that just moved mustn't be in check: its king could be
     taken, which can't happen in a real game. */
  const other = createEngine();
  other.loadFen([placement, side === "w" ? "b" : "w", "-", "-", "0", "1"].join(" "));
  if (other.inCheckNow()) return { error: "The side that just moved is in check, which can't happen. Check whose turn it is." };
  if (eng.legalMoves().length === 0) return { error: eng.inCheckNow() ? "That position is already checkmate." : "That position is already stalemate." };
  return { fen };
}
