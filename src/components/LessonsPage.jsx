import { useEffect, useState } from "react";
import StarField from "./StarField";
import { TopNav } from "./ExploreNav";
import SocialBanner from "./SocialBanner";
import LessonPlayer from "./LessonPlayer";
import TheoryTrainer from "./TheoryTrainer";
import { LESSONS } from "../data/lessons";
import { loadSetting } from "../utils/storage";
import { warmUpStockfish } from "../engine/stockfishEngine";

/** Lessons: pick a lesson -> pick a chapter (or the Theory Trainer) ->
 *  the player/trainer takes over the board. Same page-not-modal,
 *  own-page-with-TopNav pattern as LeaderboardPage.jsx -- local state
 *  only, since nothing here touches the main Play board/engine. */
export default function LessonsPage({ onBack, onToolSelect, activeToolId, profile }) {
  const [lessonId, setLessonId] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(null);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const pieceSetId = loadSetting("pieceSet", "classic");

  /* Both the lesson player's "Analyze" and the trainer's out-of-book
     White lean on the Stockfish worker -- start the WASM download the
     moment someone lands on Lessons, same pattern the Play view uses. */
  useEffect(() => { warmUpStockfish(); }, []);

  const lesson = LESSONS.find(l => l.id === lessonId) || null;
  const chapter = lesson?.chapters.find(c => c.number === chapterNumber && !c.comingSoon) || null;

  const backLink = (label, onClick) => (
    <button
      onClick={onClick}
      className="mb-2 inline-flex items-center gap-1.5 self-start bg-transparent text-sm font-bold text-dim transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
      {label}
    </button>
  );

  if (lesson && trainerOpen) {
    return (
      <div className="root">
        <StarField />
        <TopNav onSelect={onToolSelect} active={activeToolId} profile={profile} />
        {backLink(lesson.title, () => setTrainerOpen(false))}
        <div className="hdr" style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 26 }}>Theory Trainer</h1>
          <div className="sub" style={{ fontSize: 12 }}>{lesson.title}</div>
        </div>
        <TheoryTrainer lesson={lesson} pieceSetId={pieceSetId} onExit={() => setTrainerOpen(false)} />
      </div>
    );
  }

  if (lesson && chapter) {
    return (
      <div className="root">
        <StarField />
        <TopNav onSelect={onToolSelect} active={activeToolId} profile={profile} />
        {backLink(lesson.title, () => setChapterNumber(null))}
        <div className="hdr" style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 26 }}>Chapter {chapter.number}</h1>
          <div className="sub" style={{ fontSize: 12 }}>{chapter.title}</div>
        </div>
        <LessonPlayer
          key={`${lesson.id}-${chapter.number}`}
          chapter={chapter}
          orientation={lesson.orientation || "white"}
          pieceSetId={pieceSetId}
          onExit={() => setChapterNumber(null)}
        />
      </div>
    );
  }

  return (
    <div className="root">
      <StarField />
      <TopNav onSelect={onToolSelect} active={activeToolId} profile={profile} />

      {backLink("Back", lesson ? () => setLessonId(null) : onBack)}

      <div className="hdr">
        <h1 style={{ fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {/* fill is an explicit color, not currentColor: .hdr h1 sets
              color:transparent (a background-clip:text gradient-title
              trick) -- currentColor would inherit that and render the
              icon fully invisible. */}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--cyan)" aria-hidden="true">
            <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L4.24 12.3 3 13l9 5 9-5-1.24-.7L12 16.5zM5 14.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z" />
          </svg>
          Lessons
        </h1>
        <div className="sub">{lesson ? lesson.title : "Pick a lesson"}</div>
      </div>

      <div className="mt-4 flex w-full max-w-md flex-col gap-3">
        {!lesson ? (
          LESSONS.map(l => {
            const ready = l.chapters.filter(c => !c.comingSoon).length;
            return (
              <button
                key={l.id}
                onClick={() => setLessonId(l.id)}
                className="flex items-center gap-3 rounded-2xl border border-violet/40 bg-panel/80 px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                {l.cover && (
                  <img src={l.cover} alt="" className="h-14 w-14 flex-none rounded-xl border border-violet/40 object-cover" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-paper">{l.title}</div>
                  <div className="mt-1 text-xs text-dim">{l.desc}</div>
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan">
                    {ready} of {l.chapters.length} chapters ready
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <>
            {lesson.chapters.map(c => (
              c.comingSoon ? (
                <div key={c.number}
                  className="rounded-2xl border border-violet/20 bg-panel/50 px-4 py-3 text-left opacity-60">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-dim">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" /></svg>
                    Chapter {c.number} · coming soon
                  </div>
                  <div className="mt-1 font-bold text-[#CBBDF0]">{c.title}</div>
                </div>
              ) : (
                <button
                  key={c.number}
                  onClick={() => setChapterNumber(c.number)}
                  className="rounded-2xl border border-violet/40 bg-panel/80 px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-yellow">Chapter {c.number}</div>
                  <div className="mt-1 font-bold text-paper">{c.title}</div>
                  <div className="mt-1 text-xs text-dim">{c.beats.length} interactive steps</div>
                </button>
              )
            ))}

            {lesson.repertoire?.length > 0 && (
              <button
                onClick={() => setTrainerOpen(true)}
                className="flex items-center gap-3 rounded-2xl border border-yellow/30 bg-gradient-to-br from-panel/80 to-[#2A1F0EE6] px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-yellow/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                {lesson.cover && (
                  <img src={lesson.cover} alt="" className="h-14 w-14 flex-none rounded-xl border border-yellow/30 object-cover" />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-yellow">Theory Trainer</div>
                  <div className="mt-1 font-bold text-paper">Play the repertoire vs the Accelerated Dragon</div>
                  <div className="mt-1 text-xs text-dim">
                    It plays White straight from the lesson's lines — leave the book and it tells you what the repertoire move was. Engine takes over once theory runs out.
                  </div>
                </div>
              </button>
            )}

            {lesson.resources?.length > 0 && (
              <div className="rounded-2xl border border-violet/40 bg-panel/80 px-4 py-3 backdrop-blur-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-dim">Go deeper</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {lesson.resources.map(r => (
                    <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-cyan hover:underline">
                      {r.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SocialBanner />
    </div>
  );
}
