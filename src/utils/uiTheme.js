/** Shared Tailwind class picks for the app-wide Sweetheart theme.
 *
 *  Tailwind utility classes are literal at build time (see the @theme
 *  comment in src/index.css), so unlike the CSS-custom-property system
 *  (App.css/tokens.css, which reskins live via the [data-theme] override),
 *  the Tailwind-authored surfaces (HomePage, TopNav, LeaderboardPage,
 *  LessonsPage, GamePanel, PuzzlesHomePage, and the handful of
 *  Tailwind-in-JSX bits inside App.jsx's own Play-screen tree) can't just
 *  react to a runtime variable change. Each of those calls
 *  getUiTheme(sweetheart) once and swaps its class strings for these
 *  instead of duplicating the same ternary in every file.
 *
 *  Only the handful of slots that actually repeat across those files are
 *  named here -- a one-off decorative color (a single inline SVG fill) is
 *  cheaper left as its own inline ternary at the call site than routed
 *  through a shared object for a single use. */
export function getUiTheme(sweetheart) {
  return sweetheart ? {
    // Real light mode (see tokens.css) -- sh-lcard/sh-link/sh-link-dim
    // are the light-surface/dark-ink counterparts to the dark-mode
    // sh-panel/sh-text/sh-dim set the Puzzles page still uses unconditionally.
    // sh-rose/sh-red stay as accents in both modes; sh-gold/sh-teal get
    // darker (sh-lgold/sh-lteal) variants here since the originals were
    // tuned as light text for a dark background and fail contrast on paper.
    panelBg: "bg-sh-lcard/90",
    cardBorder: "border-sh-rose/40",
    navBorder: "border-sh-rose/60",
    avatarRing: "ring-sh-rose/60",
    dimText: "text-sh-link-dim",
    accentText: "text-sh-lgold",
    accentBorder: "border-sh-lgold/40",
    interactiveText: "text-sh-lteal",
    mutedIcon: "text-sh-rose/40",
    divide: "divide-sh-rose/25",
    ring: "focus-visible:ring-sh-lteal",
    ink: "text-sh-link",
    hoverInk: "hover:text-sh-link",
    mutedLabel: "text-sh-link/85",
  } : {
    panelBg: "bg-panel/80",
    cardBorder: "border-violet/40",
    navBorder: "border-violet/60",
    avatarRing: "ring-violet/60",
    dimText: "text-dim",
    accentText: "text-yellow",
    accentBorder: "border-yellow/30",
    interactiveText: "text-cyan",
    mutedIcon: "text-violet/40",
    divide: "divide-violet/18",
    ring: "focus-visible:ring-cyan",
    ink: "text-paper",
    hoverInk: "hover:text-paper",
    mutedLabel: "text-[#CBBDF0]",
  };
}
