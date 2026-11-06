/* ================================================================
   Vienna Trainer -- drills the Vienna Gambit as White against the
   replies real players make.

   A line has two stages:
   - Known theory. Black's moves come from real Lichess games, picked by
     how often players at the chosen level made them
     (src/data/viennaRepertoire.json, built by scripts/vienna/). White's
     move is checked against the repertoire: the right move plays on, a
     sound alternative gets a nudge back to the repertoire, anything
     else is sent back with "Try again" or "Show me". Missed lines are
     remembered and come back more often.
   - Past theory, to move 20. Maia plays Black like a player at the
     chosen level, and Stockfish checks each White move: one clearly
     worse than its best is sent back the same way.
   "Play on anyway" leaves both stages for free play against Stockfish.

   Own engine instance, same isolation as TheoryTrainer.
   ================================================================ */

import { useEffect, useRef, useState } from "react";
import { createEngine, M64TO120, M120TO64, mFrom, mTo } from "../engine/chessEngine";
import { stockfishAnalyze, stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { maiaChances, warmMaia } from "../engine/maiaEngine";
import { replayIntoEngine } from "../utils/share";
import { loadSetting, saveSetting } from "../utils/storage";
import { loadEcoOpenings, detectEcoOpening } from "../utils/ecoOpenings";
import {
  BANDS, VARIETY, EXTEND_TO_PLY, ENGINE_MISS_CP, keyOf, nodeAt, pickReply, pickByChance,
  judgeMove, updateWeak, pawnsText, uciOf,
} from "../utils/viennaTrainer";
import { fullMoves } from "../utils/moveNumber";
import book from "../data/viennaRepertoire.json";
import LessonBoard from "./LessonBoard";

const REPLY_DELAY_MS = 650;
const CHECK_MS = 700;

/** How many half-moves into `moves` known theory ran: the book covers every
 *  position before that point and none after. */
function theoryLength(moves) {
  let n = 0;
  while (n < moves.length && nodeAt(book, moves.slice(0, n + 1))) n++;
  return n + 1;
}

export default function ViennaTrainer({ pieceSetId, onExit }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [moves, setMoves] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [band, setBand] = useState(() => { const b = loadSetting("viennaBand", 0); return BANDS[b] ? b : 0; });
  const [varietyId, setVarietyId] = useState(() => { const v = loadSetting("viennaVariety", "mixed"); return VARIETY.some((x) => x.id === v) ? v : "mixed"; });
  const [weak, setWeak] = useState(() => loadSetting("viennaWeak", {}));
  /* What the panel is explaining. "checking", "wrong" and "ok" hold up
     Black's reply until they're resolved; "shown" and null don't. */
  const [feedback, setFeedback] = useState(null);
  const [hint, setHint] = useState(null);
  const [offBook, setOffBook] = useState(false);
  const [missedHere, setMissedHere] = useState(false);
  const [lineMisses, setLineMisses] = useState(0);
  const [stats, setStats] = useState({ lines: 0, right: 0, asked: 0 });
  const [botThinking, setBotThinking] = useState(false);
  const [result, setResult] = useState(null);
  const [eco, setEco] = useState(null);
  /* Bumped on every restart and take-back, so a Stockfish check that
     finishes afterwards is ignored. */
  const epochRef = useRef(0);

  useEffect(() => { warmUpStockfish(); warmMaia(); loadEcoOpenings().then(setEco); }, []);
  useEffect(() => { saveSetting("viennaBand", band); }, [band]);
  useEffect(() => { saveSetting("viennaVariety", varietyId); }, [varietyId]);
  useEffect(() => { saveSetting("viennaWeak", weak); }, [weak]);

  const node = offBook ? null : nodeAt(book, moves);
  const whiteToMove = moves.length % 2 === 0;
  const waiting = ["checking", "wrong", "ok"].includes(feedback?.type);
  const pastTheory = !offBook && !node && moves.length > 0;
  /* Past theory the line runs on to move 20. A move still waiting on the
     player's answer hasn't ended anything yet. */
  const lineDone = pastTheory && !waiting && (moves.length >= EXTEND_TO_PLY || !!result);
  const theoryEnd = pastTheory ? theoryLength(moves) : null;

  function checkOver() {
    if (eng.legalMoves().length === 0) {
      return eng.inCheckNow() ? (eng.getSide() === 1 ? "Checkmate — Black wins." : "Checkmate — you win!") : "Stalemate — draw.";
    }
    if (eng.halfClock() >= 100) return "Draw — fifty-move rule.";
    if (eng.repetitionCount() >= 3) return "Draw — threefold repetition.";
    if (eng.insufficientMaterial()) return "Draw — insufficient material.";
    return null;
  }

  const lastOf = (list) => {
    if (!list.length) return null;
    const probe = createEngine();
    replayIntoEngine(probe, list.slice(0, -1));
    const mv = probe.legalMoves().find((m) => probe.sanOf(m) === list[list.length - 1]);
    return mv ? { from: mFrom(mv), to: mTo(mv) } : null;
  };

  const rebuild = (list) => {
    epochRef.current++;
    eng.reset();
    replayIntoEngine(eng, list);
    setMoves(list);
    setLastMove(lastOf(list));
    setSelected(-1);
    setTargets([]);
    setResult(checkOver());
  };

  const play = (mv) => {
    const san = eng.sanOf(mv);
    eng.make(mv);
    setLastMove({ from: mFrom(mv), to: mTo(mv) });
    setMoves((prev) => [...prev, san]);
    setSelected(-1);
    setTargets([]);
    setResult(checkOver());
    return san;
  };

  /* A finished line counts once. */
  const countedRef = useRef(false);
  useEffect(() => {
    if (lineDone && !countedRef.current) {
      countedRef.current = true;
      setStats((s) => ({ ...s, lines: s.lines + 1 }));
    }
  }, [lineDone]);

  /* Black moves whenever it's Black's turn and nothing is waiting on the
     player: from real games in theory, from Maia past it, from Stockfish
     in free play. */
  useEffect(() => {
    if (result || whiteToMove || waiting || lineDone) return;
    let cancelled = false;
    setBotThinking(true);
    const finish = (mv) => {
      if (!cancelled && mv !== undefined && mv !== null) play(mv);
      if (!cancelled) setBotThinking(false);
    };
    const byStockfish = () => stockfishBestMove(eng.fen(), BANDS[band].elo, 750).then(({ uci }) => {
      let mv = null;
      try { mv = uci ? eng.moveFromUci(uci) : null; } catch { /* no move */ }
      finish(mv);
    }).catch(() => finish(null));

    if (node?.r) {
      const san = pickReply(node, moves, { band, power: VARIETY.find((v) => v.id === varietyId).power, weak });
      const timer = setTimeout(() => finish(eng.legalMoves().find((m) => eng.sanOf(m) === san)), REPLY_DELAY_MS);
      return () => { cancelled = true; clearTimeout(timer); };
    }
    if (pastTheory) {
      const legal = eng.legalMoves();
      const level = BANDS[band].maia;
      maiaChances(eng.fen(), level, level, legal.map(uciOf))
        .then((chances) => {
          const uci = pickByChance(chances);
          const mv = legal.find((m) => uciOf(m) === uci);
          if (mv === undefined) byStockfish();
          else finish(mv);
        })
        .catch(byStockfish);
      return () => { cancelled = true; };
    }
    byStockfish();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length, result, waiting, lineDone, offBook]);

  const onSquare = (i64) => {
    if (result || botThinking || waiting || lineDone || !whiteToMove) return;
    const legal = eng.legalMoves();
    const sq120 = M64TO120[i64];
    if (selected >= 0) {
      const cand = legal.filter((m) => mFrom(m) === M64TO120[selected] && mTo(m) === sq120);
      if (cand.length) { userMove(cand[0]); return; }
    }
    const p = eng.pieceAt(i64);
    if (p > 0) {
      setSelected(i64);
      setTargets(legal.filter((m) => mFrom(m) === sq120).map((m) => M120TO64[mTo(m)]));
    } else {
      setSelected(-1);
      setTargets([]);
    }
  };

  /* Each position counts once for "first try": right if the expected move
     came first, missed if anything else did, even a sound move. */
  const scoreRight = (key) => {
    if (!missedHere) {
      if (key != null) setWeak((w) => updateWeak(w, key, true));
      setStats((s) => ({ ...s, asked: s.asked + 1, right: s.right + 1 }));
    }
    setMissedHere(false);
    setFeedback(null);
  };
  const scoreMiss = (key) => {
    if (!missedHere) {
      if (key != null) setWeak((w) => updateWeak(w, key, false));
      setStats((s) => ({ ...s, asked: s.asked + 1 }));
      setLineMisses((n) => n + 1);
    }
    setMissedHere(true);
  };

  const userMove = (mv) => {
    setHint(null);
    if (node?.w) {
      const key = keyOf(moves);
      const judged = judgeMove(node, eng.sanOf(mv));
      const san = play(mv);
      if (judged.verdict === "rep") { scoreRight(key); return; }
      scoreMiss(key);
      setFeedback(judged.verdict === "ok"
        ? { type: "ok", san, rep: judged.rep }
        : { type: "wrong", san, rep: judged.rep, loss: judged.loss, source: "book" });
      return;
    }
    if (!pastTheory) { play(mv); return; } // free play: anything goes

    /* Past theory: Stockfish compares the move with its own best. */
    const fen = eng.fen();
    const uci = uciOf(mv);
    const epoch = epochRef.current;
    const san = play(mv);
    setFeedback({ type: "checking" });
    (async () => {
      const best = await stockfishAnalyze(fen, { moveTimeMs: CHECK_MS });
      if (best.uci === uci) return { loss: 0 };
      const mine = await stockfishAnalyze(fen, { moveTimeMs: CHECK_MS, searchMoves: [uci] });
      return { loss: best.lines[0].score - mine.lines[0].score, bestUci: best.uci };
    })().then(({ loss, bestUci }) => {
      if (epoch !== epochRef.current) return;
      if (loss < ENGINE_MISS_CP) { scoreRight(null); return; }
      scoreMiss(null);
      const probe = createEngine();
      probe.loadFen(fen);
      const m = probe.legalMoves().find((x) => uciOf(x) === bestUci);
      setFeedback({ type: "wrong", san, rep: m === undefined ? null : probe.sanOf(m), loss, source: "engine" });
    }).catch(() => {
      /* No verdict (Stockfish failed): let the move stand. */
      if (epoch === epochRef.current) setFeedback(null);
    });
  };

  /* Takes back the player's last move; `reveal` outlines the expected move. */
  const takeBack = (reveal) => {
    const rep = feedback?.rep;
    rebuild(moves.slice(0, -1));
    if (reveal && rep) {
      const mv = eng.legalMoves().find((m) => eng.sanOf(m) === rep);
      if (mv) setHint({ from: mFrom(mv), to: mTo(mv) });
    }
    setFeedback(reveal && rep ? { type: "shown", rep } : null);
  };

  const keepPlaying = () => {
    setFeedback(null);
    setMissedHere(false);
    setOffBook(true);
  };

  const newLine = () => {
    countedRef.current = false;
    setFeedback(null);
    setHint(null);
    setOffBook(false);
    setMissedHere(false);
    setLineMisses(0);
    rebuild([]);
  };

  const opening = eco && moves.length ? detectEcoOpening(moves, eco) : null;
  const moveNo = `${fullMoves(moves.length + 1)}.`;
  const theoryNote = theoryEnd != null && `Known theory ended at move ${fullMoves(theoryEnd)}. Stockfish checks your moves from here to move ${fullMoves(EXTEND_TO_PLY)}.`;
  const asked = stats.asked;

  let panel;
  if (lineDone) {
    panel = (
      <>
        <p className="lessonPrompt">{result || "Line complete"}</p>
        <p className="lessonText">
          {lineMisses === 0
            ? "Every move first try."
            : `You missed ${lineMisses} ${lineMisses === 1 ? "move" : "moves"} in this line. Missed theory comes up more often until you've got it.`}
        </p>
        <div className="lessonNav">
          <button className="btn gold" onClick={newLine}>Next line</button>
          {!result && <button className="btn ghost" onClick={keepPlaying}>Play it out</button>}
        </div>
      </>
    );
  } else if (result) {
    panel = <p className="lessonPrompt">{result}</p>;
  } else if (feedback?.type === "checking") {
    panel = <p className="lessonHint">Checking your move…</p>;
  } else if (feedback?.type === "wrong") {
    panel = (
      <>
        <p className="lessonTriedFeedback">
          {feedback.source === "book"
            ? <>{feedback.san} isn't your Vienna move here.{feedback.loss != null && feedback.loss >= 50 && ` Stockfish rates it ${pawnsText(feedback.loss)} worse.`}</>
            : `${feedback.san} is ${pawnsText(feedback.loss)} worse than Stockfish's choice.`}
        </p>
        <p className="lessonHint">Take it back and find a better move.</p>
        <div className="lessonNav">
          <button className="btn gold" onClick={() => takeBack(false)}>Try again</button>
          {feedback.rep && <button className="btn ghost" onClick={() => takeBack(true)}>Show me</button>}
        </div>
        <button className="border-0 bg-transparent p-0 text-xs underline" style={{ color: "var(--dim)" }} onClick={keepPlaying}>Play on from here anyway</button>
      </>
    );
  } else if (feedback?.type === "ok") {
    panel = (
      <>
        <p className="lessonTriedFeedback">
          {feedback.san} is playable, but your repertoire plays <b style={{ color: "var(--cyan)" }}>{feedback.rep}</b> here.
        </p>
        <div className="lessonNav">
          <button className="btn gold" onClick={() => takeBack(false)}>Play {feedback.rep} instead</button>
          <button className="btn ghost" onClick={keepPlaying}>Keep {feedback.san}</button>
        </div>
      </>
    );
  } else if (offBook) {
    panel = (
      <>
        <p className="lessonPrompt">Free play</p>
        <p className="lessonText">Stockfish plays Black at your chosen level. Your moves aren't checked.</p>
        {botThinking && <p className="lessonHint">Thinking…</p>}
      </>
    );
  } else if (whiteToMove) {
    panel = (
      <>
        <p className="lessonPrompt">Your move: {moveNo}</p>
        {feedback?.type === "shown" ? (
          <p className="lessonText">The move is <b style={{ color: "var(--yellow)" }}>{feedback.rep}</b>, outlined in gold. Play it to continue.</p>
        ) : node?.w?.punish ? (
          <p className="lessonText">Black's last move was a mistake. Find the move that punishes it.</p>
        ) : pastTheory ? (
          <p className="lessonText">{theoryNote}</p>
        ) : (
          <p className="lessonText">Play the Vienna Gambit move.</p>
        )}
      </>
    );
  } else {
    panel = <p className="lessonHint">Black is thinking…</p>;
  }

  return (
    <div className="layout">
      <div className="boardCol">
        <LessonBoard eng={eng} orientation="white" selected={selected} targets={targets}
          lastMove={lastMove} onSquare={onSquare} pieceSetId={pieceSetId} hint={hint} />
      </div>

      <div className="panel lessonPanel">
        <div className="box lessonBox">
          <div className="lessonCoachMeta">
            {/* Opening names run long ("Vienna Gambit, with Max Lange Defense"),
                unlike the coach names this class was made for. */}
            <div className="lessonCoachName" style={{ whiteSpace: "normal" }}>{opening ? opening.name : "Vienna Game"}</div>
            <div className="lessonBeatCount">
              Lines finished: {stats.lines} · First try: {asked ? `${stats.right}/${asked}` : "–"}
            </div>
          </div>

          {panel}

          <div className="lessonNav" style={{ alignItems: "center" }}>
            <select value={band} onChange={(e) => setBand(Number(e.target.value))} aria-label="Opponent level">
              {BANDS.map((b, i) => <option key={b.label} value={i}>{b.label} ({b.detail})</option>)}
            </select>
            <select value={varietyId} onChange={(e) => setVarietyId(e.target.value)} aria-label="How often rare lines come up">
              {VARIETY.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            {!lineDone && <button className="btn ghost" onClick={newLine}>Restart</button>}
          </div>
        </div>
        <p className="lessonHint" style={{ marginTop: 8 }}>
          Black plays what real players chose in {book.games.toLocaleString()} Vienna games from Lichess.
        </p>
        <button className="btn ghost lessonExit" onClick={onExit}>Exit trainer</button>
      </div>
    </div>
  );
}
