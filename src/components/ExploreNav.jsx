import PixelAvatar, { SPAL, SPIX } from "./PixelAvatar";

/* The ONE top bar every non-home page gets now -- it replaced both the
 *  old SiteHeader wordmark bar (deleted) and the split desktop sidebar
 *  dock / fixed-bottom mobile bar this used to be. With the page's
 *  social banner living at the bottom of every page (see
 *  SocialBanner.jsx), a fixed bottom-of-viewport nav would've fought it
 *  for the same territory, and there's no longer a reason to treat
 *  mobile/desktop differently here.
 *
 *  Bleeds edge-to-edge past .root's own padding (negative margins below)
 *  since it's standing in for a true top bar now, not just another
 *  max-w-4xl content card like everything below it.
 *
 *  Openings/Puzzles/Spectate/Blind Chess used to live here too, but are
 *  reachable from the home page's mode grid now instead -- this nav is
 *  just Home (back to that grid), Login (placeholder, no auth wired up
 *  yet), Music, and Settings.
 *
 *  "home" uses the SPIX pixel-art ship sprite (see PixelAvatar.jsx)
 *  instead of a plain path -- same pixel-grid convention as the
 *  Zlegend2700 bot avatar, so it actually looks like the ship art
 *  rather than a smooth vector approximation. */
const TOOLS = [
  { id: "home", label: "Home" },
  { id: "login", label: "Login", icon: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" },
  { id: "music", label: "Music", icon: "M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" },
  { id: "settings", label: "Settings", icon: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.14.24.42.32.66.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.1.51 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" },
];

function Icon({ d, size = 18, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function toolIcon(t, { size, className } = {}) {
  return t.id === "home"
    ? <PixelAvatar rows={SPIX} pal={SPAL} size={size ?? 26} className={className} />
    : <Icon d={t.icon} size={size ?? 18} className={className} />;
}

export function TopNav({ onSelect, active }) {
  return (
    <nav
      aria-label="Main features"
      className="mb-4 border-b border-[#8B2FC966] bg-[#1D1038CC] backdrop-blur-sm"
      style={{
        width: "calc(100% + 28px + env(safe-area-inset-left) + env(safe-area-inset-right))",
        marginLeft: "calc(-14px - env(safe-area-inset-left))",
        marginRight: "calc(-14px - env(safe-area-inset-right))",
        marginTop: "calc(-22px - env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-around px-1 py-2">
        {TOOLS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-label={t.label}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border-0 bg-transparent py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5] ${
                isActive ? "text-[#3EE7F5]" : "text-[#9D8FC4] hover:text-[#F4EFFF]"
              }`}
            >
              {toolIcon(t, {
                size: t.id === "home" ? 26 : 18,
                className: isActive ? "scale-110 transition-transform" : "transition-transform",
              })}
              <span className="text-[10px] font-semibold tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
