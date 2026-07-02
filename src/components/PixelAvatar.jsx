/* ---------------- pixel avatars (original art) ---------------- */
export const ZPAL = { o: "#150C24", h: "#CBD0DC", b: "#2E5BE0", g: "#F04BB8", s: "#4E7FD0", e: "#1B1430", r: "#F05348", c: "#8B2FC9", G: "#E8B84B" };
export const ZPIX = [
  "...oooo.....",
  "..ohhhhoo...",
  ".ohbgbhhho..",
  ".ohbgbhhhho.",
  "ohhhhhhhhhho",
  "ohhssssssho.",
  ".oseesssrso.",
  ".oseessssso.",
  ".osssoossso.",
  "..osssssso..",
  ".occcccccco.",
  "occGccccGcco",
];
export const UPAL = { o: "#0B1B2E", w: "#DFFBFF", c: "#3EE7F5", d: "#1E6E7A" };
export const UPIX = [
  "............",
  "....oooo....",
  "...owwcco...",
  "...owwcco...",
  "....occo....",
  "...owwcco...",
  "..owwwccco..",
  "..owwwccco..",
  "...owwcco...",
  "..owwwccco..",
  ".owwwwcccco.",
  ".oooooooooo.",
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

export default function PixelAvatar({ rows, pal, size }) {
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== ".") rects.push(<rect key={x + "-" + y} x={x} y={y} width="1" height="1" fill={pal[ch]} />);
    }
  });
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }}>
      {rects}
    </svg>
  );
}
