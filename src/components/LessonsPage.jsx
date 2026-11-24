import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { courseForPath, coursePath } from "../data/openingPages";
import { courseById } from "../data/openingCourses";
import { titleFor } from "../utils/routes";
import StarField from "./StarField";
import LessonPlayer from "./LessonPlayer";
/* Lazy: the Opening Trainer and its move trees load only when opened. */
const OpeningTrainer = lazy(() => import("./openings/OpeningTrainer"));
import { LESSONS } from "../data/lessons";
import { loadSetting } from "../utils/storage";
import { warmUpStockfish } from "../engine/stockfishEngine";
import { getUiTheme } from "../utils/uiTheme";
import { track } from "../utils/track";

/** Lessons: pick a lesson -> pick a chapter (or the Theory Trainer) ->
 *  the player/trainer takes over the board. Same page-not-modal,
 *  own-page pattern as LeaderboardPage.jsx -- local state
 *  only, since nothing here touches the main Play board/engine. */
export default function LessonsPage({ onOpenings, onBlind, sweetheart }) {
  const [lessonId, setLessonId] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(null);
  /* Arriving at an opening's own address (/openings/vienna-game) opens the
     trainer on that course. Read once, as the page opens. */
  const [startCourse] = useState(() => courseForPath(window.location.pathname)?.id ?? null);
  const [trainerOpen, setTrainerOpen] = useState(!!startCourse);
  /* The address follows the open course, so it can be shared or refreshed;
     the library and the rest of Learn are /lessons. Replaced, not pushed:
     back still goes straight to Home (see historyStep in routes.js). */
  const onCourseChange = useCallback((id) => {
    const course = courseById(id);
    const path = course ? coursePath(id) : "/lessons";
    if (window.location.pathname !== path) history.replaceState(history.state, "", path + window.location.search);
    document.title = course ? `${course.name} · Zlegend2700` : titleFor("lessons");
  }, []);
  const closeTrainer = () => { setTrainerOpen(false); onCourseChange(null); };
  const pieceSetId = loadSetting("pieceSet", "classic");
  const T = getUiTheme(sweetheart);
  const cardHoverBorder = sweetheart ? "hover:border-sh-lteal/50" : "hover:border-cyan/40";
  const mutedLabel = T.mutedLabel;
  const featureBorder = sweetheart ? "border-sh-lgold/40" : "border-yellow/30";
  const featureBorderHover = sweetheart ? "hover:border-sh-lgold/70" : "hover:border-yellow/60";
  const featureGradientFrom = sweetheart ? "from-sh-lcard/90" : "from-panel/80";
  const featureGradientTo = sweetheart ? "to-[#FFF3D9]" : "to-[#2A1F0EE6]";

  /* The lesson player's "Analyze" and the Opening Trainer's punishments
     lean on the Stockfish worker -- start the WASM download the moment
     someone lands on Learn, same pattern the Play view uses. */
  useEffect(() => { warmUpStockfish(); }, []);

  useEffect(() => { if (trainerOpen) track("trainer_open"); }, [trainerOpen]);
  useEffect(() => { if (lessonId && chapterNumber != null) track("lesson_open", { lesson: lessonId, chapter: chapterNumber }); }, [lessonId, chapterNumber]);

  const lesson = LESSONS.find(l => l.id === lessonId) || null;
  const chapter = lesson?.chapters.find(c => c.number === chapterNumber && !c.comingSoon) || null;

  const backLink = (label, onClick) => (
    <button
      onClick={onClick}
      className={`mb-2 inline-flex items-center gap-1.5 self-start border-0 bg-transparent text-sm font-bold ${T.dimText} transition-colors ${T.hoverInk} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" /></svg>
      {label}
    </button>
  );

  if (trainerOpen) {
    return (
      <div className="root">
        <StarField sweetheart={sweetheart} />
        <Suspense fallback={null}>
          <OpeningTrainer sweetheart={sweetheart} pieceSetId={pieceSetId} back={backLink("Learn", closeTrainer)} onLibrary={onOpenings} initialCourseId={startCourse} onCourseChange={onCourseChange} />
        </Suspense>
      </div>
    );
  }

  if (lesson && chapter) {
    return (
      <div className="root">
        <StarField sweetheart={sweetheart} />
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

  /* One course in the list: its picture if it has one, name, line, and how
     much of it is ready. */
  const courseCard = (l) => {
    const ready = l.chapters.filter(c => !c.comingSoon).length;
    return (
      <button
        key={l.id}
        onClick={() => setLessonId(l.id)}
        className={`flex items-center gap-3 rounded-2xl border ${T.cardBorder} ${T.panelBg} px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 ${cardHoverBorder} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
      >
        {l.cover && (
          <img src={l.cover} alt="" className={`h-14 w-14 flex-none rounded-xl border ${T.cardBorder} object-cover`} />
        )}
        <div className="min-w-0">
          <div className={"font-bold " + T.ink}>{l.title}</div>
          <div className={"mt-1 text-xs " + T.dimText}>{l.desc}</div>
          <div className={"mt-2 text-[11px] font-bold uppercase tracking-[0.14em] " + T.interactiveText}>
            {ready < l.chapters.length ? `Coming soon · ${ready === 1 ? "chapter 1" : `${ready} chapters`} open now` : `${ready} chapters`}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />

      {lesson && backLink("Back", () => setLessonId(null))}

      <div className="hdr">
        <h1 style={{ fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, paddingRight: "0.2em", paddingBottom: "0.1em" }}>
          {/* fill is an explicit color, not currentColor: .hdr h1 sets
              color:transparent (a background-clip:text gradient-title
              trick) -- currentColor would inherit that and render the
              icon fully invisible. */}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--cyan)" aria-hidden="true">
            <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L4.24 12.3 3 13l9 5 9-5-1.24-.7L12 16.5zM5 14.18v3.82c0 1.1 3.13 3 7 3s7-1.9 7-3v-3.82l-7 3.82-7-3.82z" />
          </svg>
          {lesson ? "Lessons" : "Learn"}
        </h1>
        {lesson && <div className="sub">{lesson.title}</div>}
      </div>

      {!lesson && (
        <div className="mt-1 flex w-full max-w-md items-center gap-3">
          <img src="/sweetheart-still.png" alt="" width="83" height="64" className="h-16 w-auto shrink-0" />
          <p className={`relative m-0 rounded-2xl border ${T.cardBorder} ${T.panelBg} px-4 py-2.5 text-sm font-bold ${T.ink}`}>Wanna learn something?</p>
        </div>
      )}

      <div className="mt-4 flex w-full max-w-md flex-col gap-3">
        {/* The beginner course leads: it's where someone new starts. */}
        {!lesson && LESSONS.filter((l) => l.id === "how-to-play").map((l) => courseCard(l))}
        {!lesson && (
          <button
            onClick={() => setTrainerOpen(true)}
            className={`rounded-2xl border ${featureBorder} bg-transparent bg-gradient-to-br ${featureGradientFrom} ${featureGradientTo} px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 ${featureBorderHover} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
          >
            <div className={"font-bold " + T.ink}>Opening Trainer</div>
            <div className={"mt-1 text-xs " + T.dimText}>Learn 12 openings the right way: the ideas, the replies players at your level make, and how to punish their mistakes. The openings library is in here too.</div>
          </button>
        )}
        {!lesson && onBlind && (
          <button type="button" onClick={onBlind}
            className={`rounded-2xl border ${T.cardBorder} ${T.panelBg} px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}>
            <div className={"font-bold " + T.ink}>Blind Chess Trainer</div>
            <div className={"mt-1 text-xs " + T.dimText}>See the board in your head: short drills with no board, by typing or by voice. Or play a whole game by voice.</div>
          </button>
        )}
        {!lesson ? (
          LESSONS.filter((l) => l.id !== "how-to-play").map((l) => courseCard(l))
        ) : (
          <>
            {lesson.chapters.map(c => (
              c.comingSoon ? (
                <div key={c.number}
                  className={`rounded-2xl border ${sweetheart ? "border-sh-rose/20 bg-sh-lcard/50" : "border-violet/20 bg-panel/50"} px-4 py-3 text-left opacity-60`}>
                  <div className={"flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] " + T.dimText}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" /></svg>
                    Chapter {c.number} · coming soon
                  </div>
                  <div className={"mt-1 font-bold " + mutedLabel}>{c.title}</div>
                </div>
              ) : (
                <button
                  key={c.number}
                  onClick={() => setChapterNumber(c.number)}
                  className={`rounded-2xl border ${T.cardBorder} ${T.panelBg} px-4 py-3 text-left backdrop-blur-sm transition hover:-translate-y-0.5 ${cardHoverBorder} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
                >
                  <div className={"text-[11px] font-bold uppercase tracking-[0.14em] " + T.accentText}>Chapter {c.number}</div>
                  <div className={"mt-1 font-bold " + T.ink}>{c.title}</div>
                  <div className={"mt-1 text-xs " + T.dimText}>{c.beats.length} interactive steps</div>
                </button>
              )
            ))}

            {lesson.resources?.length > 0 && (
              <div className={`rounded-2xl border ${T.cardBorder} ${T.panelBg} px-4 py-3 backdrop-blur-sm`}>
                <div className={"text-[11px] font-bold uppercase tracking-[0.14em] " + T.dimText}>Go deeper</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {lesson.resources.map(r => (
                    <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                      className={"text-sm hover:underline " + T.interactiveText}>
                      {r.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
