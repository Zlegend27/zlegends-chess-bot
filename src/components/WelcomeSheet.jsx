import Modal from "./Modal";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";

/* The first thing a brand-new visitor sees: Zlegend2700 says hello and what
   the site is, in one screen, with one button to start. Shown once per
   browser (App.jsx decides when); returning players never see it. */
const FEATURES = [
  { icon: "M12 2a4 4 0 0 0-2.6 7.04L8 10.5V12h2c0 3-1.2 5-3 7h10c-1.8-2-3-4-3-7h2v-1.5l-1.4-1.46A4 4 0 0 0 12 2zM6 20h12v2H6z", title: "Play", text: "Bots from beginner to Rank Bot, who adapts to you as you play. Or a real person in the 1v1 lobby." },
  { icon: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z", title: "Puzzles", text: "A daily puzzle, ranked puzzles at your level, Puzzle Rush, and Chess Tactica on a 3D board." },
  { icon: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z", title: "Game Review", text: "Paste any game, even from Chess.com or Lichess, and see every move graded. Free." },
  { icon: "M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z", title: "Learn", text: "Twelve openings taught the right way: the ideas, the replies you'll meet, and how to punish mistakes." },
];

export default function WelcomeSheet({ open, onPlay, onClose }) {
  return (
    <Modal open={open} onClose={onClose} closeLabel="Close the welcome" maxWidth={420} style={{ width: "min(420px, 92vw)" }}>
      <div className="flex items-center gap-3">
        <PixelAvatar rows={ZPIX} pal={ZPAL} size={56} />
        <div className="min-w-0">
          <h2 className="boxHead m-0">Welcome, challenger</h2>
          <p className="m-0 mt-1 text-sm" style={{ color: "var(--white)" }}>I&apos;m Zlegend2700. This is my chess site: free, no ads, no account needed to play.</p>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex items-start gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--cyan)" aria-hidden="true" className="mt-0.5 flex-none"><path d={f.icon} /></svg>
            <span className="text-sm leading-relaxed" style={{ color: "var(--white)" }}>
              <b>{f.title}.</b> <span style={{ color: "var(--liliac)" }}>{f.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onPlay}>Play your first game</button>
      <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onClose}>Look around first</button>
    </Modal>
  );
}
