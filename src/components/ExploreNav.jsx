/* Four tools shared between the desktop "Explore" dock and the mobile
 *  bottom nav -- ONE list so they can't drift apart the way the v0
 *  reference design's two components did (its ToolDock had 6 tools but
 *  its BottomNav only had 5 and silently dropped one).
 *
 *  Openings/Puzzles/Spectate/Blind Chess used to live here too, but are
 *  reachable from the home page's mode grid now instead -- this nav is
 *  just Home (back to that grid), Login (placeholder, no auth wired up
 *  yet), Music, and Settings.
 *
 *  "home"'s icon is a placeholder -- swap for the actual ship artwork
 *  once that's available as a real asset file (a pasted image isn't one
 *  yet, can't inline it as an SVG path). */
const TOOLS = [
  { id: "home", label: "Home", icon: "M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z" },
  { id: "login", label: "Login", icon: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" },
  { id: "music", label: "Music", icon: "M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" },
  { id: "settings", label: "Settings", icon: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.14.24.42.32.66.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.1.51 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" },
];

function Icon({ d, className }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Desktop-only grid, sits in the right-hand panel column below the
 *  scoresheet/analysis card. Hidden below the lg breakpoint -- BottomNav
 *  covers mobile instead so the two never show at once. */
export function ExploreDock({ onSelect, active }) {
  return (
    <section aria-label="More features" className="hidden lg:block">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#9D8FC4]">Explore</p>
      <div className="grid grid-cols-3 gap-2">
        {TOOLS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-label={t.label}
              className={`group flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center backdrop-blur-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5] ${
                isActive ? "border-[#3EE7F580] bg-[#1D1038E6]" : "border-[#8B2FC933] bg-[#1D1038CC] hover:border-[#3EE7F566]"
              }`}
            >
              <span className={`flex size-8 items-center justify-center rounded-lg transition-colors ${isActive ? "bg-[#3EE7F52E] text-[#3EE7F5]" : "bg-[#8B2FC926] text-[#3EE7F5] group-hover:bg-[#3EE7F51F]"}`}>
                <Icon d={t.icon} />
              </span>
              <span className="text-[11px] font-bold leading-tight text-[#F4EFFF]">{t.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Fixed bottom bar, mobile-only (hidden at the lg breakpoint where
 *  ExploreDock takes over). All 6 tools, unlike the reference design's
 *  version of this component. */
export function BottomNav({ onSelect, active }) {
  return (
    <nav
      aria-label="Main features"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#8B2FC940] bg-[#0E0620E6] backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-center justify-around px-1">
        {TOOLS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-label={t.label}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border-0 bg-transparent py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5] ${
                isActive ? "text-[#3EE7F5]" : "text-[#9D8FC4] hover:text-[#F4EFFF]"
              }`}
            >
              <Icon d={t.icon} className={isActive ? "scale-110 transition-transform" : "transition-transform"} />
              <span className="text-[10px] font-semibold tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
