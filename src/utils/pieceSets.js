import { pieceSvgUrl } from "./chessPieceSvg";
import { sweetheartPieceUrl } from "./sweetheartPieceSvg";

/* Standard and Wood are large SVG sets (about 11 and 22 KB), and a player
   only ever sees one set at a time, so they load when chosen rather than
   with the first page. Until one has loaded, it draws as Classic. App.jsx
   loads the chosen set at start (long before any board is on screen) and
   every set when the Piece Designs picker opens, then redraws. */
const LOADERS = {
  standard: () => import("./cburnettPieceSvg").then((m) => m.cburnettPieceSvgUrl),
  wood: () => import("./woodPieceSvg").then((m) => m.woodPieceSvgUrl),
};
const loaded = {};

/** Loads a set's drawings if it needs loading. Resolves when it's ready. */
export function loadPieceSet(id) {
  if (!LOADERS[id] || loaded[id]) return Promise.resolve();
  return LOADERS[id]().then((svgUrl) => { loaded[id] = svgUrl; }, () => { /* offline: stays Classic */ });
}

const lazySet = (id) => (type, isWhite) => (loaded[id] ?? pieceSvgUrl)(type, isWhite);

export const PIECE_SETS = [
  { id: "classic", label: "Classic", svgUrl: pieceSvgUrl },
  { id: "standard", label: "Standard", svgUrl: lazySet("standard") },
  { id: "wood", label: "Wood", svgUrl: lazySet("wood") },
  { id: "sweetheart", label: "Sweetheart", svgUrl: sweetheartPieceUrl },
];

export function getPieceSet(id) {
  return PIECE_SETS.find(s => s.id === id) || PIECE_SETS[0];
}
