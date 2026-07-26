import { useEffect } from "react";
import StarField from "./StarField";
import { TopNav } from "./ExploreNav";
import SocialBanner from "./SocialBanner";

/** Sweetheart's own corner of the app -- the real landing page Daily/
 *  Ranked/Rush all fan out from now, replacing what used to be a plain
 *  3-row "Puzzles" modal. Rebuilt in her own rose/gold palette (the
 *  --sh-* tokens in tokens.css) rather than the game's usual violet/cyan,
 *  same art-directed exception as the heartbreak screen and the Ranked/
 *  Rush picker modals in App.jsx. Same page-shell pattern as
 *  LeaderboardPage.jsx (own Escape handling, TopNav/SocialBanner). */
export default function PuzzlesHomePage({ onBack, onDaily, onRanked, onRush, puzzlesReady, dailySolved, onToolSelect, activeToolId, profile }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const modes = [
    {
      id: "daily", onClick: onDaily,
      name: "Daily puzzle",
      desc: dailySolved ? "Solved today ✓" : "One puzzle, same for everyone today",
      icon: <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />,
    },
    {
      id: "ranked", onClick: onRanked,
      name: "Ranked puzzles",
      desc: "Pick a rating band, Beginner to Expert",
      icon: <path d="M12 2 2 12l10 10 10-10L12 2z" />,
    },
    {
      id: "rush", onClick: onRush,
      name: "Puzzle Rush",
      desc: "Race the clock, difficulty ramps as you solve",
      icon: <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66L13 3h1l-1 7h3.5c.49 0 .56.33.44.51C12.28 17.53 11 21 11 21z" />,
    },
  ];

  return (
    <div className="root">
      <StarField />
      <TopNav onSelect={onToolSelect} active={activeToolId} profile={profile} />

      <button
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1.5 self-start bg-transparent text-sm font-bold text-dim transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
        Back
      </button>

      <div className="w-full max-w-2xl">
        <div
          className="relative overflow-hidden rounded-3xl border p-7"
          style={{
            borderColor: "#F06BAE66",
            background: "linear-gradient(165deg, #3B1030 0%, #2A0C28 46%, #1D0A22 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-10 top-0 h-40 w-52 rounded-full"
            style={{ background: "radial-gradient(60% 60% at 100% 0%, #FFD86633, transparent 70%)" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-10 bottom-0 h-40 w-52 rounded-full"
            style={{ background: "radial-gradient(55% 60% at 0% 100%, #6FCFC022, transparent 70%)" }}
            aria-hidden="true"
          />

          <div className="relative mb-2 flex justify-center">
            <img src="/sweetheart-logo.webp" alt="Sweetheart's Castle" className="h-[86px] drop-shadow-[0_6px_18px_rgba(0,0,0,0.4)]" />
          </div>

          <div className="relative flex flex-wrap items-center gap-5">
            <div
              className="flex size-[168px] shrink-0 items-center justify-center rounded-full"
              style={{ background: "radial-gradient(closest-side, #F2A8CF3D 0%, #F2A8CF14 55%, transparent 78%)" }}
            >
              <img src="/sweetheart-angry.gif" alt="Sweetheart, unimpressed" className="w-[150px] drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]" />
            </div>
            <p className="min-w-[240px] flex-1 text-sm leading-relaxed" style={{ color: "#EBD3E4" }}>
              She's not mad. Okay, she's a little mad. Sharpen your tactics before she loses her patience —
              daily puzzles, ranked bands, or race the clock in Rush.
            </p>
          </div>

          <div className="relative mt-7 pt-8">
            {/* Horse Head and Sir Maximus loiter behind the mode row,
                half-cropped at the section edge like they wandered into
                frame -- decorative company, not controls (pointer-events
                none, z-index below the cards, never intercept clicks). */}
            <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
              <img src="/sweetheart-horse.webp" alt="" className="absolute -bottom-2.5 left-[6%] w-[58px] -rotate-[4deg] drop-shadow-[0_6px_10px_rgba(0,0,0,0.4)]" />
              <img src="/sweetheart-maximus.webp" alt="" className="absolute -bottom-2.5 right-[10%] w-[46px] rotate-[3deg] drop-shadow-[0_6px_10px_rgba(0,0,0,0.4)]" />
            </div>

            <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {modes.map((m, i) => (
                <button
                  key={m.id}
                  onClick={m.onClick}
                  disabled={!puzzlesReady}
                  className="flex flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition disabled:cursor-default disabled:opacity-50"
                  style={{
                    borderColor: i === 0 ? "#F06BAE" : "#F06BAE3D",
                    background: i === 0 ? "linear-gradient(160deg, #4A1740E0, #2A0C28E0)" : "#1D0A22CC",
                  }}
                >
                  <span className="flex size-8 items-center justify-center rounded-md" style={{ background: "#F06BAE26", color: "#F7C5E3" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{m.icon}</svg>
                  </span>
                  <span className="text-sm font-bold text-paper">{m.name}</span>
                  <span className="text-[11px] leading-relaxed" style={{ color: "var(--sh-dim)" }}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-6 flex gap-2" aria-hidden="true">
            <i className="block size-[11px] rotate-45 rounded-sm" style={{ background: "#E2536B" }} />
            <i className="block size-[11px] rotate-45 rounded-sm" style={{ background: "#8B6FD1" }} />
            <i className="block size-[11px] rotate-45 rounded-sm" style={{ background: "#F5D95E" }} />
            <i className="block size-[11px] rotate-45 rounded-sm" style={{ background: "#8B6FD1" }} />
          </div>

          {!puzzlesReady && (
            <p className="relative mt-4 text-center text-xs" style={{ color: "var(--sh-dim)" }}>Loading puzzles…</p>
          )}
        </div>
      </div>

      <SocialBanner />
    </div>
  );
}
