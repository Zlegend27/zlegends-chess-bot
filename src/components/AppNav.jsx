import { useEffect, useState } from "react";
import PixelAvatar, { SPAL, SPIX } from "./PixelAvatar";
import SocialLinks from "./SocialLinks";
import { getUiTheme } from "../utils/uiTheme";

/* The app's one menu. It's rendered by App.jsx above every page rather than
   by each page, so it never disappears or redraws as the player moves
   around. On a phone the sections sit in a bottom bar within thumb reach; on
   a computer they sit in the header. The logo is the Home button. */
const SECTIONS = [
  { id: "home", label: "Home", icon: "M12 3 2 12h3v8h5v-6h4v6h5v-8h3L12 3z" },
  { id: "play", label: "Play", icon: "M12 2a4 4 0 0 0-2.6 7.04L8 10.5V12h2c0 3-1.2 5-3 7h10c-1.8-2-3-4-3-7h2v-1.5l-1.4-1.46A4 4 0 0 0 12 2zM6 20h12v2H6z" },
  { id: "puzzles", label: "Puzzles", icon: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" },
  { id: "learn", label: "Learn", icon: "M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z" },
  { id: "review", label: "Game Review", icon: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" },
];
const PERSON_ICON = "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z";

/* Solid rather than translucent: a backdrop blur here would make this the
   containing block for the phone's fixed profile sheet and trap it inside
   the header. `dark` is for the Puzzles page, which stays dark in either
   theme for now. */
const DARK_ROSE = {
  navBorder: "border-sh-rose/60", dimText: "text-sh-dim", interactiveText: "text-sh-teal",
  ring: "focus-visible:ring-sh-teal", hoverInk: "hover:text-sh-text", ink: "text-sh-text",
  avatarRing: "ring-sh-rose/60", cardBorder: "border-sh-rose/40",
};
const surfaceFor = (sweetheart, dark) => (dark ? "bg-sh-panel" : sweetheart ? "bg-sh-lcard" : "bg-panel");
const themeFor = (sweetheart, dark) => (dark ? DARK_ROSE : getUiTheme(sweetheart));

function Icon({ d, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
  );
}

function MenuItem({ onClick, T, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-11 w-full items-center rounded-lg border-0 bg-transparent px-3 text-left text-sm font-semibold ${T.ink} transition-colors hover:bg-violet/15 focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
    >
      {children}
    </button>
  );
}

function ProfileMenu({ profile, onClose, onSignIn, onSignOut, onProfile, onShare, hasMoves, onYourGames, onSettings, onMusic, surface, T }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const choose = (action) => () => { onClose(); action(); };
  const divider = `my-1 border-t ${T.cardBorder}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 md:bg-transparent" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label="Profile menu"
        className={`fixed inset-x-0 bottom-0 rounded-t-2xl border ${T.cardBorder} ${surface} p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_8px_32px_#00000066] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-64 md:rounded-2xl md:pb-2`}
      >
        {profile ? (
          <div className="flex items-center gap-3 px-3 py-2">
            {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="size-12 rounded-full object-cover" />}
            <span className={`min-w-0 truncate text-base font-bold ${T.ink}`}>{profile.name}</span>
          </div>
        ) : (
          <MenuItem onClick={choose(onSignIn)} T={T}>Log in with Discord</MenuItem>
        )}
        <div className={divider} />
        <MenuItem onClick={choose(onProfile)} T={T}>Profile</MenuItem>
        {hasMoves && <MenuItem onClick={choose(onShare)} T={T}>Share this game</MenuItem>}
        <MenuItem onClick={choose(onYourGames)} T={T}>Your games</MenuItem>
        <MenuItem onClick={choose(onSettings)} T={T}>Settings</MenuItem>
        <MenuItem onClick={choose(onMusic)} T={T}>Juice Box</MenuItem>
        <div className={divider} />
        <div className="px-3 py-2"><SocialLinks /></div>
        {profile && (
          <>
            <div className={divider} />
            <MenuItem onClick={choose(onSignOut)} T={T}>Sign out</MenuItem>
          </>
        )}
      </div>
    </>
  );
}

export function AppHeader({ section, onSection, profile, sweetheart, dark, ...menuActions }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const T = themeFor(sweetheart, dark);
  const surface = surfaceFor(sweetheart, dark);
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;

  return (
    <header className={`appHeader sticky top-0 z-40 border-b ${T.navBorder} ${surface}`}>
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => onSection("home")}
          aria-label="Home"
          className={`flex h-11 items-center gap-2 rounded-lg border-0 bg-transparent pr-2 ${focus}`}
        >
          <PixelAvatar rows={SPIX} pal={SPAL} size={30} />
          <span className={`hidden text-sm font-bold sm:inline ${T.ink}`}>Zlegend2700</span>
        </button>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {SECTIONS.filter((s) => s.id !== "home").map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSection(s.id)}
              aria-current={section === s.id ? "page" : undefined}
              className={`h-11 rounded-lg border-0 bg-transparent px-3 text-sm font-bold transition-colors ${focus} ${section === s.id ? T.interactiveText : `${T.dimText} ${T.hoverInk}`}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="relative ml-auto flex items-center gap-2">
          {!profile && (
            <button
              type="button"
              onClick={menuActions.onSignIn}
              className={`h-11 rounded-lg border ${T.cardBorder} bg-transparent px-3 text-sm font-bold ${T.ink} transition-colors hover:bg-violet/15 ${focus}`}
            >
              Log in
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={profile ? `Profile menu for ${profile.name}` : "Menu"}
            className={`flex size-11 items-center justify-center rounded-full border-0 bg-transparent ${T.dimText} ${T.hoverInk} ${focus}`}
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className={`size-9 rounded-full object-cover ring-2 ${T.avatarRing}`} />
            ) : (
              <Icon d={PERSON_ICON} size={26} />
            )}
          </button>
          {menuOpen && (
            <ProfileMenu profile={profile} onClose={() => setMenuOpen(false)} surface={surface} T={T} {...menuActions} />
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomBar({ section, onSection, sweetheart, dark }) {
  const T = themeFor(sweetheart, dark);
  return (
    <nav
      aria-label="Sections"
      className={`fixed inset-x-0 bottom-0 z-30 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden ${T.navBorder} ${surfaceFor(sweetheart, dark)}`}
    >
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSection(s.id)}
          aria-current={section === s.id ? "page" : undefined}
          className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} ${section === s.id ? T.interactiveText : T.dimText}`}
        >
          <Icon d={s.icon} />
          <span className="text-[10px] font-semibold tracking-wide">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
