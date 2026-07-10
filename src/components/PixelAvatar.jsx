/* ---------------- pixel avatars (original art) ---------------- */
export const ZPAL = { p: "#6c0eff", y: "#b8ea85", t: "#48b2a7", f: "#f5a7db", c: "#7cfff1", s: "#d39a69", g: "#e9ea85", d: "#9cc16e", w: "#edffdf", r: "#ff4c5b", q: "#64d3c7" };
export const ZPIX = [
  "................................",
  ".......pppppppp.................",
  "......pyyyyyyyyppp..............",
  ".......pddyyyyyyyypp............",
  "........pddyyyyyyyyypp..........",
  ".........pyyyyyppyyyyyp.........",
  ".....ppppyyypppwwpppyyyp........",
  "....pyyyyyypcpswwwpcpywp........",
  "....pyyywypcpppsspppcpywp.......",
  "...pppyyypcpwywppywypcpyp..pp...",
  "...pgpyyyppyyyyyyyyyyppyp.pgp...",
  "....pgpyyyyyyypyyyppyyyyppgp....",
  ".....pgpdyyypptpypttpyydpgp.....",
  "......pgpypptttppttttpypgp......",
  "......pgsptppppptttrtppsgp......",
  ".......pgpcppppttttrttpgp.......",
  "........ppcppppttttrttpp........",
  ".........ypccccccccctpy.........",
  "..........ypqccccccqpy..........",
  ".........ppyppppppppypp.........",
  ".........pypppsffspppyp.........",
  "..........ppppfssfpppp..........",
  ".........pffpffsfgfpffp.........",
  "........psspfffsffffpssp........",
  "........pccppffsfffppccp........",
  ".........pppppppppppppp.........",
  ".........ptpppppppppptp.........",
  ".........ptpppppppppptp.........",
  "..........ppsspttpsspp..........",
  "...........pffppppffp...........",
  "...........pssp..pssp...........",
  "............pp....pp............",
];
export const JPAL = { o: "#150C24", p: "#8B2FC9", c: "#3EE7F5", s: "#F5D93E", w: "#E9B8FF" };
export const JPIX = [
  ".........so.",
  ".........so.",
  ".oooooooooo.",
  ".oppppppppo.",
  ".oppppppppo.",
  ".occcccccco.",
  ".occcccccco.",
  ".oppppppppo.",
  ".opwppppppo.",
  ".oppppppppo.",
  ".oppppppppo.",
  ".oooooooooo.",
];

/* ---------------- pixel book icon (Openings library button) ---------------- */
export const BPAL = { o: "#8B2FC9", w: "#F4EFFF", t: "#3EE7F5" };
export const BPIX = [
  "oooooo.oooooo",
  "owwwww.wwwwwo",
  "owtwww.wtwwwo",
  "owwwww.wwwwwo",
  "owtwww.wtwwwo",
  "owwwww.wwwwwo",
  "owtwww.wtwwwo",
  "owwwww.wwwwwo",
  "oooooo.oooooo",
];

/* ---------------- pixel ship icon (Home nav button) ----------------
 * Stylized pixel-art take on the "Zlegend's Retrograde" ship art --
 * gradient hull (blue nose -> violet -> magenta tail), a pink ring
 * crossing the middle, a small teal planet by the nose, and a dark
 * cockpit-window strip. Same rows/palette convention as ZPIX above. */
export const SPAL = {
  n: "#150C24", l: "#8FD9E8", b: "#8B93E8", v: "#6B4FC9", m: "#B06FE0",
  r: "#FF6FD8", t: "#7FE8C8", d: "#2E8F73", k: "#1B1030", c: "#9CF0FF",
};
export const SPIX = [
  ".................ntt",
  "...............nlldt",
  "............nlllllln",
  ".........nbbbbbbbbn",
  "......nbbbbbbbrbbbn",
  "....nvvvvvvrvvvvvn",
  "...nvvvvvrvvvvvvn",
  "..nvvvkckcvvvvvn",
  "..nvvvckckvvvvn",
  ".nmmrmmmmmmmmn",
  ".nmmmmmmmmmmn",
  "..nmnmnmmmn",
];

/* ---------------- pixel star icon (Puzzles button) ---------------- */
export const PPAL = { o: "#F5D93E" };
export const PPIX = [
  ".....o.....",
  ".....o.....",
  "....ooo....",
  "..o.ooo.o..",
  ".o..ooo..o.",
  "oo.ooooo.oo",
  ".o..ooo..o.",
  "..o.ooo.o..",
  "....ooo....",
  ".....o.....",
  ".....o.....",
];

export default function PixelAvatar({ rows, pal, size, className }) {
  const rects = [];
  let cols = 0;
  rows.forEach((row, y) => {
    cols = Math.max(cols, row.length);
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== ".") rects.push(<rect key={x + "-" + y} x={x} y={y} width="1" height="1" fill={pal[ch]} />);
    }
  });
  return (
    <svg viewBox={`0 0 ${cols} ${rows.length}`} width={size} height={size} className={className} style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }} aria-hidden="true">
      {rects}
    </svg>
  );
}
