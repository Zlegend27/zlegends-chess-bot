/* ================================================================
   Theory Trainer -- a bot whose sole purpose is drilling this
   lesson's opening repertoire into you.

   You play Black (the repertoire side). While the game still matches
   any of the lesson's named repertoire lines, the bot plays WHITE's
   moves straight from those lines (picking randomly among matching
   lines, so different runs walk different branches). The moment your
   move leaves every known line, it flags what the repertoire move was
   and offers an undo -- or lets you play on, with the vendored
   Stockfish worker taking over White at a strength you pick.

   Own engine instance, same isolation convention as LessonPlayer /
   BlindMode -- can't disturb the main Play board.
   ================================================================ */

import { useEffect, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { replayIntoEngine } from "../utils/share";
import LessonBoard from "./LessonBoard";

const STRENGTHS = [
  { elo: 1320, label: "Relaxed (1320)" },
  { elo: 1700, label: "Club (1700)" },
  { elo: 2200, label: "Tough (2200)" },
];

const linesMatching = (repertoire, moves) =>
  repertoire.filter(r => r.line.length >= moves.length && moves.every((m, i) => r.line[i] === m));

export default function TheoryTrainer({ lesson, pieceSetId, onExit }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [moves, setMoves] = useState([]);
  const [, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [elo, setElo] = useState(1320);
  const [botThinking, setBotThinking] = useState(false);
  const [deviation, setDeviation] = useState(null); // { expected: [san], atIndex } | null
  const [result, setResult] = useState(null);

  useEffect(() => { warmUpStockfish(); }, []);

  const rebuild = (moveList) => {
    eng.reset();
    replayIntoEngine(eng, moveList);
    setMoves(moveList);
    setSelected(-1); setTargets([]);
    if (moveList.length) {
      const probe = createEngine();
      replayIntoEngine(probe, moveList.slice(0, -1));
      const mv = probe.legalMoves().find(m => probe.sanOf(m) === moveList[moveList.length - 1]);
      setLastMove(mv ? { from: mFrom(mv), to: mTo(mv) } : null);
    } else setLastMove(null);
    setResult(checkOver(moveList));
    rerender();
  };

  function checkOver() {
    if (eng.legalMoves().length === 0) {
      return eng.inCheckNow()
        ? (eng.getSide() === 1 ? "Checkmate — you win!" : "Checkmate — the bot wins.")
        : "Stalemate — draw.";
    }
    if (eng.halfClock() >= 100) return "Draw — fifty-move rule.";
    if (eng.repetitionCount() >= 3) return "Draw — threefold repetition.";
    if (eng.insufficientMaterial()) return "Draw — insufficient material.";
    return null;
  }

  const inBookLines = linesMatching(lesson.repertoire, moves);
  const inBook = inBookLines.length > 0;

  /* Bot (White) moves whenever it's White's turn and the game is live.
     From the book while any repertoire line still matches (random pick
     among matches for variety), from the engine once out of book. The
     cancelled flag makes this safe under StrictMode's double-invoke and
     abandoned turns (user undid before the reply landed). */
  useEffect(() => {
    if (result || botThinking) return;
    if (moves.length % 2 !== 0) return; // Black (the student) to move
    let cancelled = false;
    setBotThinking(true);
    const playSan = (san) => {
      if (cancelled) return;
      const mv = eng.legalMoves().find(m => eng.sanOf(m) === san);
      if (mv) {
        eng.make(mv);
        setLastMove({ from: mFrom(mv), to: mTo(mv) });
        setMoves(prev => [...prev, san]);
        setResult(checkOver());
      }
      setBotThinking(false);
    };
    const bookOptions = inBookLines
      .filter(r => r.line.length > moves.length)
      .map(r => r.line[moves.length]);
    if (bookOptions.length) {
      const san = bookOptions[(Math.random() * bookOptions.length) | 0];
      setTimeout(() => playSan(san), 650);
    } else {
      stockfishBestMove(eng.fen(), elo, 750).then(({ uci }) => {
        if (cancelled || !uci) { setBotThinking(false); return; }
        let mv = null;
        try { mv = eng.moveFromUci(uci); } catch { /* fall through */ }
        if (mv) playSan(eng.sanOf(mv));
        else setBotThinking(false);
      }).catch(() => { if (!cancelled) setBotThinking(false); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length, result]);

  const onSquare = (i64) => {
    if (result || botThinking || moves.length % 2 === 0) return; // not the student's turn
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const from120 = M64TO120[selected];
      const cand = legal.filter(m => mFrom(m) === from120 && mTo(m) === sq120);
      if (cand.length > 0) {
        const san = eng.sanOf(cand[0]);
        /* Book check happens BEFORE the move commits: which lines match
           now, and would any still match with this move appended? */
        const before = linesMatching(lesson.repertoire, moves);
        const stillBook = before.some(r => r.line.length > moves.length && r.line[moves.length] === san);
        if (before.length && !stillBook) {
          const expected = [...new Set(before.filter(r => r.line.length > moves.length).map(r => r.line[moves.length]))];
          setDeviation({ expected, atIndex: moves.length });
        } else {
          setDeviation(null);
        }
        eng.make(cand[0]);
        setLastMove({ from: mFrom(cand[0]), to: mTo(cand[0]) });
        setMoves(prev => [...prev, san]);
        setSelected(-1); setTargets([]);
        setResult(checkOver());
        return;
      }
    }
    const p = eng.pieceAt(i64);
    if (p !== 0 && p * eng.getSide() > 0) {
      setSelected(i64);
      setTargets(legal.filter(m => mFrom(m) === sq120).map(m => M120TO64[mTo(m)]));
    } else { setSelected(-1); setTargets([]); }
  };

  const undoDeviation = () => {
    if (!deviation) return;
    rebuild(moves.slice(0, deviation.atIndex));
    setDeviation(null);
  };

  const restart = () => {
    setDeviation(null);
    setResult(null);
    rebuild([]);
  };

  return (
    <div className="layout">
      <div className="boardCol">
        <LessonBoard eng={eng} orientation={lesson.orientation || "black"} selected={selected} targets={targets}
          lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} />
      </div>

      <div className="panel lessonPanel">
        <div className="box lessonBox">
          <div className="lessonCoachHead">
            <img src={lesson.cover || "/lesson-coach.webp"} alt="" className="lessonCoachImg" />
            <div className="lessonCoachMeta">
              <div className="lessonCoachName">Accelerated Dragon</div>
              <div className="lessonBeatCount">Theory Trainer · you play Black</div>
            </div>
          </div>

          {result ? (
            <p className="lessonPrompt">{result}</p>
          ) : deviation ? (
            <>
              <p className="lessonTriedFeedback">
                Off the repertoire — the move here was{" "}
                <b style={{ color: "var(--cyan)" }}>{deviation.expected.join(" or ")}</b>.
              </p>
              <p className="lessonHint">Undo to stay in the lines, or keep playing — the engine takes over White's moves from here.</p>
              <button className="btn ghost" onClick={undoDeviation}>↩ Undo & try the book move</button>
            </>
          ) : inBook ? (
            <>
              <p className="lessonPrompt">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 5 }}>
                  <path d="M12 21.5c-1.6-1.2-3.6-2-6-2-1.4 0-2.9.3-4 1V4.5C3.1 4 4.6 3.5 6 3.5c2.4 0 4.4.9 6 2v16zm0-16c1.6-1.1 3.6-2 6-2 1.4 0 2.9.5 4 1v16c-1.1-.7-2.6-1-4-1-2.4 0-4.4.8-6 2v-16z" />
                </svg>
                In book
              </p>
              <p className="lessonText">
                Following: {inBookLines.map(r => r.name).join(" · ")}
              </p>
              {botThinking && <p className="lessonHint">Thinking…</p>}
            </>
          ) : (
            <>
              <p className="lessonPrompt">Out of book</p>
              <p className="lessonText">Known theory has run out — the engine plays White from here. Convert your opening edge!</p>
              {botThinking && <p className="lessonHint">Thinking…</p>}
            </>
          )}

          <div className="lessonNav" style={{ alignItems: "center" }}>
            <select value={elo} onChange={e => setElo(Number(e.target.value))} aria-label="Bot strength once out of book">
              {STRENGTHS.map(s => <option key={s.elo} value={s.elo}>{s.label}</option>)}
            </select>
            <button className="btn ghost" onClick={restart}>Restart</button>
          </div>
        </div>
        <button className="btn ghost lessonExit" onClick={onExit}>Exit trainer</button>
      </div>
    </div>
  );
}
