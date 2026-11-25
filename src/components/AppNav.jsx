import { useEffect, useState } from "react";
import PixelAvatar, { SPAL, SPIX } from "./PixelAvatar";
import SocialLinks from "./SocialLinks";
import AccountAvatar from "./AccountAvatar";
import { SUPPORT_URL } from "../utils/links";
import { getUiTheme } from "../utils/uiTheme";

/* The app's one menu. It's rendered by App.jsx above every page rather than
   by each page, so it never disappears or redraws as the player moves
   around. On a phone the sections sit in a bottom bar within thumb reach; on
   a computer they sit in the header. The logo is the Home button. */
export const SECTIONS = [
  { id: "home", label: "Home", icon: "M12 3 2 12h3v8h5v-6h4v6h5v-8h3L12 3z" },
  { id: "play", label: "Play", icon: "M12 2a4 4 0 0 0-2.6 7.04L8 10.5V12h2c0 3-1.2 5-3 7h10c-1.8-2-3-4-3-7h2v-1.5l-1.4-1.46A4 4 0 0 0 12 2zM6 20h12v2H6z" },
  { id: "puzzles", label: "Puzzles", icon: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" },
  { id: "learn", label: "Learn", icon: "M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z" },
  { id: "review", label: "Game Review", short: "Review", icon: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" },
];
const COG_ICON = "M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54a7.3 7.3 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z";
const BOOK_ICON = "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z";
const MUSIC_ICON = "M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z";
const SHARE_ICON = "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81a3 3 0 1 0 0 4.38l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z";
const LOGOUT_ICON = "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z";
const FEEDBACK_ICON = "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z";
const HEART_ICON = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const CHEVRON_ICON = "M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z";
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

/* One row of the menu: an icon, then what it opens. */
function MenuItem({ onClick, T, icon, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-sm font-semibold ${T.ink} transition-colors hover:bg-violet/15 focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
    >
      <span className={T.dimText}><Icon d={icon} size={20} /></span>
      {children}
    </button>
  );
}

/* The account menu: who's signed in (tapping that opens the profile and
   account page, so there's no separate row for it), then History, Music
   and Settings, the socials, and Log out. Signed out, the top is a Log in
   button instead. */
function ProfileMenu({ profile, avatar, email, onClose, onSignIn, onSignOut, onProfile, onShare, hasMoves, onYourGames, onSettings, onMusic, onFeedback, surface, T }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const choose = (action) => () => { onClose(); action(); };
  const divider = `my-1.5 border-t ${T.cardBorder}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 md:bg-transparent" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label="Account menu"
        className={`fixed inset-x-0 bottom-0 rounded-t-2xl border ${T.cardBorder} ${surface} p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_8px_32px_#00000066] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-72 md:rounded-2xl md:pb-2`}
      >
        {profile ? (
          <button
            type="button"
            role="menuitem"
            onClick={choose(onProfile)}
            aria-label={`${profile.name}: profile and account`}
            className={`flex w-full items-center gap-3 rounded-xl border-0 bg-transparent p-3 text-left transition-colors hover:bg-violet/15 focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
          >
            <AccountAvatar profile={profile} avatar={avatar} size={48} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate text-base font-bold ${T.ink}`}>{profile.name}</span>
              <span className={`truncate text-xs ${T.dimText}`}>{email || "Profile and account"}</span>
            </span>
            <span className={T.dimText}><Icon d={CHEVRON_ICON} size={20} /></span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            <span className={`text-sm ${T.dimText}`}>Keep your games on every device and play 1v1.</span>
            <button type="button" role="menuitem" className="btn gold" style={{ width: "100%" }} onClick={choose(onSignIn)}>Log in</button>
            <button type="button" role="menuitem" className={`cursor-pointer border-0 bg-transparent p-1 text-xs font-bold underline ${T.dimText}`} onClick={choose(onProfile)}>Set your name and avatar</button>
          </div>
        )}
        <div className={divider} />
        <MenuItem onClick={choose(onYourGames)} T={T} icon={BOOK_ICON}>History</MenuItem>
        <MenuItem onClick={choose(onMusic)} T={T} icon={MUSIC_ICON}>Music</MenuItem>
        <MenuItem onClick={choose(onSettings)} T={T} icon={COG_ICON}>Settings</MenuItem>
        <MenuItem onClick={choose(onFeedback)} T={T} icon={FEEDBACK_ICON}>Feedback</MenuItem>
        {hasMoves && <MenuItem onClick={choose(onShare)} T={T} icon={SHARE_ICON}>Share this game</MenuItem>}
        <MenuItem onClick={choose(() => window.open(SUPPORT_URL, "_blank", "noopener"))} T={T} icon={HEART_ICON}>Support Zlegend</MenuItem>
        <div className={divider} />
        <div className="px-3 py-2"><SocialLinks /></div>
        {profile && (
          <>
            <div className={divider} />
            <MenuItem onClick={choose(onSignOut)} T={T} icon={LOGOUT_ICON}>Log out</MenuItem>
          </>
        )}
      </div>
    </>
  );
}

export function AppHeader({ section, onSection, profile, avatar, email, sweetheart, dark, ...menuActions }) {
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
            aria-label={profile ? `Account menu for ${profile.name}` : "Menu"}
            className={`flex size-11 items-center justify-center rounded-full border-0 bg-transparent ${T.dimText} ${T.hoverInk} ${focus}`}
          >
            {profile ? (
              <AccountAvatar profile={profile} avatar={avatar} size={36} className={`ring-2 ${T.avatarRing}`} />
            ) : (
              <Icon d={PERSON_ICON} size={26} />
            )}
          </button>
          {menuOpen && (
            <ProfileMenu profile={profile} avatar={avatar} email={email} onClose={() => setMenuOpen(false)} surface={surface} T={T} {...menuActions} />
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
          className={`flex h-[66px] flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} ${section === s.id ? T.interactiveText : T.dimText}`}
        >
          {/* Bigger than the header's icons: the bottom bar is the thumb's
              main way around on a phone (owner asked for it larger). */}
          <Icon d={s.icon} size={26} />
          {/* The bar is narrow on a phone: a short name where there is one
              ("Review"), the full name for screen readers. */}
          <span className="text-[11px] font-semibold tracking-wide" aria-hidden={s.short ? "true" : undefined}>{s.short ?? s.label}</span>
          {s.short && <span className="sr-only">{s.label}</span>}
        </button>
      ))}
    </nav>
  );
}
