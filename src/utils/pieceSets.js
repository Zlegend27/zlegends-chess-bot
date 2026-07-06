import { pieceSvgUrl } from "./chessPieceSvg";
import { cburnettPieceSvgUrl } from "./cburnettPieceSvg";
import { woodPieceSvgUrl } from "./woodPieceSvg";

export const PIECE_SETS = [
  { id: "classic", label: "Classic", svgUrl: pieceSvgUrl },
  { id: "standard", label: "Standard", svgUrl: cburnettPieceSvgUrl },
  { id: "wood", label: "Wood", svgUrl: woodPieceSvgUrl },
];

export function getPieceSet(id) {
  return PIECE_SETS.find(s => s.id === id) || PIECE_SETS[0];
}
