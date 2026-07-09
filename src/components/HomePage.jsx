import StarField from "./StarField";
import SocialLinks from "./SocialLinks";

/* Same inline-SVG-path convention already used for the Juice Box/Puzzles/
   Spectate/Blind Chess icons elsewhere in the app (see App.jsx's icon
   row) -- kept consistent rather than pulling in an icon library just
   for this page. Puzzles/Spectate/Blind reuse those exact paths. */
const ICONS = {
  play: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14.5v-9l7 4.5-7 4.5z",
  puzzle: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z",
  book: "M6 2a2 2 0 0 0-2 2v16l8-4 8 4V4a2 2 0 0 0-2-2H6z",
  bolt: "M7 2v11h3v9l7-12h-4l4-8z",
  eye: "M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ear: "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z",
  star: "M12 2l2.9 6.9L22 9.6l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.6L2 9.6l7.1-.7L12 2z",
};

const MODES = [
  { id: "play", label: "Play vs Bot", desc: "Challenge ZLEGEND2700 at any Elo. Can you beat it?", icon: ICONS.play, featured: true },
  { id: "puzzles", label: "Puzzles", desc: "Solve rated tactics from Beginner to Expert.", icon: ICONS.puzzle },
  { id: "openings", label: "Openings Library", desc: "Study Italian, Sicilian, Ruy Lopez and more.", icon: ICONS.book },
  { id: "rush", label: "Puzzle Rush", desc: "Race the clock. How many can you solve?", icon: ICONS.bolt },
  { id: "spectate", label: "Spectate Bots", desc: "Watch two bots battle. No clicking required.", icon: ICONS.eye },
  { id: "blind", label: "Blind Chess", desc: "Play a full game by voice only. No board.", icon: ICONS.ear },
  { id: "rank", label: "Rank Bot", desc: "An adaptive bot that estimates your rating as you play.", icon: ICONS.star },
];

const ACCENT = {
  play: { text: "text-[#F5D93E]", bg: "bg-[#F5D93E1F] group-hover:bg-[#F5D93E33]", border: "border-[#F5D93E4D] group-hover:border-[#F5D93E99]" },
  gold: { text: "text-[#F5D93E]", bg: "bg-[#F5D93E1A] group-hover:bg-[#F5D93E2E]", border: "border-[#F5D93E33] group-hover:border-[#F5D93E80]" },
  cyan: { text: "text-[#3EE7F5]", bg: "bg-[#3EE7F51A] group-hover:bg-[#3EE7F52E]", border: "border-[#3EE7F533] group-hover:border-[#3EE7F580]" },
};
const accentFor = (m) => (m.featured ? ACCENT.play : m.id === "rush" || m.id === "rank" ? ACCENT.gold : ACCENT.cyan);

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
  return (
    <div className="root">
      <StarField />
      <div className="hdr">
        <div className="eyebrow"><span className="live" />Zlegend27<SocialLinks /></div>
        <h1>Zlegend's Chess Bot</h1>
        <div className="sub">can you beat it??</div>
      </div>

      <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-[#CBBDF0]">
        A custom chess engine that adapts, attacks, and surprises. Challenge it at any level — or train until you can.
      </p>

      <button
        onClick={() => onEnter("play")}
        className="mt-7 inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#FFE873] to-[#E0B93E] px-8 py-4 text-base font-bold text-[#3A2A00] shadow-[0_3px_0_#150C24,0_0_14px_#F5D93E66] transition hover:brightness-110 active:translate-y-0.5 active:shadow-[0_1px_0_#150C24,0_0_10px_#F5D93E66]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICONS.play} /></svg>
        Play Now
      </button>

      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        {[["Bot Rating", "~2700 Elo"], ["Game Modes", String(MODES.length)]].map(([label, value]) => (
          <div key={label} className="rounded-full border border-[#8B2FC966] bg-[#1D1038CC] px-4 py-1.5 text-xs">
            <span className="text-[#9D8FC4]">{label}: </span>
            <span className="font-bold text-[#F4EFFF]">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-11 w-full max-w-4xl">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#9D8FC4]">Choose a mode</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => {
            const a = accentFor(m);
            return (
              <button
                key={m.id}
                onClick={() => onEnter(m.id)}
                className={`group flex items-start gap-4 rounded-2xl border ${a.border} bg-[#1D1038CC] p-5 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[#1D1038E6] ${m.featured ? "sm:col-span-2 lg:col-span-1" : ""}`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors ${a.bg}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={a.text} aria-hidden="true"><path d={m.icon} /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[#F4EFFF]">{m.label}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-[#9D8FC4]">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 mb-4 w-full max-w-4xl">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#9D8FC4]">Follow Zlegend27</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "YouTube", handle: "@Zlegend27", href: "https://www.youtube.com/@Zlegend27", color: "#FF0000" },
            { label: "TikTok", handle: "@zlegend27", href: "https://www.tiktok.com/@zlegend27", color: "#69C9D0" },
            { label: "Discord", handle: "Join the server", href: "https://discord.gg/TQtfCVkYqa", color: "#5865F2" },
          ].map((s) => (
            <a
              key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-[#8B2FC94D] bg-[#1D1038CC] p-4 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#8B2FC999] hover:bg-[#1D1038E6]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.color}22` }}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-[#F4EFFF]">{s.label}</span>
                <span className="block text-sm text-[#9D8FC4]">{s.handle}</span>
              </span>
            </a>
          ))}
        </div>
      </div>

      <footer className="mt-6 pb-6 text-center text-xs text-[#9D8FC4]">
        Built by <a href="https://www.youtube.com/@Zlegend27" target="_blank" rel="noopener noreferrer" className="text-[#3EE7F5] hover:underline">Zlegend27</a> — all rights reserved.
      </footer>
    </div>
  );
}
