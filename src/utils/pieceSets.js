import { pieceSvgUrl } from "./chessPieceSvg";
import { cburnettPieceSvgUrl } from "./cburnettPieceSvg";

export const PIECE_SETS = [
  { id: "classic", label: "Classic", svgUrl: pieceSvgUrl },
  { id: "standard", label: "Standard", svgUrl: cburnettPieceSvgUrl },
];

export function getPieceSet(id) {
  return PIECE_SETS.find(s => s.id === id) || PIECE_SETS[0];
}
