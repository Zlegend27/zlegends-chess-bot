import { useState } from "react";
import StarField from "./StarField";
import SocialBanner from "./SocialBanner";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";

/* Same inline-SVG-path convention already used for the Juice Box/Puzzles/
   Spectate icons elsewhere in the app (see App.jsx's icon row) -- kept
   consistent rather than pulling in an icon library just for this page.
   Puzzles/Spectate reuse those exact paths; Play/Openings/Blind get
   their own custom icons below (renderIcon) instead of a plain
   currentColor path, per direction: the bot sprite for Play, a colored
   book for Openings, a blindfolded face for Blind. */
const ICONS = {
  puzzle: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z",
  bolt: "M7 2v11h3v9l7-12h-4l4-8z",
  eye: "M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  star: "M12 2l2.9 6.9L22 9.6l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.6L2 9.6l7.1-.7L12 2z",
  trophy: "M7 4V2h10v2h4v3c0 2.21-1.79 4-4 4h-.08A6.007 6.007 0 0 1 13 15.92V18h3v2H8v-2h3v-2.08A6.007 6.007 0 0 1 7.08 9H7c-2.21 0-4-1.79-4-4V4h4zm-2 2v1c0 1.1.9 2 2 2V6H5zm12 0v3c1.1 0 2-.9 2-2V6h-2z",
  cap: "M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L4.24 12.3 3 13l9 5 9-5-1.24-.7L12 16.5zM5 14.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z",
  cog: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.14.24.42.32.66.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.1.51 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
};

/** Play/Openings/Blind get bespoke icons instead of a single-fill path:
 *  Zlegend2700's own sprite for Play (it's literally who you're
 *  playing), a two-tone open book for Openings, and a blindfolded
 *  piñata-style face for Blind Chess. Everything else keeps the plain
 *  currentColor path + accent-tint treatment. */
function renderIcon(id) {
  if (id === "play") return <PixelAvatar rows={ZPIX} pal={ZPAL} size={46} />;
  if (id === "openings") return (
    <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5.5C10.5 4 8 3 4 3v14c4 0 6.5 1 8 2.5V5.5z" fill="#3EE7F5" />
      <path d="M12 5.5C13.5 4 16 3 20 3v14c-4 0-6.5 1-8 2.5V5.5z" fill="#F5D93E" />
    </svg>
  );
  if (id === "blind") return (
    <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#F5D93E26" stroke="#F5D93E" strokeWidth="1.4" />
      <path d="M2.3 8.3c-.6-.15-1-.75-.85-1.35" stroke="#D94BF0" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M21.7 8.3c.6-.15 1-.75.85-1.35" stroke="#D94BF0" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <rect x="3" y="9.5" width="18" height="5" rx="2.5" fill="#D94BF0" />
    </svg>
  );
  return null;
}

/* Puzzle Rush and Rank Bot deliberately aren't tiles here anymore --
   Rush lives one level down inside Puzzles (same as in the app itself),
   and Rank Bot graduated to its own spotlight in the Features section
   below instead of competing for space as a 6th icon. */
const MODES = [
  { id: "play", label: "Play vs Bot", desc: "Challenge ZLEGEND2700 at any Elo. Can you beat it?", custom: true, featured: true },
  { id: "puzzles", label: "Puzzles", desc: "Solve rated tactics from Beginner to Expert.", icon: ICONS.puzzle },
  { id: "openings", label: "Openings Library", desc: "Study Italian, Sicilian, Ruy Lopez and more.", custom: true },
  { id: "spectate", label: "Spectate Bots", desc: "Watch two bots battle. No clicking required.", icon: ICONS.eye },
  { id: "blind", label: "Blind Chess", desc: "Play a full game by voice only. No board.", custom: true },
  { id: "lessons", label: "Lessons", desc: "Structured lessons to level up your game.", icon: ICONS.cap,
    comingSoon: "Lessons are coming soon — we're putting the curriculum together." },
];

/* The one mode this page spotlights instead of tiling -- same label/desc
   Rank Bot has always used elsewhere in the app (see App.jsx's
   DIFFICULTIES), reused verbatim here rather than writing new copy. */
const RANK_FEATURE = { id: "rank", label: "Rank Bot", desc: "An adaptive bot that estimates your rating as you play.", icon: ICONS.star };

const ACCENT = {
  play: { text: "text-[#F5D93E]", bg: "bg-[#F5D93E1F] group-hover:bg-[#F5D93E33]", border: "border-[#F5D93E4D] group-hover:border-[#F5D93E99]" },
  gold: { text: "text-[#F5D93E]", bg: "bg-[#F5D93E1A] group-hover:bg-[#F5D93E2E]", border: "border-[#F5D93E33] group-hover:border-[#F5D93E80]" },
  cyan: { text: "text-[#3EE7F5]", bg: "bg-[#3EE7F51A] group-hover:bg-[#3EE7F52E]", border: "border-[#3EE7F533] group-hover:border-[#3EE7F580]" },
};
const accentFor = (m) => (m.featured ? ACCENT.play : ACCENT.cyan);

/** The site's front door -- our real branding/hero (same .hdr markup the
 *  Play screen used to open with), then a mode picker grid, then the
 *  socials section. Fresh Tailwind-only markup below the hero so it
 *  can't collide with any of the existing hand-written CSS (see
 *  vite.config.js's Tailwind comment for why that's safe here). Reuses
 *  the .root shell (dark gradient bg, color variables, safe-area
 *  padding) as its outer wrapper purely for free theming -- .root's own
 *  CSS never targets descendants by type/class the way e.g. .promoBox
 *  does, so nesting new markup inside it can't be fought by anything. */
export default function HomePage({ onEnter }) {
  /* Donate/Contact have no real destination yet ("later will flesh out a
     contact page and set up donations") -- onEnter only knows the modes
     App.jsx's enterMode handles, and silently falls through to the Play
     screen for anything else, which would be a confusing bait-and-switch
     for a button that says Donate. A local toast instead of routing
     through onEnter keeps them honest about not being wired up yet. */
  const [comingSoon, setComingSoon] = useState(null);
  return (
    <div className="root">
      <StarField />
      <div className="hdr">
        <h1>Zlegend's Chess Bot</h1>
        <div className="sub">can you beat it??</div>
      </div>

      <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-[#CBBDF0]">
        A custom chess engine that adapts, attacks, and surprises. Challenge it at any level — or train until you can.
      </p>

      {/* App-icon style grid -- big square tiles (icon + label only, no
          description) rather than the horizontal list-style cards this
          used to be, per the "should look like a home screen" direction. */}
      <div className="mt-11 w-full max-w-4xl">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#9D8FC4]">Choose a mode</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const a = accentFor(m);
            return (
              <button
                key={m.id}
                onClick={() => (m.comingSoon ? setComingSoon(m.comingSoon) : onEnter(m.id))}
                className={`group flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border ${a.border} bg-[#1D1038CC] p-4 text-center backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[#1D1038E6] hover:shadow-[0_8px_24px_#3EE7F522]`}
              >
                <span className="flex h-14 shrink-0 items-center justify-center">
                  {m.custom ? renderIcon(m.id) : (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className={a.text} aria-hidden="true"><path d={m.icon} /></svg>
                  )}
                </span>
                <span className="text-sm font-bold leading-tight text-[#F4EFFF]">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Features -- spotlights one implemented mode at a time rather than
          competing for space as another grid tile; Rank Bot for now. */}
      <div className="mt-10 w-full max-w-4xl">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#9D8FC4]">Features</h2>
        <button
          onClick={() => onEnter(RANK_FEATURE.id)}
          className="group flex w-full flex-col items-center gap-4 rounded-3xl border border-[#F5D93E4D] bg-gradient-to-br from-[#1D1038CC] to-[#2A1F0EE6] p-6 text-center backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#F5D93E99] sm:flex-row sm:text-left"
        >
          <span className="flex h-16 shrink-0 items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="text-[#F5D93E]" aria-hidden="true"><path d={RANK_FEATURE.icon} /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5D93E]">New Feature</span>
            <span className="mt-1 block text-lg font-bold text-[#F4EFFF]">{RANK_FEATURE.label}</span>
            <span className="mt-1 block text-sm leading-relaxed text-[#9D8FC4]">{RANK_FEATURE.desc}</span>
          </span>
        </button>
      </div>

      {/* Leaderboard and Settings are both links out to their own page/modal
          (App.jsx routes "leaderboard" straight to LeaderboardPage; enterMode
          opens Settings the same way) rather than mode-grid tiles -- neither
          is a mode you "enter" the way Play/Puzzles/etc. are, so they get
          their own small row instead. */}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={() => onEnter("leaderboard")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#8B2FC94D] bg-[#1D1038CC] px-5 py-2 text-sm font-bold text-[#CBBDF0] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#8B2FC999] hover:text-[#F4EFFF]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICONS.trophy} /></svg>
          Leaderboard
        </button>
        <button
          onClick={() => onEnter("settings")}
          aria-label="Settings"
          title="Settings"
          className="flex size-9 items-center justify-center rounded-xl border border-[#8B2FC94D] bg-[#1D1038CC] text-[#CBBDF0] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#8B2FC999] hover:text-[#F4EFFF]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICONS.cog} /></svg>
        </button>
      </div>

      <SocialBanner />

      {/* Demoted from button-weight CTAs to plain text links -- neither
         goes anywhere real yet (still just a "coming soon" toast), and a
         gold/cyan bordered button next to Leaderboard read as an equally
         real destination. Footer-level text is honest about that without
         hiding them. */}
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs">
        <button
          onClick={() => setComingSoon("Donations are coming soon — thanks for wanting to support the project!")}
          className="bg-transparent font-bold text-[#9D8FC4] underline decoration-dotted underline-offset-4 transition-colors hover:text-[#F5D93E]"
        >
          Donate
        </button>
        <button
          onClick={() => setComingSoon("A contact page is coming soon.")}
          className="bg-transparent font-bold text-[#9D8FC4] underline decoration-dotted underline-offset-4 transition-colors hover:text-[#3EE7F5]"
        >
          Contact
        </button>
      </div>
      {comingSoon && (
        <p className="mt-2 mb-1 max-w-xs text-center text-xs text-[#9D8FC4]">{comingSoon}</p>
      )}

      <footer className="mt-2 pb-6 text-center text-xs text-[#9D8FC4]">
        Built by <a href="https://www.youtube.com/@Zlegend27" target="_blank" rel="noopener noreferrer" className="text-[#3EE7F5] hover:underline">Zlegend27</a> — all rights reserved.
      </footer>
    </div>
  );
}
