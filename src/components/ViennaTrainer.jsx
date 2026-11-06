/* ================================================================
   Vienna Trainer -- Zlegend27 drills the Vienna Gambit with you as
   White, against the replies real players make.

   Modelled on what works elsewhere: Chessable's learn-then-test loop
   (a new move is shown first and quizzed the next time it comes up,
   missed moves come back more often) and Chess.com's coach "Explain"
   (a line played out one move at a time, with the coach saying what
   each move does).

   A line has two stages:
   - Known theory. Black's moves come from real Lichess games at the
     chosen level (src/data/viennaRepertoire.json, built by
     scripts/vienna/), and White's move is checked against the
     repertoire. Zlegend27's notes on the key ideas live in
     src/data/viennaNotes.js.
   - Past theory, to move 20. Maia plays Black like a player at the
     chosen level, and Stockfish checks each White move.
   "Play it out" leaves both for free play against Stockfish.

   Own engine instance, same isolation as TheoryTrainer.
   ================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
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
import { explainLine, fullVerdict } from "../utils/explainLine";
import { fullMoves } from "../utils/moveNumber";
import { VIENNA_NOTES } from "../data/viennaNotes";
import book from "../data/viennaRepertoire.json";
import LessonBoard from "./LessonBoard";
import BotBubble from "./BotBubble";

const REPLY_DELAY_MS = 650;
const CHECK_MS = 700;
const EXPLAIN_STEP_MS = 2200;
const EXPLAIN_PLIES = 5;
const WHITE_ARROW = "#3EE7F5";
const BLACK_ARROW = "#D94BF0";
const HINT_ARROW = "#F5D93E";

/** "1. e4 e5 2. Nc3" for a list of SAN moves. */
function lineText(moves) {
  return moves.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(" ");
}

/** "3.f4" or "3...exf4": a move as chess books write it. */
const moveLabel = (ply, san) => `${fullMoves(ply + 1)}${ply % 2 === 0 ? "." : "..."}${san}`;

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
  const [mode, setMode] = useState(() => (loadSetting("viennaMode", "learn") === "test" ? "test" : "learn"));
  const [weak, setWeak] = useState(() => loadSetting("viennaWeak", {}));
  const [seen, setSeen] = useState(() => loadSetting("viennaSeen", {}));
  /* What's being explained. "checking", "wrong" and "ok" hold up Black's
     reply until they're resolved; "shown" and null don't. */
  const [feedback, setFeedback] = useState(null);
  const [hint, setHint] = useState(null);
  /* Praise for the move just played, said along with Black's reply. */
  const [praise, setPraise] = useState(null);
  const [offBook, setOffBook] = useState(false);
  const [missedHere, setMissedHere] = useState(false);
  const [lineMisses, setLineMisses] = useState(0);
  const [stats, setStats] = useState({ lines: 0, right: 0, asked: 0 });
  const [botThinking, setBotThinking] = useState(false);
  const [result, setResult] = useState(null);
  const [eco, setEco] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  /* The half-move at which known theory ran out in this line, so the coach
     announces it once instead of on every move after. */
  const [theoryEndPly, setTheoryEndPly] = useState(null);
  /* "Show why": { intro, steps, verdict, idx, startFen } while a line plays
     out (idx = moves of it shown so far), or { loading: true } while
     Stockfish finds it. */
  const [explain, setExplain] = useState(null);
  /* Bumped on every restart and take-back, so a Stockfish answer that
     arrives afterwards is ignored. */
  const epochRef = useRef(0);

  useEffect(() => { warmUpStockfish(); warmMaia(); loadEcoOpenings().then(setEco); }, []);
  useEffect(() => { saveSetting("viennaBand", band); }, [band]);
  useEffect(() => { saveSetting("viennaVariety", varietyId); }, [varietyId]);
  useEffect(() => { saveSetting("viennaMode", mode); }, [mode]);
  useEffect(() => { saveSetting("viennaWeak", weak); }, [weak]);
  useEffect(() => { saveSetting("viennaSeen", seen); }, [seen]);

  const node = offBook ? null : nodeAt(book, moves);
  const key = keyOf(moves);
  const whiteToMove = moves.length % 2 === 0;
  const waiting = ["checking", "wrong", "ok"].includes(feedback?.type);
  const pastTheory = !offBook && !node && moves.length > 0;
  const lineDone = pastTheory && !waiting && (moves.length >= EXTEND_TO_PLY || !!result);
  const explaining = !!explain;
  /* In Learn mode a move you haven't been shown yet is shown first. */
  const isNew = mode === "learn" && !!node?.w && !seen[key] && !missedHere;
  const note = node?.w && VIENNA_NOTES[key]?.move === node.w.rep ? VIENNA_NOTES[key] : null;
  const toReview = Object.keys(weak).filter((k) => nodeAt(book, k ? k.split(" ") : [])?.w);

  function checkOver() {
    if (eng.legalMoves().length === 0) {
      return eng.inCheckNow() ? (eng.getSide() === 1 ? "Checkmate, Black wins." : "Checkmate, you win!") : "Stalemate, it's a draw.";
    }
    if (eng.halfClock() >= 100) return "Draw by the fifty-move rule.";
    if (eng.repetitionCount() >= 3) return "Draw by threefold repetition.";
    if (eng.insufficientMaterial()) return "Draw, not enough material to mate.";
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
    setExplain(null);
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

  useEffect(() => {
    if (pastTheory && theoryEndPly == null) setTheoryEndPly(moves.length);
    else if (!pastTheory && theoryEndPly != null) setTheoryEndPly(null);
  }, [pastTheory, theoryEndPly, moves.length]);

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
    if (result || whiteToMove || waiting || lineDone || explaining) return;
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
          const mv = legal.find((m) => uciOf(m) === pickByChance(chances));
          if (mv === undefined) byStockfish();
          else finish(mv);
        })
        .catch(byStockfish);
      return () => { cancelled = true; };
    }
    byStockfish();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length, result, waiting, lineDone, offBook, explaining]);

  /* "Show why" plays its line out one move at a time. */
  useEffect(() => {
    if (!explain?.steps || explain.idx >= explain.steps.length) return;
    const t = setTimeout(() => setExplain((e) => (e?.steps ? { ...e, idx: e.idx + 1 } : e)), EXPLAIN_STEP_MS);
    return () => clearTimeout(t);
  }, [explain]);

  const onSquare = (i64) => {
    if (result || botThinking || waiting || lineDone || explaining || !whiteToMove) return;
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

  /* Each quizzed position counts once for "first try": right if the
     expected move came first, missed if anything else did, or a hint was
     taken. A move shown for the first time in Learn mode isn't a quiz. */
  const scoreRight = (k, quizzed) => {
    if (quizzed && !missedHere) {
      if (k != null) setWeak((w) => updateWeak(w, k, true));
      setStats((s) => ({ ...s, asked: s.asked + 1, right: s.right + 1 }));
    }
    setMissedHere(false);
    setFeedback(null);
  };
  const scoreMiss = (k) => {
    if (!missedHere) {
      if (k != null) setWeak((w) => updateWeak(w, k, false));
      setStats((s) => ({ ...s, asked: s.asked + 1 }));
      setLineMisses((n) => n + 1);
    }
    setMissedHere(true);
  };

  const userMove = (mv) => {
    setHint(null);
    setPraise(null);
    if (node?.w) {
      const judged = judgeMove(node, eng.sanOf(mv));
      const ply = moves.length;
      const wasNew = isNew;
      const san = play(mv);
      if (judged.verdict === "rep") {
        setSeen((s) => ({ ...s, [key]: true }));
        setPraise({ san: moveLabel(ply, san), idea: wasNew ? null : note?.idea });
        scoreRight(key, !wasNew);
        return;
      }
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
    const ply = moves.length;
    const san = play(mv);
    setFeedback({ type: "checking" });
    (async () => {
      const best = await stockfishAnalyze(fen, { moveTimeMs: CHECK_MS });
      if (best.uci === uci) return { loss: 0 };
      const mine = await stockfishAnalyze(fen, { moveTimeMs: CHECK_MS, searchMoves: [uci] });
      return { loss: best.lines[0].score - mine.lines[0].score, bestUci: best.uci };
    })().then(({ loss, bestUci }) => {
      if (epoch !== epochRef.current) return;
      if (loss < ENGINE_MISS_CP) {
        scoreRight(null, true);
        setPraise({ san: moveLabel(ply, san), engine: true });
        return;
      }
      scoreMiss(null);
      const probe = createEngine();
      probe.loadFen(fen);
      const m = probe.legalMoves().find((x) => uciOf(x) === bestUci);
      setFeedback({ type: "wrong", san, rep: m === undefined ? null : probe.sanOf(m), loss, source: "engine" });
    }).catch(() => {
      if (epoch === epochRef.current) setFeedback(null); // no verdict: the move stands
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

  /* Stockfish's line from `fen`, at least EXPLAIN_PLIES long when it can be:
     its last report is sometimes a quick partial one that only lists the
     first move, so a short line is extended from where it ends. Returns
     { pv, cpWhite }, the score from White's side. */
  const engineLine = async (fen, searchMoves) => {
    const res = await stockfishAnalyze(fen, { moveTimeMs: CHECK_MS, searchMoves });
    let pv = res.lines[0]?.pv || [];
    for (let tries = 0; pv.length > 0 && pv.length < EXPLAIN_PLIES && tries < 3; tries++) {
      const sofar = explainLine(fen, pv, pv.length);
      if (sofar.steps.length < pv.length) break;
      const more = await stockfishAnalyze(sofar.steps[sofar.steps.length - 1].fen, { moveTimeMs: CHECK_MS });
      if (!more.lines[0]?.pv?.length) break;
      pv = [...pv, ...more.lines[0].pv];
    }
    const cp = res.lines[0]?.score ?? 0;
    return { pv, cpWhite: fen.split(" ")[1] === "w" ? cp : -cp };
  };

  /* The book's own continuation after `first`: our repertoire moves and
     Black's most common replies at this level, so "why" never shows a line
     the trainer would then mark wrong. Returns { pv, cpWhite } with
     Stockfish's score for the last White decision on the way. */
  const bookLine = (first) => {
    const probe = createEngine();
    probe.loadFen(eng.fen());
    const list = [...moves];
    const pv = [];
    let cpWhite = node?.w?.ev?.[first] ?? null;
    let san = first;
    while (san && pv.length < EXPLAIN_PLIES) {
      const mv = probe.legalMoves().find((m) => probe.sanOf(m) === san);
      if (mv === undefined) break;
      pv.push(uciOf(mv));
      probe.make(mv);
      list.push(san);
      const next = nodeAt(book, list);
      if (!next) break;
      if (next.w) {
        san = next.w.rep;
        cpWhite = next.w.ev[san] ?? cpWhite;
      } else {
        const played = (c) => (c[band] || 0) * 1000 + c.reduce((a, b) => a + b, 0);
        san = Object.entries(next.r).sort((a, b) => played(b[1]) - played(a[1]))[0]?.[0];
      }
    }
    return { pv, cpWhite };
  };

  /* Show why: after a mistake, how Black punishes it (Stockfish's line);
     otherwise the idea behind the move, along the book where it can. */
  const showWhy = async () => {
    const epoch = epochRef.current;
    const start = eng.fen();
    let intro, find;
    if (feedback?.type === "wrong") {
      intro = `Watch what happens after ${feedback.san}.`;
      find = () => engineLine(start, null);
    } else {
      const rep = feedback?.type === "shown" ? feedback.rep : node?.w?.rep;
      const mv = rep && eng.legalMoves().find((m) => eng.sanOf(m) === rep);
      if (!mv) return;
      intro = note?.idea || `Here's the idea behind ${rep}.`;
      const fromBook = node?.w?.rep === rep ? bookLine(rep) : null;
      find = fromBook && fromBook.pv.length >= 3 ? async () => fromBook : () => engineLine(start, [uciOf(mv)]);
    }
    setExplain({ loading: true });
    try {
      const { pv, cpWhite } = await find();
      if (epoch !== epochRef.current) return;
      const line = explainLine(start, pv, EXPLAIN_PLIES);
      setExplain(line.steps.length ? { intro, steps: line.steps, verdict: fullVerdict(line, cpWhite), idx: 0, startFen: start } : null);
    } catch {
      if (epoch === epochRef.current) setExplain(null);
    }
  };

  const keepPlaying = () => {
    setFeedback(null);
    setMissedHere(false);
    setOffBook(true);
  };

  const startLine = (list = []) => {
    countedRef.current = false;
    setFeedback(null);
    setHint(null);
    setPraise(null);
    setOffBook(false);
    setMissedHere(false);
    setLineMisses(0);
    rebuild(list);
  };

  /* Jumps straight to the position missed most often. */
  const reviewMistake = () => {
    const worst = [...toReview].sort((a, b) => weak[b] - weak[a])[0];
    startLine(worst ? worst.split(" ") : []);
  };

  const showHint = () => {
    const mv = eng.legalMoves().find((m) => eng.sanOf(m) === node.w.rep);
    if (!mv) return;
    scoreMiss(key);
    setHint({ from: mFrom(mv), to: mTo(mv) });
    setFeedback({ type: "shown", rep: node.w.rep });
  };

  /* While Show why plays, the board shows its line instead of the game. */
  const shown = useMemo(() => {
    if (!explain?.steps) return null;
    const i = explain.idx;
    const step = i > 0 ? explain.steps[i - 1] : null;
    const probe = createEngine();
    probe.loadFen(step ? step.fen : explain.startFen);
    const whiteStarts = explain.startFen.split(" ")[1] === "w";
    return { eng: probe, step, done: i >= explain.steps.length, whiteMoved: step && ((i - 1) % 2 === 0) === whiteStarts };
  }, [explain]);

  /* ---------- What Zlegend27 says ---------- */
  const level = BANDS[band];
  const blackReply = (() => {
    if (!whiteToMove || moves.length < 2 || offBook) return null;
    const prev = nodeAt(book, moves.slice(0, -1));
    const san = moves[moves.length - 1];
    const label = moveLabel(moves.length - 1, san);
    /* A reply with no alternatives in the book (1...e5: every game was
       picked for being a Vienna) has no share worth quoting. */
    if (!prev?.r?.[san] || Object.keys(prev.r).length < 2) return `Black played ${label}.`;
    const all = Object.values(prev.r).reduce((s, c) => s + (c[band] || 0), 0);
    const pct = all ? Math.round(((prev.r[san][band] || 0) / all) * 100) : 0;
    return pct ? `Black played ${label}, like ${pct}% of ${level.label.toLowerCase()} players here.` : `Black played ${label}, a rare choice at this level.`;
  })();
  const praiseText = !praise ? null
    : praise.engine ? `${praise.san}, good move. Stockfish agrees.`
    : `${praise.san}, that's it!${praise.idea ? ` ${praise.idea}` : ""}`;
  const movesLeft = fullMoves(EXTEND_TO_PLY) - fullMoves(moves.length + 1) + 1;

  let say;
  if (explain?.loading) {
    say = "Let me show you…";
  } else if (shown) {
    say = !shown.step ? explain.intro : shown.done ? `${shown.step.text} ${explain.verdict}` : shown.step.text;
  } else if (lineDone) {
    say = result
      ? `${result}${lineMisses === 0 ? " And every move first try." : ""}`
      : lineMisses === 0
        ? "Line complete, every move first try. That's how you play the Vienna."
        : `Line complete. You missed ${lineMisses} ${lineMisses === 1 ? "move" : "moves"}; I'll bring ${lineMisses === 1 ? "it" : "them"} back until you've got ${lineMisses === 1 ? "it" : "them"}.`;
  } else if (result) {
    say = result;
  } else if (feedback?.type === "checking") {
    say = "Let me check that one…";
  } else if (feedback?.type === "wrong") {
    say = feedback.source === "book"
      ? `Not quite: ${feedback.san} isn't our Vienna move.${feedback.loss != null && feedback.loss >= 50 ? ` Stockfish rates it ${pawnsText(feedback.loss)} worse.` : ""} Want to see why?`
      : `Careful: ${feedback.san} is ${pawnsText(feedback.loss)} worse than the best move. Want to see why?`;
  } else if (feedback?.type === "ok") {
    say = `${feedback.san} is playable, but in our Vienna we play ${feedback.rep} here.`;
  } else if (offBook) {
    say = "Free play. Stockfish plays Black at your level and I'm not checking your moves.";
  } else if (!whiteToMove) {
    say = praiseText || "Black is thinking…";
  } else {
    const parts = [];
    if (praiseText) parts.push(praiseText);
    if (moves.length === 0) {
      parts.push(mode === "learn"
        ? `I'm Zlegend27. Let's learn your Vienna Gambit. I'll play Black the way real ${level.label.toLowerCase()} players do. New moves I show you first, then I test you on them.`
        : "Test mode: no arrows, no hints. Show me your Vienna.");
    } else if (blackReply) {
      parts.push(blackReply);
    }
    if (feedback?.type === "shown") parts.push(`Play ${feedback.rep}, outlined in gold.`);
    else if (isNew) parts.push(`New move: ${node.w.rep}.${note && moves.length > 0 ? ` ${note.idea}` : ""} Play it on the board.`);
    else if (node?.w?.punish) parts.push("That was a mistake by Black. Find the move that punishes it!");
    else if (pastTheory && theoryEndPly != null && moves.length - theoryEndPly <= 1) {
      parts.push(`That's the end of known theory: past here, real games go too many different ways to learn by heart. From now on I play Black like a real ${level.label.toLowerCase()} player, and Stockfish checks every move you make until move ${fullMoves(EXTEND_TO_PLY)}.`);
    } else if (pastTheory) {
      parts.push(`Your move. No more book, so play what the position needs. ${movesLeft === 1 ? "Last move to go." : `${movesLeft} moves to go.`}`);
    }
    else if (moves.length > 0) parts.push("Your move. What does our Vienna play here?");
    say = parts.join(" ");
  }

  /* ---------- Board decorations ---------- */
  const arrows = [];
  if (shown?.step) arrows.push({ from: shown.step.from, to: shown.step.to, color: shown.whiteMoved ? WHITE_ARROW : BLACK_ARROW });
  if (!explaining && whiteToMove && isNew && !feedback) {
    const mv = eng.legalMoves().find((m) => eng.sanOf(m) === node.w.rep);
    if (mv) arrows.push({ from: mFrom(mv), to: mTo(mv), color: HINT_ARROW });
  }

  const stage = offBook ? { label: "Free play", cls: "free" }
    : pastTheory ? { label: "Stockfish check", cls: "engine" }
    : { label: mode === "learn" ? "Learning" : "Testing", cls: "book" };
  const opening = eco && moves.length ? detectEcoOpening(moves, eco) : null;

  /* One primary button at a time; the rest are secondary. */
  let actions = null;
  if (shown) {
    actions = (
      <>
        <button className="btn gold" onClick={() => setExplain(null)}>{shown.done ? "Got it" : "Skip"}</button>
        {shown.done && <button className="btn ghost" onClick={() => setExplain({ ...explain, idx: 0 })}>Replay</button>}
      </>
    );
  } else if (explain?.loading) {
    actions = null;
  } else if (lineDone) {
    actions = (
      <>
        <button className="btn gold" onClick={() => startLine()}>Next line</button>
        {toReview.length > 0 && <button className="btn ghost" onClick={reviewMistake}>Review a mistake</button>}
        {!result && <button className="btn ghost" onClick={keepPlaying}>Play it out</button>}
      </>
    );
  } else if (feedback?.type === "wrong") {
    actions = (
      <>
        <button className="btn gold" onClick={() => takeBack(false)}>Retry</button>
        <button className="btn ghost" onClick={showWhy}>Show why</button>
        {feedback.rep && <button className="btn ghost" onClick={() => takeBack(true)}>Show move</button>}
      </>
    );
  } else if (feedback?.type === "ok") {
    actions = (
      <>
        <button className="btn gold" onClick={() => takeBack(false)}>Play {feedback.rep} instead</button>
        <button className="btn ghost" onClick={keepPlaying}>Keep {feedback.san}</button>
      </>
    );
  } else if (whiteToMove && node?.w && !result && moves.length > 0) {
    const shownRep = feedback?.type === "shown";
    actions = (
      <>
        {(isNew || shownRep) && <button className="btn ghost" onClick={showWhy}>Why {shownRep ? feedback.rep : node.w.rep}?</button>}
        {!isNew && !shownRep && mode === "learn" && <button className="btn ghost" onClick={showHint}>Hint</button>}
      </>
    );
  }

  /* One column: Zlegend27's panel above the board, line controls below. */
  return (
    <div className="trainerCol">
      <div className="box trainerBox">
        <div className="trainerHead">
          <div className="lessonCoachName" style={{ whiteSpace: "normal" }}>{opening ? opening.name : "Vienna Gambit"}</div>
          <span className={"trainerStage " + stage.cls}>{stage.label}</span>
        </div>
        <div className="trainerMoves" aria-label="Moves in this line">{moves.length ? lineText(moves) : "1. …"}</div>

        <BotBubble line={say} avatarSize={40} className="trainerCoach" />

        <div className="trainerActions">
          {actions}
          <div className="trainerStats">
            <span>First try <b>{stats.asked ? `${stats.right}/${stats.asked}` : "–"}</b></span>
            <span>Lines <b>{stats.lines}</b></span>
            <span>Review <b>{toReview.length}</b></span>
          </div>
        </div>
      </div>

      <LessonBoard
          eng={shown ? shown.eng : eng}
          orientation="white"
          selected={explaining ? -1 : selected}
          targets={explaining ? [] : targets}
          lastMove={explaining ? null : lastMove}
          onSquare={onSquare}
          pieceSetId={pieceSetId}
          hint={explaining ? null : hint}
          arrows={arrows}
      />

      <div className="trainerFooter">
        <button className="btn ghost" onClick={() => startLine()}>New line</button>
        <button className="btn ghost" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>Settings</button>
        <button className="btn ghost" onClick={onExit}>Exit</button>
      </div>

      {showSettings && (
        <div className="box trainerSettings">
          <label>
            <span>Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="learn">Learn: show me new moves first</option>
              <option value="test">Test: no arrows or hints</option>
            </select>
          </label>
          <label>
            <span>Black plays like</span>
            <select value={band} onChange={(e) => setBand(Number(e.target.value))}>
              {BANDS.map((b, i) => <option key={b.label} value={i}>{b.label} ({b.detail})</option>)}
            </select>
          </label>
          <label>
            <span>Black's choices</span>
            <select value={varietyId} onChange={(e) => setVarietyId(e.target.value)}>
              {VARIETY.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
          <p className="lessonHint" style={{ margin: 0 }}>
            Black plays what real players chose in {book.games.toLocaleString()} Vienna games from Lichess.
            {book.eliteGames > 0 && ` The lines go deeper with ${book.eliteGames.toLocaleString()} more between strong players (Lichess 2200+).`}
          </p>
        </div>
      )}
    </div>
  );
}
