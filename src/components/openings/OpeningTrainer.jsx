/* The Opening Trainer (Learn tab): a library of openings by side, each a
   short course (the idea, a quiz, the common scenarios, practice against
   the bot at three levels) plus a daily review of the moves you keep
   missing. It teaches each opening up to where it ends and what to aim for
   next; it doesn't string players into memorizing middlegames. */
import { useEffect, useMemo, useState } from "react";
import MiniBoard from "../MiniBoard";
import { COURSES, LEVELS, courseById } from "../../data/openingCourses";
import { NOTES } from "../../data/openingNotes";
import { getPieceSet } from "../../utils/pieceSets";
import { getBoardColor } from "../../utils/boardColors";
import { loadSetting, saveSetting } from "../../utils/storage";
import { getUiTheme } from "../../utils/uiTheme";
import { dueReviews, replyShares, nodeAt, scenarios } from "../../utils/openingTrainer";
import { engineAt, loadCourseData, loadProgress, lineProgress, loadReviews, movesText, Ring } from "./shared";
import PixelAvatar, { ZPAL, ZPIX } from "../PixelAvatar";
import OpeningSession from "./OpeningSession";

const STEPS = [
  { id: "idea", name: "The idea", text: "Plans, pawn structure and key squares" },
  { id: "quiz", name: "Quiz", text: "Find your moves in the main line" },
  { id: "scenarios", name: "Scenarios", text: "What players at your level reply, and how to answer" },
];

/* `back` is the link to Learn; it shows on the library only, since courses
   and sessions have their own way back. */
export default function OpeningTrainer({ sweetheart, pieceSetId, back = null }) {
  const T = getUiTheme(sweetheart);
  const pieceImgSrc = (type, isWhite) => getPieceSet(pieceSetId).svgUrl(type, isWhite);
  const colors = getBoardColor(loadSetting("boardColor", "default"));
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;

  const [side, setSide] = useState(() => loadSetting("openingSide", "white"));
  const [courseId, setCourseId] = useState(null);
  const [lineId, setLineId] = useState(null);
  const [level, setLevel] = useState(() => loadSetting("openingLevel", "medium"));
  const [session, setSession] = useState(null); // { mode }
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const [reviews, setReviews] = useState(loadReviews);

  const course = courseById(courseId);
  const line = course?.lines.find((l) => l.id === lineId) ?? course?.lines[0] ?? null;
  const due = dueReviews(reviews);

  useEffect(() => {
    if (!courseId) return;
    let live = true;
    setData(null);
    loadCourseData(courseId).then((d) => { if (live) setData(d); });
    return () => { live = false; };
  }, [courseId]);

  const pickSide = (s) => { setSide(s); saveSetting("openingSide", s); };
  const pickLevel = (l) => { setLevel(l); saveSetting("openingLevel", l); };
  const openCourse = (id) => { setCourseId(id); setLineId(courseById(id).lines[0].id); };
  const refresh = () => { setProgress(loadProgress()); setReviews(loadReviews()); };

  /* ---------------- A session (idea, quiz, scenarios, practice, review) ---------------- */
  if (session) {
    return (
      <OpeningSession
        mode={session.mode}
        course={course}
        line={line}
        data={data}
        level={level}
        reviewIds={session.mode === "review" ? due : null}
        sweetheart={sweetheart}
        pieceSetId={pieceSetId}
        onExit={() => { setSession(null); refresh(); }}
      />
    );
  }

  /* ---------------- A course page ---------------- */
  if (course) {
    const notes = NOTES[course.id] ?? {};
    const rootMoves = course.root.split(" ");
    const eng = engineAt(rootMoves);
    const nodes = data?.lines[line.id] ?? null;
    const p = progress[`${course.id}/${line.id}`];
    const levelIdx = LEVELS.find((l) => l.id === level).band;
    /* The first decision the opponent makes, as a chart of what players reply. */
    const firstOpp = nodes ? firstOpponentNode(nodes, rootMoves) : null;
    const chart = firstOpp ? replyShares(firstOpp.node, levelIdx).slice(0, 4) : [];
    const scenCount = nodes ? scenarios(nodes, rootMoves, levelIdx).length : 0;
    const stepState = (id) => (id === "idea" ? (p?.idea ? "done" : "todo")
      : id === "quiz" ? (p?.quiz >= 80 ? "done" : p?.quiz != null ? "now" : "todo")
      : (p?.scenarios?.length ?? 0) >= scenCount && scenCount ? "done" : p?.scenarios?.length ? "now" : "todo");
    const stepInfo = (id) => (id === "quiz" && p?.quiz != null ? `Best ${p.quiz}%` : id === "scenarios" && scenCount ? `${p?.scenarios?.length ?? 0} of ${scenCount} done` : STEPS.find((s) => s.id === id).text);
    return (
      <div className="flex w-full max-w-md flex-col gap-3">
        <button onClick={() => setCourseId(null)} className={`self-start border-0 bg-transparent p-0 text-sm font-bold ${T.dimText} ${focus}`}>← Opening Trainer</button>
        <section className={`grid grid-cols-[120px_1fr] items-center gap-4 rounded-2xl border p-4 ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`}>
          {eng && <MiniBoard fen={eng.fen()} colors={colors} pieceImgSrc={pieceImgSrc} size={120} flipped={course.side === "black"} label={`${course.name} position`} />}
          <div className="min-w-0">
            <h1 className={`m-0 text-[22px] leading-tight ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>{course.name}</h1>
            <p className={`m-0 mt-1 text-xs ${T.dimText}`} style={{ fontFamily: "var(--font-mono)" }}>{movesText(rootMoves)}</p>
            {notes.summary && <p className={`m-0 mt-2 text-sm leading-snug ${T.ink}`}>{notes.summary}</p>}
          </div>
        </section>

        {course.lines.length > 1 && (
          <div className="flex gap-2" role="tablist" aria-label="Line">
            {course.lines.map((l) => (
              <button key={l.id} role="tab" aria-selected={l.id === line.id} onClick={() => setLineId(l.id)}
                className={`flex-1 rounded-xl border px-2 py-2.5 text-sm font-bold ${l.id === line.id ? "border-cyan bg-cyan/10 text-paper" : `${T.cardBorder} bg-black/25 ${T.dimText}`} ${focus}`}>
                {l.name}
              </button>
            ))}
          </div>
        )}

        {!nodes && <p className={`m-0 text-sm ${T.dimText}`}>Loading the course…</p>}
        {nodes && (
          <>
            {STEPS.map((s, i) => {
              const st = stepState(s.id);
              return (
                <button key={s.id} onClick={() => setSession({ mode: s.id })}
                  className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${st === "now" ? "border-yellow/70 shadow-[0_8px_24px_rgba(245,217,62,.12)]" : T.cardBorder} ${T.panelBg} ${focus}`}>
                  <span className={`grid size-10 place-items-center rounded-xl text-base ${st === "done" ? "bg-cyan text-[#0b1a2a]" : st === "now" ? "bg-yellow text-[#2a2208]" : "bg-white/10 text-paper"}`} style={{ fontFamily: "var(--font-display)" }}>{st === "done" ? "✓" : i + 1}</span>
                  <span className="min-w-0">
                    <b className={`block text-sm ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>{s.name}</b>
                    <small className={`text-xs ${T.dimText}`}>{stepInfo(s.id)}</small>
                  </span>
                  <span className={`text-xs font-bold ${T.interactiveText}`}>{st === "done" ? "Review" : st === "now" ? "Continue" : "Start"}</span>
                </button>
              );
            })}

            {chart.length > 0 && (
              <section className={`rounded-2xl border p-4 ${T.cardBorder} ${T.panelBg}`}>
                <p className={`m-0 text-[11px] font-bold uppercase tracking-wider ${T.dimText}`}>After {movesText(firstOpp.moves, firstOpp.moves.length - 1)}, players around {LEVELS.find((l) => l.id === level).rating.replace("≈ ", "")} reply</p>
                {chart.map((r) => (
                  <div key={r.san} className="mt-2 grid grid-cols-[64px_1fr_40px] items-center gap-2 text-[13px]">
                    <span className={T.ink} style={{ fontFamily: "var(--font-mono)" }}>{r.san}</span>
                    <span className="h-2 rounded-full bg-white/10"><span className="block h-2 rounded-full bg-gradient-to-r from-violet to-magenta" style={{ width: `${Math.round(r.share * 100)}%` }} /></span>
                    <span className={`text-right ${T.dimText}`}>{Math.round(r.share * 100)}%</span>
                  </div>
                ))}
              </section>
            )}

            <section className={`rounded-2xl border p-4 ${T.cardBorder} ${T.panelBg}`}>
              <b className={`block text-sm ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>Practice</b>
              <small className={`text-xs ${T.dimText}`}>Play it out against the bot until the opening ends</small>
              <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Level">
                {LEVELS.map((l) => (
                  <button key={l.id} role="radio" aria-checked={l.id === level} onClick={() => pickLevel(l.id)}
                    className={`flex-1 rounded-xl border px-1 py-2 text-sm font-bold ${l.id === level ? "border-yellow bg-yellow/10" : `${T.cardBorder} bg-black/25`} ${T.ink} ${focus}`}>
                    {l.name}{p?.practice?.[l.id] ? " ✓" : ""}<small className={`block text-[11px] font-normal ${T.dimText}`}>{l.rating}</small>
                  </button>
                ))}
              </div>
              <button className="btn gold mt-3" style={{ width: "100%" }} onClick={() => setSession({ mode: "practice" })}>Practice the {line.name}</button>
            </section>
          </>
        )}
      </div>
    );
  }

  /* ---------------- The library ---------------- */
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {back}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`m-0 text-xs font-bold uppercase tracking-wider ${T.dimText}`}>Learn</p>
          <h1 className={`m-0 text-[26px] ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>Opening Trainer</h1>
        </div>
        <PixelAvatar rows={ZPIX} pal={ZPAL} size={52} />
      </div>

      <button disabled={!due.length} onClick={() => setSession({ mode: "review" })}
        className={`flex items-center gap-3 rounded-2xl border border-yellow/45 bg-gradient-to-br from-yellow/15 to-magenta/10 px-4 py-3 text-left disabled:cursor-default ${focus}`}>
        <span>
          <b className={`block text-sm ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>Daily review</b>
          <span className={`text-xs ${T.dimText}`}>{due.length ? "Moves you keep missing come back here" : "Nothing due. Moves you miss come back here."}</span>
        </span>
        <span className="ml-auto text-2xl text-yellow" style={{ fontFamily: "var(--font-display)" }}>{due.length}</span>
      </button>

      <div className="flex gap-1 rounded-full border border-white/15 bg-black/30 p-1" role="tablist" aria-label="Side">
        {["white", "black"].map((s) => (
          <button key={s} role="tab" aria-selected={side === s} onClick={() => pickSide(s)}
            className={`flex-1 rounded-full border-0 py-2 text-sm font-bold ${side === s ? "bg-paper text-void" : `bg-transparent ${T.dimText}`} ${focus}`}>
            As {s === "white" ? "White" : "Black"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COURSES.filter((c) => c.side === side).map((c) => <CourseTile key={c.id} course={c} progress={progress} colors={colors} pieceImgSrc={pieceImgSrc} T={T} focus={focus} onOpen={openCourse} />)}
      </div>
    </div>
  );
}

function CourseTile({ course, progress, colors, pieceImgSrc, T, focus, onOpen }) {
  const rootMoves = course.root.split(" ");
  const fen = useMemo(() => engineAt(rootMoves)?.fen(), [course.root]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = Math.max(...course.lines.map((l) => lineProgress(progress[`${course.id}/${l.id}`])));
  return (
    <button onClick={() => onOpen(course.id)}
      className={`flex flex-col gap-2 rounded-2xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:border-cyan/60 ${T.cardBorder} ${T.panelBg} ${focus}`}>
      <span className="relative block">
        {fen && <MiniBoard fen={fen} colors={colors} pieceImgSrc={pieceImgSrc} size={148} flipped={course.side === "black"} label={`${course.name} position`} />}
        <span className="absolute right-1.5 bottom-1.5"><Ring value={value} /></span>
      </span>
      <b className={`text-[13.5px] leading-tight ${T.ink}`} style={{ fontFamily: "var(--font-display)" }}>{course.name}</b>
      <span className={`text-[11px] ${T.dimText}`} style={{ fontFamily: "var(--font-mono)" }}>{movesText(rootMoves)}</span>
      {course.lines.length > 1 && (
        <span className="flex flex-wrap gap-1">
          {course.lines.slice(1).map((l) => <span key={l.id} className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[10.5px] font-bold text-cyan">{l.name}</span>)}
        </span>
      )}
    </button>
  );
}

/* The first position on the main path where the opponent chooses. */
function firstOpponentNode(nodes, start) {
  const moves = [...start];
  for (let i = 0; i < 6; i++) {
    const node = nodeAt(nodes, moves);
    if (!node) return null;
    if (node.o) return { node, moves };
    moves.push(node.p.rep);
  }
  return null;
}
