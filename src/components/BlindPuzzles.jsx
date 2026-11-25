/* Text puzzles with Zlegend2700 (Blind Chess Trainer > Play): real puzzles
   from the puzzle set, read out as a list of pieces instead of shown on a
   board, with Zlegend2700 hosting in a big speech bubble. The player types
   (or says) the move: no multiple choice. Only puzzles with few pieces,
   so the list stays easy to hold in your head. A puzzle rating for this
   mode picks puzzles near the player's level and moves with each one. */
import { useEffect, useMemo, useRef, useState } from "react";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";
import MoodImg from "./MoodImg";
import TapBoard from "./TapBoard";
import { getUiTheme } from "../utils/uiTheme";
import { getBoardColor } from "../utils/boardColors";
import { loadSetting, saveSetting } from "../utils/storage";
import { createEngine, mFrom, mTo, M120TO64 } from "../engine/chessEngine";
import { PUZZLES } from "../utils/puzzles";
import { judgePuzzleMove } from "../utils/puzzleSession";
import { describePieces, _internal } from "../utils/blindDrills";
import { sanToSpeech, PIECE_SPOKEN } from "../utils/blindChess";
import { createSpeaker, createRecognizer } from "../utils/speech";
import { track } from "../utils/track";

const MAX_PIECES = 12;
const MAX_SOLVER_MOVES = 3;
const pieceCount = (fen) => fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
/* Puzzles that work without a board: few pieces, short solutions. */
export const TEXT_PUZZLES = PUZZLES.filter((p) => pieceCount(p.fen) <= MAX_PIECES && Math.ceil(p.moves.length / 2) <= MAX_SOLVER_MOVES);

const INSTALLED_IPHONE = typeof window !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)
  && (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches);
const CAN_LISTEN = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !INSTALLED_IPHONE;

/* Zlegend2700's lines: a cocky arcade rival, never mean (see botLines.js). */
const LINES = {
  start: ["No board this time. Just you, me, and your imagination.", "I'll read you the pieces. You find the move. Simple. Ish.", "Close your eyes if you want. I won't peek. Much.", "Picture it. Got it? Good. Now beat it."],
  right: ["Okay, okay. That's the move.", "Clean. Annoyingly clean.", "You saw that without a board? Respect.", "Correct. I'm only slightly impressed."],
  wrong: ["Nope. Try again, I believe in you. Mostly.", "Not that one. Look again.", "Bold. Wrong, but bold.", "The board's in your head. Check it again."],
  solved: ["Puzzle solved. Fine, you win this one.", "That's the whole combo. Show-off.", "Solved without seeing a single square. Who are you?", "Done. I'll find a harder one. Obviously."],
  gaveUp: ["No shame. Here's how it goes.", "This one's sneaky. Watch.", "Happens to the best of us. Well, not me."],
  hint: ["Fine, a clue.", "Hint incoming. Don't tell anyone.", "Psst."],
};
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** The pieces in a FEN as [square, letter] pairs, for describePieces. */
export function piecesOf(fen) {
  const out = [];
  fen.split(" ")[0].split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) { f += Number(c); continue; }
      out.push(["abcdefgh"[f] + (8 - i), c]);
      f++;
    }
  });
  return out;
}
/** The position in words, with the side to move ("…Black to move."). */
export function readPosition(fen) {
  return `${describePieces(piecesOf(fen))} ${fen.split(" ")[1] === "w" ? "White" : "Black"} to move.`;
}

/** A puzzle near `rating` that hasn't been played this visit. */
export function pickPuzzle(rating, seen = new Set(), rand = Math.random) {
  const fresh = TEXT_PUZZLES.filter((p) => !seen.has(p.id));
  const pool = (fresh.length ? fresh : TEXT_PUZZLES).slice().sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating)).slice(0, 12);
  return pool[Math.floor(rand() * pool.length)];
}
/** The mode's rating after a puzzle (Elo, both ways). */
export function nextRating(mine, puzzleRating, solved) {
  const expected = 1 / (1 + 10 ** ((puzzleRating - mine) / 400));
  return Math.round(Math.max(300, Math.min(2600, mine + 32 * ((solved ? 1 : 0) - expected))));
}

const name64 = (i120) => { const t = M120TO64[i120]; return "abcdefgh"[t % 8] + (((t / 8) | 0) + 1); };

export default function BlindPuzzles({ sweetheart, pieceSetId = "classic" }) {
  const T = getUiTheme(sweetheart);
  const focus = `focus-visible:outline-none focus-visible:ring-2 ${T.ring}`;
  const [rating, setRating] = useState(() => loadSetting("textPuzzleRating", 700));
  const [streak, setStreak] = useState(0);
  const seen = useRef(new Set());
  const [puzzle, setPuzzle] = useState(() => pickPuzzle(loadSetting("textPuzzleRating", 700), seen.current));
  const engRef = useRef(null);
  const [played, setPlayed] = useState([]); // SANs so far, both sides
  const [talk, setTalk] = useState([]);     // the bubble: Zlegend2700's lines
  /* The position stays on screen in its own panel the whole time (a hint
     or a remark used to replace it), updated after each reply. */
  const [position, setPosition] = useState("");
  const [mood, setMood] = useState(null);   // "happy" | "angry" | null
  const [state, setState] = useState("playing"); // playing | solved | failed
  const [misses, setMisses] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => !!loadSetting("textPuzzleVoice", false));
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);
  const colors = getBoardColor(loadSetting("boardColor", "default"));

  const speaker = useMemo(() => createSpeaker(), []);
  const recRef = useRef(null);
  const submitRef = useRef(() => {});
  useEffect(() => {
    if (!CAN_LISTEN) return undefined;
    recRef.current = createRecognizer({
      onResult: (text) => submitRef.current(text),
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    return () => { recRef.current?.stop(); speaker.cancel(); };
  }, [speaker]);

  /* Shows Zlegend2700's lines; reads them (and the position, when given)
     aloud if that's on. */
  const say = (lines, alsoRead = "") => {
    setTalk(lines);
    if (voiceOn) { speaker.cancel(); speaker.speak([...lines, alsoRead].join(" ")); }
  };

  /* A new puzzle: set up the engine and Zlegend2700 reads it out. */
  const begin = (p, intro) => {
    const eng = createEngine();
    eng.loadFen(p.fen);
    engRef.current = eng;
    seen.current.add(p.id);
    setPuzzle(p); setPlayed([]); setMisses(0); setState("playing"); setMood(null); setAnswer(""); setShowBoard(false);
    setPosition(readPosition(p.fen));
    say([intro, `Find the best move. (Puzzle rated ${p.rating}.)`], readPosition(p.fen));
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  useEffect(() => { begin(puzzle, pick(LINES.start)); /* first puzzle on open */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m) => { setMood(m); setTimeout(() => setMood(null), 1800); };
  const finish = (solved) => {
    const r = nextRating(rating, puzzle.rating, solved);
    setRating(r); saveSetting("textPuzzleRating", r);
    setStreak((s) => (solved ? s + 1 : 0));
    setState(solved ? "solved" : "failed");
    track("text_puzzle", { solved, rating: puzzle.rating });
  };

  const submit = (text) => {
    if (state !== "playing" || !String(text).trim()) return;
    const eng = engRef.current;
    const moves = _internal.readMove(eng, text);
    setAnswer("");
    if (!moves) { say(["I didn't catch that. Give me a move, like Qh5 or knight to f3."]); return; }
    if (!moves.length) { say(["That move isn't possible here. Check where your pieces are."]); return; }
    if (moves.length > 1) { say(["Which piece? Say where it starts, like knight from g1 to f3."]); return; }
    const verdict = judgePuzzleMove(eng, puzzle, played, moves[0]);
    if (!verdict.ok) {
      const left = 2 - misses;
      setMisses((n) => n + 1);
      flash("angry");
      if (left <= 0) { giveUp(true); return; }
      say([`${verdict.san}? ${pick(LINES.wrong)}`, `${left} ${left === 1 ? "try" : "tries"} left.`]);
      return;
    }
    eng.make(moves[0]);
    const list = [...played, verdict.san];
    if (verdict.solved) {
      setPlayed(list);
      flash("happy");
      say([`${verdict.san}! ${pick(LINES.solved)}`]);
      finish(true);
      return;
    }
    /* Part of the way there: Zlegend2700 answers, and it's your move again. */
    const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
    if (reply) eng.make(reply);
    setPlayed([...list, verdict.reply]);
    setPosition(readPosition(eng.fen()));
    flash("happy");
    say([`${verdict.san}. ${pick(LINES.right)}`, `I reply ${sanToSpeech(verdict.reply)} (${verdict.reply}). Your move.`], readPosition(eng.fen()));
  };
  submitRef.current = submit;

  const giveUp = (outOfTries = false) => {
    const rest = puzzle.moves.slice(played.length);
    const steps = rest.map((san, i) => ((played.length + i) % 2 === 0 ? `you ${san}` : `I ${san}`)).join(", then ");
    say([outOfTries ? "Out of tries." : pick(LINES.gaveUp), `The answer: ${steps}.`]);
    finish(false);
  };

  const hint = () => {
    const eng = engRef.current;
    const san = puzzle.moves[played.length];
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === san);
    if (!m) return;
    const piece = PIECE_SPOKEN[Math.abs(eng.pieceAt(M120TO64[mFrom(m)]))];
    say([pick(LINES.hint), `Look at your ${piece} on ${name64(mFrom(m))}.`]);
  };

  const next = () => { speaker.prime(); begin(pickPuzzle(rating, seen.current), pick(LINES.start)); };
  const onMic = () => {
    speaker.prime();
    if (listening) { recRef.current?.stop(); return; }
    speaker.cancel();
    recRef.current?.resetBlock();
    recRef.current?.start();
  };
  const toggleVoice = () => {
    speaker.prime();
    setVoiceOn((v) => { saveSetting("textPuzzleVoice", !v); if (v) speaker.cancel(); else speaker.speak([...talk, position].join(" ")); return !v; });
  };

  /* The answer, marked on the board once the puzzle's over. */
  const solutionMarks = () => {
    const eng = createEngine(); eng.loadFen(puzzle.fen);
    const m = eng.legalMoves().find((x) => eng.sanOf(x) === puzzle.moves[0]);
    return m ? { [name64(mFrom(m))]: "hint", [name64(mTo(m))]: "right" } : {};
  };

  return (
    <section className={`flex flex-col gap-3 rounded-2xl border ${T.cardBorder} ${T.panelBg} p-4 backdrop-blur-sm`}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="boxHead m-0">Text puzzles</h1>
        <span className={`text-xs font-bold ${T.dimText}`}>Rating {rating}{streak > 1 ? ` · ${streak} in a row` : ""}</span>
      </div>

      <div className="textPuzzleStage">
        <div className="textPuzzleHost" aria-hidden="true">
          {mood === "happy" ? <MoodImg src="/bot-happy.webp" alt="" /> : mood === "angry" ? <MoodImg src="/bot-angry.webp" alt="" /> : <PixelAvatar rows={ZPIX} pal={ZPAL} size={72} />}
        </div>
        <div className="textPuzzleBubble" aria-live="polite">
          <span className="textPuzzleWho">Zlegend2700</span>
          {talk.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      </div>

      <div className="textPuzzlePosition">
        <span className="textPuzzleWho">The position</span>
        <p>{position}</p>
        {played.length > 0 && <p className="textPuzzleMoves">Moves so far: {played.join(" ")}</p>}
      </div>

      {/* A look at the board, any time: it doesn't solve anything, the
          move still has to be typed. */}
      {showBoard ? (
        <>
          <TapBoard fen={state === "playing" ? engRef.current?.fen() ?? puzzle.fen : puzzle.fen} coords pieceSetId={pieceSetId} colors={colors} disabled
            flipped={puzzle.fen.split(" ")[1] === "b"} marks={state === "playing" ? {} : solutionMarks()}
            label={state === "playing" ? "The position" : "The puzzle's position, with the first move marked"} />
          <button type="button" onClick={() => setShowBoard(false)} className={`self-start border-0 bg-transparent p-0 py-1 text-sm font-bold underline ${T.interactiveText} ${focus}`}>Hide the board</button>
        </>
      ) : (
        <button type="button" onClick={() => setShowBoard(true)} className={`self-start border-0 bg-transparent p-0 py-1 text-sm font-bold underline ${T.interactiveText} ${focus}`}>Show the board</button>
      )}

      {state === "playing" ? (
        <>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); speaker.prime(); submit(answer); }}>
            <input ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your move"
              placeholder="Your move, like Qh5 or knight f3" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className={`min-h-12 min-w-0 flex-1 rounded-xl border ${T.cardBorder} bg-transparent px-3 text-base ${T.ink} ${focus}`} />
            <button type="submit" className="btn gold" style={{ minHeight: 48 }}>Play</button>
          </form>
          {CAN_LISTEN && (
            <button type="button" onClick={onMic} className={"btn " + (listening ? "gold" : "ghost")} style={{ minHeight: 48 }}>
              {listening ? "Listening… tap to stop" : "Say your move"}
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn ghost" style={{ flex: 1, minHeight: 44 }} onClick={hint}>Hint</button>
            <button type="button" className="btn ghost" style={{ flex: 1, minHeight: 44 }} onClick={() => giveUp(false)}>Give up</button>
          </div>
        </>
      ) : (
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={next} autoFocus>Next puzzle</button>
      )}

      <label className={`flex min-h-11 items-center justify-between gap-3 text-sm ${T.ink}`}>
        Read it aloud
        <button type="button" role="switch" aria-checked={voiceOn} aria-label="Read it aloud" onClick={toggleVoice} className={"toggleSwitch" + (voiceOn ? " on" : "")}>
          <span className="toggleThumb" />
        </button>
      </label>
    </section>
  );
}
