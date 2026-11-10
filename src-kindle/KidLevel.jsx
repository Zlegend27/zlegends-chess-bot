/* Plays one Adventure level (see kidAdventure.js for the types) and reports
   the stars: onFinish(stars), 1 to 3. Star rules are the same everywhere a
   level is "do these right": no mistakes 3 stars, one or two 2, more 1. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createEngine, M120TO64, mFrom, mTo, mPromo, WQ, WR } from "../src/engine/chessEngine";
import { AnimalIcon } from "./AnimalIcon";
import KidBoard from "./KidBoard";
import { boardFrom, movesFor, apply, starPar, starRating, winner, aiMove, sq, pieceNum } from "./kidMini";
import { goodCapture, badCapture, isCapture, checkOf, VALUE } from "./kidRules";
import { kidPuzzlesWhere } from "./kidPuzzles";
import drills from "./kidDrills.json";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mistakeStars = (n) => (n === 0 ? 3 : n <= 2 ? 2 : 1);
const shuffled = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const NAMES = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
const PIECE_TIPS = {
  R: "The rook zooms in straight lines: up, down, left and right, as far as it likes.",
  B: "The bishop glides on the diagonals, and always stays on squares of one colour.",
  N: "The knight jumps in an L: two squares one way, then one to the side. It can hop over things!",
  Q: "The queen moves like a rook AND a bishop. Super powerful!",
  K: "The king walks one square at a time, in any direction.",
};

/** Owl, the board and the buttons: the frame every level shares. */
function Frame({ level, coach, mood, onExit, children, footer, progress }) {
  return (
    <div className="khRoot">
      <div className="khTop">
        <button className="khBack" onClick={onExit}>← Map</button>
        <span className="khChip">{level.icon} {level.title}</span>
      </div>
      {progress && <div className="klProgress" aria-label={progress.label}>{progress.items.map((s, i) => <i key={i} className={"klDot " + s} />)}</div>}
      {children}
      <div className="kcOwl">
        <AnimalIcon kind="Owl" size={56} mood={mood} />
        <div className="khBubble">{coach}</div>
      </div>
      {footer}
    </div>
  );
}

function Finished({ level, stars, text, onFinish, onAgain }) {
  return (
    <div className="khRoot">
      <div className="kcDone">
        <AnimalIcon kind="Owl" size={90} mood={stars ? "happy" : "sad"} />
        <h2 className="khTitle">{stars ? `${level.title}: ${"⭐".repeat(stars)}` : "So close!"}</h2>
        <p className="kcDoneText">{text}</p>
        {stars > 0 && <button className="khBig khMint" onClick={() => onFinish(stars)}>Back to the map</button>}
        <button className={"khBig " + (stars ? "khWhite" : "khMint")} onClick={onAgain}>{stars ? "Play again for more stars" : "Try again"}</button>
        {!stars && <button className="khBig khWhite" onClick={() => onFinish(0)}>Back to the map</button>}
      </div>
    </div>
  );
}

/* ---------------- Star hunt ---------------- */
function StarHunt({ level, renderPiece, boardVars, audio, onFinish, onExit }) {
  const [round, setRound] = useState(0);
  const r = level.rounds[round];
  const [pos, setPos] = useState(sq(r.start));
  const [left, setLeft] = useState(r.stars.map(sq));
  const [used, setUsed] = useState(0);
  const [selected, setSelected] = useState(-1);
  const [result, setResult] = useState(null);
  const rocks = useMemo(() => (r.rocks ?? []).map(sq), [r]);
  const par = useMemo(() => level.rounds.reduce((s, x) => s + starPar(x.piece, sq(x.start), x.stars.map(sq), (x.rocks ?? []).map(sq)), 0), [level]);
  const board = useMemo(() => { const b = Array(64).fill(null); b[pos] = { t: r.piece, w: true }; return b; }, [pos, r]);
  const targets = selected === pos ? movesFor(board, true, rocks).map((m) => m.to) : [];
  const marks = Object.fromEntries([...left.map((s) => [s, "⭐"]), ...rocks.map((s) => [s, "🪨"])]);

  const startRound = (i) => {
    const x = level.rounds[i];
    setRound(i); setPos(sq(x.start)); setLeft(x.stars.map(sq)); setSelected(-1);
  };
  const again = () => { setUsed(0); setResult(null); startRound(0); };
  const onSquare = (s) => {
    if (result || !left.length) return;
    if (selected === pos && targets.includes(s)) {
      const nowLeft = left.filter((x) => x !== s);
      if (nowLeft.length < left.length) audio?.sfxCapture?.(); else audio?.sfxMove?.();
      setPos(s); setLeft(nowLeft); setSelected(-1);
      const nowUsed = used + 1;
      setUsed(nowUsed);
      if (!nowLeft.length) {
        if (round + 1 < level.rounds.length) setTimeout(() => startRound(round + 1), 500);
        else setResult({ stars: starRating(nowUsed, par) });
      }
      return;
    }
    setSelected(s === pos ? s : -1);
  };
  if (result) {
    return <Finished level={level} stars={result.stars} onFinish={onFinish} onAgain={again}
      text={`You used ${used} moves. The fewest possible is ${par}.${result.stars < 3 ? " Can you find a shorter way?" : " Perfect!"}`} />;
  }
  return (
    <Frame level={level} onExit={onExit} coach={`${PIECE_TIPS[r.piece]} Collect every star${rocks.length ? " (rocks block the way)" : ""}! Moves: ${used} · fewest for ${level.rounds.length > 1 ? "all the rounds" : "this"}: ${par}.`}
      progress={level.rounds.length > 1 ? { label: `Round ${round + 1}`, items: level.rounds.map((_, i) => (i < round ? "klDone" : i === round ? "klNow" : "")) } : null}>
      <KidBoard pieceAt={(i) => pieceNum(board[i])} selected={selected} targets={targets} marks={marks} onSquare={onSquare} renderPiece={renderPiece} boardVars={boardVars} />
    </Frame>
  );
}

/* ---------------- Pawn Wars and Queen vs. 8 Pawns ---------------- */
const SETUPS = {
  pawnwars: "Pa2 Pb2 Pc2 Pd2 Pe2 Pf2 Pg2 Ph2 pa7 pb7 pc7 pd7 pe7 pf7 pg7 ph7",
  queenhunt: "Qd1 pa7 pb7 pc7 pd7 pe7 pf7 pg7 ph7",
};
function MiniBattle({ level, renderPiece, boardVars, audio, onFinish, onExit }) {
  const game = level.type;
  const [b, setB] = useState(() => boardFrom(SETUPS[game]));
  const [selected, setSelected] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [result, setResult] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const legal = movesFor(b, true);
  const targets = selected >= 0 ? legal.filter((m) => m.from === selected).map((m) => m.to) : [];
  const again = () => { setB(boardFrom(SETUPS[game])); setSelected(-1); setLast(null); setResult(null); };
  const end = (who) => {
    if (who === "white") audio?.sfxWin?.(); else audio?.sfxLose?.();
    setResult({ stars: who === "white" ? 3 : 0 });
  };
  const onSquare = async (s) => {
    if (busy || result) return;
    const m = legal.find((x) => x.from === selected && x.to === s);
    if (!m) { setSelected(b[s]?.w ? s : -1); return; }
    setSelected(-1);
    m.capture ? audio?.sfxCapture?.() : audio?.sfxMove?.();
    const mine = apply(b, m);
    setB(mine); setLast({ from: m.from, to: m.to });
    const w1 = winner(mine, game, "black");
    if (w1) return end(w1);
    setBusy(true);
    await wait(450);
    if (!alive.current) return;
    const reply = aiMove(mine, game, false, level.depth ?? 3);
    if (!reply) return end("white");
    const theirs = apply(mine, reply);
    reply.capture ? audio?.sfxCapture?.() : audio?.sfxMove?.();
    setB(theirs); setLast({ from: reply.from, to: reply.to });
    setBusy(false);
    const w2 = winner(theirs, game, "white");
    if (w2) end(w2);
  };
  const pawnsLeft = b.filter((p) => p && !p.w).length;
  const coach = game === "pawnwars"
    ? "Pawn Wars! Get one of your pawns to the other side first. Pawns move straight but capture diagonally. Keep your pawns guarding each other!"
    : `You're the queen! Catch all the pawns before one reaches your side. ${pawnsLeft} left. Careful: a pawn that's protected can't be taken safely.`;
  if (result) {
    return <Finished level={level} stars={result.stars} onFinish={onFinish} onAgain={again}
      text={result.stars ? (game === "pawnwars" ? "Your pawn made it to the other side!" : "You caught every pawn!") : (game === "pawnwars" ? "Their pawn got through first. Try to block it, or race faster!" : "A pawn slipped through. Catch the ones closest to your side first!")} />;
  }
  return (
    <Frame level={level} onExit={onExit} coach={coach}>
      <KidBoard pieceAt={(i) => pieceNum(b[i])} selected={selected} targets={targets} lastMove={last} onSquare={onSquare} renderPiece={renderPiece} boardVars={boardVars} />
    </Frame>
  );
}

/* ---------------- Real-chess positions (drills, puzzles, endgames) ---------------- */
function engineFrom(fen) { const e = createEngine(); e.loadFen(fen); return e; }
function useChessBoard(fen) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = engineFrom(fen);
  const [, setTick] = useState(0);
  const [selected, setSelected] = useState(-1);
  const [last, setLast] = useState(null);
  const eng = engRef.current;
  const load = (f) => { engRef.current = engineFrom(f); setSelected(-1); setLast(null); setTick((t) => t + 1); };
  const make = (m) => { eng.make(m); setLast({ from: M120TO64[mFrom(m)], to: M120TO64[mTo(m)] }); setTick((t) => t + 1); };
  const legalFrom = (s) => eng.legalMoves().filter((m) => M120TO64[mFrom(m)] === s);
  const targets = selected >= 0 ? [...new Set(legalFrom(selected).map((m) => M120TO64[mTo(m)]))] : [];
  /** A tap: selects one of the mover's pieces, or returns the move to a target. */
  const tap = (s) => {
    if (selected >= 0 && targets.includes(s)) {
      const m = legalFrom(selected).find((x) => M120TO64[mTo(x)] === s && (!mPromo(x) || mPromo(x) === WQ));
      setSelected(-1);
      return m;
    }
    const p = eng.pieceAt(s);
    setSelected(p !== 0 && Math.sign(p) === eng.getSide() ? s : -1);
    return undefined;
  };
  return { eng, selected, targets, last, load, make, tap, setTick };
}

function Drill({ level, renderPiece, boardVars, audio, onFinish, onExit }) {
  const pickSet = () => shuffled(drills[level.set]).slice(0, level.count);
  const [list, setList] = useState(pickSet);
  const [i, setI] = useState(0);
  const [misses, setMisses] = useState(0);
  const [coach, setCoach] = useState(level.intro);
  const [mood, setMood] = useState();
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const board = useChessBoard(list[0]);
  const judge = (m) => {
    const e = board.eng;
    if (level.set === "giveCheck") return checkOf(e, m).check ? null : "That doesn't attack their king. Which piece can reach a square that sees the king?";
    if (!isCapture(e, m)) return "That's not a capture! Look for an enemy piece you can take.";
    if (goodCapture(e, m)) return null;
    const mover = Math.abs(e.pieceAt(M120TO64[mFrom(m)])), victim = Math.abs(e.pieceAt(M120TO64[mTo(m)]));
    return badCapture(e, m)
      ? `Careful! They can take back, and your ${NAMES[mover]} (${VALUE[mover]}) is worth more than their ${NAMES[victim]} (${VALUE[victim]}).`
      : "They can take back. Find a capture that really wins something!";
  };
  const onSquare = async (s) => {
    if (result || busy) return;
    const m = board.tap(s);
    if (m === undefined) return;
    const why = judge(m);
    if (why) {
      audio?.sfxWrong?.();
      setMisses((n) => n + 1);
      setShake(true); setTimeout(() => setShake(false), 400);
      setCoach(why); setMood("sad");
      return;
    }
    const cap = isCapture(board.eng, m);
    board.make(m);
    cap ? audio?.sfxCapture?.() : audio?.sfxMove?.();
    setCoach(level.set === "giveCheck" ? "Check! Their king is attacked. ⭐" : "Yes! A free piece. ⭐"); setMood("happy");
    setBusy(true);
    await wait(900);
    setBusy(false);
    if (i + 1 >= list.length) { setResult({ stars: mistakeStars(misses) }); return; }
    setI(i + 1); board.load(list[i + 1]); setCoach(level.intro); setMood(undefined);
  };
  const again = () => { const l = pickSet(); setList(l); setI(0); setMisses(0); setResult(null); board.load(l[0]); setCoach(level.intro); setMood(undefined); };
  if (result) return <Finished level={level} stars={result.stars} onFinish={onFinish} onAgain={again} text={misses ? `Done, with ${misses} oops${misses > 1 ? "es" : ""}. You're learning to look first!` : "Every one right, first try!"} />;
  return (
    <Frame level={level} onExit={onExit} coach={coach} mood={mood} progress={{ label: `${i + 1} of ${list.length}`, items: list.map((_, k) => (k < i ? "klDone" : k === i ? "klNow" : "")) }}>
      <KidBoard pieceAt={(s) => board.eng.pieceAt(s)} selected={board.selected} targets={board.targets} lastMove={board.last} shake={shake} onSquare={onSquare} renderPiece={renderPiece} boardVars={boardVars} />
    </Frame>
  );
}

function Puzzles({ level, renderPiece, boardVars, audio, onFinish, onExit }) {
  const pickSet = () => shuffled(kidPuzzlesWhere((p) => p.rating < level.max && p.themes.some((t) => level.themes.includes(t)))).slice(0, level.count);
  const [list, setList] = useState(pickSet);
  const [i, setI] = useState(0);
  const [step, setStep] = useState(0);
  const [misses, setMisses] = useState(0);
  const [mood, setMood] = useState();
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const board = useChessBoard(list[0].fen);
  const puzzle = list[i];
  const solverWhite = puzzle.fen.split(" ")[1] === "w";
  const [coach, setCoach] = useState(list[0].hint);
  const onSquare = async (s) => {
    if (busy || result) return;
    const m = board.tap(s);
    if (m === undefined) return;
    if (board.eng.sanOf(m) !== puzzle.moves[step] && !checkOf(board.eng, m).mate) {
      audio?.sfxWrong?.();
      setMisses((n) => n + 1);
      setShake(true); setTimeout(() => setShake(false), 400);
      setCoach(`Not quite! ${puzzle.hint}`); setMood("sad");
      return;
    }
    const cap = isCapture(board.eng, m);
    const mate = checkOf(board.eng, m).mate;
    board.make(m);
    cap ? audio?.sfxCapture?.() : audio?.sfxMove?.();
    setMood("happy");
    if (mate || step + 1 >= puzzle.moves.length) {
      setCoach(mate ? "Checkmate! ⭐" : "You got it! ⭐");
      setBusy(true);
      await wait(1000);
      setBusy(false);
      if (i + 1 >= list.length) { setResult({ stars: mistakeStars(misses) }); return; }
      setI(i + 1); setStep(0); board.load(list[i + 1].fen); setCoach(list[i + 1].hint); setMood(undefined);
      return;
    }
    setCoach("Good! Now they answer...");
    setBusy(true);
    await wait(600);
    const reply = board.eng.legalMoves().find((x) => board.eng.sanOf(x) === puzzle.moves[step + 1]);
    if (reply) board.make(reply);
    setBusy(false);
    setStep(step + 2);
    setCoach("Keep going! What's next?");
  };
  const again = () => { const l = pickSet(); setList(l); setI(0); setStep(0); setMisses(0); setResult(null); board.load(l[0].fen); setCoach(l[0].hint); setMood(undefined); };
  if (result) return <Finished level={level} stars={result.stars} onFinish={onFinish} onAgain={again} text={misses ? `All solved, with ${misses} wrong tr${misses > 1 ? "ies" : "y"}.` : "Every puzzle right, first try!"} />;
  return (
    <Frame level={level} onExit={onExit} coach={`${solverWhite ? "White" : "Black"} to move. ${coach}`} mood={mood} progress={{ label: `${i + 1} of ${list.length}`, items: list.map((_, k) => (k < i ? "klDone" : k === i ? "klNow" : "")) }}>
      <KidBoard pieceAt={(s) => board.eng.pieceAt(s)} flipped={!solverWhite} selected={board.selected} targets={board.targets} lastMove={board.last} shake={shake} onSquare={onSquare} renderPiece={renderPiece} boardVars={boardVars} />
    </Frame>
  );
}

function Endgame({ level, renderPiece, boardVars, audio, onFinish, onExit }) {
  const board = useChessBoard(level.fen);
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [coach, setCoach] = useState(level.intro);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const rating = (n) => (n <= level.par ? 3 : n <= Math.ceil(level.par * 1.5) ? 2 : 1);
  const hasWhite = (type) => { for (let s = 0; s < 64; s++) if (board.eng.pieceAt(s) === type) return true; return false; };
  const fail = (text) => { audio?.sfxLose?.(); setResult({ stars: 0, text }); };
  const onSquare = async (s) => {
    if (busy || result) return;
    const m = board.tap(s);
    if (m === undefined) return;
    board.make(m);
    audio?.sfxMove?.();
    const n = used + 1;
    setUsed(n);
    const e = board.eng;
    const noMoves = e.legalMoves().length === 0;
    if (noMoves && e.inCheckNow()) { audio?.sfxWin?.(); setResult({ stars: rating(n), text: `Checkmate in ${n} moves!` }); return; }
    if (noMoves) return fail("Stalemate: their king can't move, but it isn't in check. That's a draw! Leave the king a square to move to.");
    if (n >= level.limit) return fail(`That took ${n} moves. Try to finish faster!`);
    setBusy(true);
    await wait(400);
    if (!alive.current) return;
    const reply = e.search(250, 0)?.move;
    if (reply) board.make(reply);
    setBusy(false);
    if (level.goal === "mate" && !hasWhite(WQ) && !hasWhite(WR)) return fail("Oh no, they took your piece! Keep it next to your king, or far from theirs.");
    if (level.goal === "promote") {
      if (hasWhite(WQ)) { audio?.sfxWin?.(); setResult({ stars: rating(n), text: `A new queen in ${n} moves!` }); return; }
      if (!hasWhite(1)) return fail("Their king caught your pawn. Keep your king in front of it!");
    }
    setCoach(`${level.intro} Moves: ${n}.`);
  };
  const again = () => { board.load(level.fen); setUsed(0); setResult(null); setCoach(level.intro); };
  if (result) return <Finished level={level} stars={result.stars} onFinish={onFinish} onAgain={again} text={result.text} />;
  return (
    <Frame level={level} onExit={onExit} coach={coach}>
      <KidBoard pieceAt={(s) => board.eng.pieceAt(s)} selected={board.selected} targets={board.targets} lastMove={board.last} onSquare={onSquare} renderPiece={renderPiece} boardVars={boardVars} />
    </Frame>
  );
}

function Quiz({ level, audio, onFinish, onExit }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [misses, setMisses] = useState(0);
  const [result, setResult] = useState(null);
  const q = level.questions[i];
  const choose = (k) => {
    /* Once answered right, or a second tap on the same wrong answer, does nothing. */
    if ((picked !== null && level.questions[i].answer === picked) || k === picked) return;
    setPicked(k);
    if (k === q.answer) audio?.sfxWin?.(); else { audio?.sfxWrong?.(); setMisses((n) => n + 1); }
  };
  const next = () => {
    if (i + 1 >= level.questions.length) { setResult({ stars: mistakeStars(misses) }); return; }
    setI(i + 1); setPicked(null);
  };
  if (result) return <Finished level={level} stars={result.stars} onFinish={onFinish} onAgain={() => { setI(0); setPicked(null); setMisses(0); setResult(null); }} text="Pawn 1, knight 3, bishop 3, rook 5, queen 9. Before you take, ask: what do I give, and what do I get?" />;
  const right = picked === q.answer;
  return (
    <Frame level={level} onExit={onExit} coach={picked === null ? q.q : `${right ? "Yes! " : "Not quite. "}${q.why}`} mood={picked === null ? undefined : right ? "happy" : "sad"}
      progress={{ label: `${i + 1} of ${level.questions.length}`, items: level.questions.map((_, k) => (k < i ? "klDone" : k === i ? "klNow" : "")) }}
      footer={right ? <button className="khBig khMint" onClick={next}>{i + 1 >= level.questions.length ? "Finish ⭐" : "Next →"}</button> : null}>
      <div className="klQuiz">
        {q.options.map((o, k) => (
          <button key={k} className={"klOption" + (picked === k ? (k === q.answer ? " klRight" : " klWrong") : "")} onClick={() => choose(k)}>{o}</button>
        ))}
      </div>
    </Frame>
  );
}

const PLAYERS = { stars: StarHunt, pawnwars: MiniBattle, queenhunt: MiniBattle, drill: Drill, puzzles: Puzzles, endgame: Endgame, quiz: Quiz };

export default function KidLevel(props) {
  const Player = PLAYERS[props.level.type];
  return Player ? <Player key={props.level.id} {...props} /> : null;
}
