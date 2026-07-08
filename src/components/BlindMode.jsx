/* ================================================================
   Blind Chess — play a full game entirely by voice, no board shown.

   Runs its OWN engine instance (createEngine()) so it can't disturb
   the main App board/modes in any way; the opponent is the same
   vendored Stockfish worker the difficulty tiers use. Conversation
   follows the confirm-over-accidents design: a unique parse commits,
   an ambiguous one asks which piece, a low-confidence voice result
   asks yes/no — a misheard move can never silently reach the board.

   Voice is Web Speech API only (free, on-device). Browsers without
   speech recognition (Firefox) fall back to the always-present text
   input, which is also what makes this testable without a mic.
   ================================================================ */

import { useEffect, useRef, useState } from "react";
import { createEngine } from "../engine/chessEngine";
import { stockfishBestMove, warmUpStockfish } from "../engine/stockfishEngine";
import { replayIntoEngine } from "../utils/share";
import { loadSetting, saveSetting } from "../utils/storage";
import { saveGame } from "../utils/gameHistory";
import { ENGINE_VERSION } from "../utils/version";
import {
  parseUtterance, parseClarification, filterByClarification,
  sanToSpeech, sqName, PIECE_SPOKEN,
} from "../utils/blindChess";
import {
  describeTurn, describeBoard, describeCaptured, describeSummary, describeThreats,
  describeStanding, answerQuestion,
} from "../utils/blindDescriber";
import { logBlindMiss } from "../utils/blindMisses";
import { createSpeaker, createRecognizer, requestMicPermission, loadVoices, rankEnglishVoices } from "../utils/speech";

const BLIND_LEVELS = [
  { label: "1320 Elo", elo: 1320 },
  { label: "1500 Elo", elo: 1500 },
  { label: "2000 Elo", elo: 2000 },
];
/* Chrome reports ~0.7 confidence on perfectly clear short phrases, so
   0.75 forced a "Is that correct?" on nearly every spoken move. A wrong
   transcript still has to resolve to a LEGAL move to get this far, so
   the floor only needs to catch genuinely garbled audio. */
const CONFIDENCE_FLOOR = 0.6;
const HINT_ELO = 2800;

export default function BlindMode({ onClose }) {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = createEngine();
  const eng = engRef.current;

  const [phase, setPhase] = useState("setup");        // setup | playing | over
  const [levelIdx, setLevelIdx] = useState(1);
  const [playerColor, setPlayerColor] = useState(1);
  const [log, setLog] = useState([]);
  const [botThinking, setBotThinking] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [input, setInput] = useState("");
  const [resultText, setResultText] = useState(null);
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState(() => loadSetting("blindVoice", ""));
  /* Autosaved game (localStorage) — lets a refresh, tab discard, or an
     accidental close resume instead of losing the game. */
  const [savedGame, setSavedGame] = useState(() => {
    const s = loadSetting("blindSavedGame", null);
    return s && Array.isArray(s.moveList) && s.moveList.length > 0 ? s : null;
  });

  /* Mirrors for values read inside speech callbacks (which outlive any
     single render) — same ref-mirror pattern App.jsx uses throughout. */
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const micOnRef = useRef(micOn); micOnRef.current = micOn;
  const botThinkingRef = useRef(botThinking); botThinkingRef.current = botThinking;
  const moveListRef = useRef([]);
  const pendingRef = useRef(null);          // {type:"disambiguate"|"promotion"|"confirm", matches, question}
  const lastMoveSpeechRef = useRef(null);   // for "repeat"
  const playerColorRef = useRef(playerColor); playerColorRef.current = playerColor;
  const levelIdxRef = useRef(levelIdx); levelIdxRef.current = levelIdx;
  const levelRef = useRef(BLIND_LEVELS[levelIdx]); levelRef.current = BLIND_LEVELS[levelIdx];
  const pendingSpeechRef = useRef(0);

  const speakerRef = useRef(null);
  if (!speakerRef.current) speakerRef.current = createSpeaker();
  const recRef = useRef(null);

  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ block: "end" }); }, [log]);

  const pushLog = (who, text) => setLog(l => [...l, { who, text }]);

  /* The mic stays off while the bot talks (so it can't hear itself) and
     while the bot is thinking; it comes back the moment the speech queue
     drains, giving the hands-free back-and-forth loop. */
  const maybeListen = () => {
    if (!recRef.current?.supported) return;
    if (micOnRef.current && phaseRef.current === "playing" && !botThinkingRef.current && pendingSpeechRef.current === 0) {
      recRef.current.start();
    }
  };

  const announce = (text) => {
    pushLog("bot", text);
    recRef.current?.stop();
    pendingSpeechRef.current++;
    speakerRef.current.speak(text).then(() => {
      pendingSpeechRef.current--;
      maybeListen();
    });
  };

  useEffect(() => {
    recRef.current = createRecognizer({
      onResult: (transcript, confidence) => handleUtteranceRef.current(transcript, confidence ?? 1),
      onStart: () => setListening(true),
      /* Slight delay before restarting: an immediate start() inside
         onend races Chrome's session teardown and throws. */
      onEnd: () => { setListening(false); setTimeout(maybeListen, 250); },
      onError: (err) => {
        setListening(false);
        if (err === "not-allowed" || err === "service-not-allowed") {
          setMicOn(false); micOnRef.current = false;
          announce("I can't access the microphone — it's blocked for this site. Allow microphone access in your browser settings, then turn the mic back on.");
        } else {
          pushLog("bot", `(Mic error: ${err})`);
        }
      },
    });
    /* Boot the Stockfish worker + WASM while the player is still on the
       setup screen, so the first bot reply is just the search time. */
    warmUpStockfish();
    /* Offer the ranked English voices; apply a previously chosen one. */
    loadVoices().then((vs) => {
      const ranked = rankEnglishVoices(vs);
      setVoices(ranked);
      const saved = loadSetting("blindVoice", "");
      const chosen = ranked.find(v => v.name === saved);
      if (chosen) speakerRef.current.setVoice(chosen);
    });
    return () => {
      recRef.current?.stop();
      speakerRef.current.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickVoice = (name) => {
    setVoiceName(name);
    saveSetting("blindVoice", name);
    /* "" = auto: fall back to the top-ranked voice, not the browser default */
    const v = (name ? voices.find(x => x.name === name) : voices[0]) || null;
    speakerRef.current.setVoice(v);
    if (v) speakerRef.current.speak("This is how I'll sound.");
  };

  const persistGame = () => {
    saveSetting("blindSavedGame", {
      moveList: moveListRef.current,
      playerColor: playerColorRef.current,
      levelIdx: levelIdxRef.current,
      at: Date.now(),
    });
  };
  const clearSavedGame = () => {
    saveSetting("blindSavedGame", null);
    setSavedGame(null);
  };

  const checkGameOver = () => {
    if (eng.legalMoves().length === 0) {
      if (eng.inCheckNow()) {
        const winner = -eng.getSide();
        return { text: winner === 1 ? "1–0" : "0–1", reason: "Checkmate", winner };
      }
      return { text: "½–½", reason: "Stalemate" };
    }
    if (eng.halfClock() >= 100) return { text: "½–½", reason: "Fifty-move rule" };
    if (eng.repetitionCount() >= 3) return { text: "½–½", reason: "Threefold repetition" };
    if (eng.insufficientMaterial()) return { text: "½–½", reason: "Insufficient material" };
    return null;
  };

  const finishGame = (over, spoken) => {
    setPhase("over"); phaseRef.current = "over";
    setResultText(`${over.text} — ${over.reason}`);
    clearSavedGame();
    recRef.current?.stop();
    announce(spoken);
    saveGame({
      difficultyLabel: `Blind ${levelRef.current.label}`,
      playerColor: playerColorRef.current,
      moveList: moveListRef.current,
      result: over,
      finalEval: eng.evalWhite(),
      style: null,
      engineVersion: ENGINE_VERSION,
    });
  };

  const describeGameOver = (over) => {
    if (over.reason === "Checkmate") {
      return over.winner === playerColorRef.current
        ? "Checkmate — you win! Well played."
        : "Checkmate — the bot wins. Good game.";
    }
    return `Draw by ${over.reason.toLowerCase()}. Good game.`;
  };

  const botTurn = () => {
    setBotThinking(true); botThinkingRef.current = true;
    recRef.current?.stop();
    stockfishBestMove(eng.fen(), levelRef.current.elo, 700).then(({ uci }) => {
      setBotThinking(false); botThinkingRef.current = false;
      if (phaseRef.current !== "playing") return;
      const m = uci && eng.moveFromUci(uci);
      if (!m) { announce("The bot has no move. Something went wrong — say new game to restart."); return; }
      const san = eng.sanOf(m);
      eng.make(m);
      moveListRef.current = [...moveListRef.current, san];
      persistGame();
      const speech = `Opponent plays ${sanToSpeech(san)}.`;
      lastMoveSpeechRef.current = speech;
      const over = checkGameOver();
      if (over) { finishGame(over, `${speech} ${describeGameOver(over)}`); return; }
      announce(`${speech} Your move.`);
    }).catch(() => {
      setBotThinking(false); botThinkingRef.current = false;
      announce("I couldn't reach the engine. Try your move again.");
    });
  };

  const commitMove = (match) => {
    pendingRef.current = null;
    eng.make(match.move);
    moveListRef.current = [...moveListRef.current, match.san];
    persistGame();
    const speech = `You played ${sanToSpeech(match.san)}.`;
    lastMoveSpeechRef.current = speech;
    const over = checkGameOver();
    if (over) { finishGame(over, `${speech} ${describeGameOver(over)}`); return; }
    announce(speech);
    botTurn();
  };

  const askDisambiguation = (matches) => {
    const piece = PIECE_SPOKEN[matches[0].piece];
    const origins = matches.map(x => sqName(x.from64)).join(" or ");
    const q = `I found ${matches.length} legal ${piece} moves there. Which one — ${origins}?`;
    pendingRef.current = { type: "disambiguate", matches, question: q };
    announce(q);
  };

  const runCommand = (command) => {
    switch (command) {
      case "repeat":
        announce(lastMoveSpeechRef.current || "Nothing to repeat yet."); break;
      case "board": announce(describeBoard(eng)); break;
      case "position": announce(describeSummary(eng)); break;
      case "turn": announce(describeTurn(eng)); break;
      case "captured": announce(describeCaptured(eng)); break;
      case "threats": announce(describeThreats(eng)); break;
      case "undo": {
        if (moveListRef.current.length < 2) { announce("There's nothing to take back yet."); break; }
        moveListRef.current = moveListRef.current.slice(0, -2);
        eng.reset();
        replayIntoEngine(eng, moveListRef.current);
        persistGame();
        pendingRef.current = null;
        announce("Took back your last move and the bot's reply. Your move.");
        break;
      }
      case "hint": {
        announce("Let me think.");
        stockfishBestMove(eng.fen(), HINT_ELO, 600).then(({ uci }) => {
          const m = uci && eng.moveFromUci(uci);
          announce(m ? `Consider ${sanToSpeech(eng.sanOf(m))}.` : "I don't have a suggestion right now.");
        }).catch(() => announce("I couldn't get a hint right now."));
        break;
      }
      case "help":
        announce(
          "Say a move like knight to f3, pawn takes e5, or castle kingside. " +
          "Ask questions like where can my knight move, what can I take, what's on e5, or how am I doing. " +
          "Say repeat, read the board, position, hint, or undo any time. " +
          "You can also offer a draw, or resign."
        );
        break;
      case "standing": announce(describeStanding(eng, playerColorRef.current)); break;
      case "draw": {
        /* The bot accepts when it has nothing (or worse) and the game
           has actually been played out a bit — same spirit as a human
           opponent taking a draw in a level position. */
        const cpBot = eng.evalWhite() * -playerColorRef.current;
        if (eng.plyCount() >= 24 && cpBot <= 30) {
          finishGame({ text: "½–½", reason: "Draw agreed" }, "Draw accepted. Good game.");
        } else {
          announce(cpBot > 30
            ? "The bot declines — it likes its position."
            : "The bot declines — it wants to play on a little longer.");
        }
        break;
      }
      case "resign": {
        const winner = -playerColorRef.current;
        finishGame(
          { text: winner === 1 ? "1–0" : "0–1", reason: "Resignation", winner },
          "You resigned. Good game."
        );
        break;
      }
      case "new": startGame(playerColorRef.current); break;
      case "yes": case "no": announce("There's nothing to confirm right now."); break;
      default: announce("I didn't catch that.");
    }
  };

  const handlePending = (text) => {
    const pending = pendingRef.current;
    const asParsed = parseUtterance(eng, text);
    /* Questions are welcome mid-clarification ("which knight?" — "wait,
       where can each knight move?") — answer, then re-ask, keeping the
       pending move alive. */
    if (asParsed.kind === "question") {
      announce(`${answerQuestion(eng, asParsed)} ${pending.question}`);
      return;
    }
    if (asParsed.kind === "command" && (asParsed.command === "no" || asParsed.command === "repeat")) {
      if (asParsed.command === "repeat") { announce(pending.question); return; }
      pendingRef.current = null;
      announce("Okay, cancelled. Your move.");
      return;
    }
    if (pending.type === "confirm") {
      if (asParsed.kind === "command" && asParsed.command === "yes") { commitMove(pending.matches[0]); return; }
      /* anything else: fall through and treat it as a fresh utterance */
      pendingRef.current = null;
      handleParsed(asParsed, 1);
      return;
    }
    const clar = parseClarification(text);
    if (clar) {
      const left = filterByClarification(pending.matches, clar);
      if (left.length === 1) { commitMove(left[0]); return; }
      if (left.length === 0) { announce(`None of them match that. ${pending.question}`); return; }
      announce(pending.question);
      return;
    }
    announce(pending.question);
  };

  const handleParsed = (parsed, confidence) => {
    if (parsed.kind === "command") { runCommand(parsed.command); return; }
    if (parsed.kind === "question") { announce(answerQuestion(eng, parsed)); return; }
    if (parsed.kind === "unknown") {
      logBlindMiss(parsed.text);
      announce("I didn't understand that. Say help to hear what I can do, or say a move like knight to f3.");
      return;
    }
    if (eng.getSide() !== playerColorRef.current) { announce("Hold on — it's not your move yet."); return; }
    if (parsed.kind === "promotion") {
      pendingRef.current = { type: "promotion", matches: parsed.matches, question: "Promote to which piece — queen, rook, bishop, or knight?" };
      announce(pendingRef.current.question);
      return;
    }
    const { matches, spec } = parsed;
    if (matches.length === 0) {
      const pieceBit = spec.piece ? `${PIECE_SPOKEN[spec.piece]} ` : "";
      const target = spec.castle ? "castling" : `${pieceBit}move to ${spec.to}`;
      announce(`There's no legal ${target} right now. Try again.`);
      return;
    }
    if (matches.length === 1) {
      if (confidence < CONFIDENCE_FLOOR) {
        pendingRef.current = { type: "confirm", matches, question: `I heard ${sanToSpeech(matches[0].san)}. Is that correct?` };
        announce(pendingRef.current.question);
        return;
      }
      commitMove(matches[0]);
      return;
    }
    askDisambiguation(matches);
  };

  const handleUtterance = (text, confidence = 1) => {
    if (!text.trim() || phaseRef.current !== "playing") return;
    pushLog("you", text.trim());
    if (botThinkingRef.current) { announce("One moment — the bot is thinking."); return; }
    if (pendingRef.current) { handlePending(text); return; }
    handleParsed(parseUtterance(eng, text), confidence);
  };
  const handleUtteranceRef = useRef(handleUtterance);
  handleUtteranceRef.current = handleUtterance;

  const startGame = (color) => {
    eng.reset();
    moveListRef.current = [];
    pendingRef.current = null;
    lastMoveSpeechRef.current = null;
    clearSavedGame();
    setLog([]);
    setResultText(null);
    setPlayerColor(color); playerColorRef.current = color;
    setPhase("playing"); phaseRef.current = "playing";
    const intro = `New game against the ${levelRef.current.label} bot. You play ${color === 1 ? "White" : "Black"}.`;
    if (color === 1) announce(`${intro} Your move.`);
    else { announce(intro); botTurn(); }
  };

  const resumeGame = () => {
    const saved = loadSetting("blindSavedGame", null);
    if (!saved?.moveList?.length) { setSavedGame(null); return; }
    eng.reset();
    const { applied } = replayIntoEngine(eng, saved.moveList);
    if (applied.length !== saved.moveList.length) {
      /* saved moves don't replay (corrupt/older engine) — discard */
      eng.reset();
      clearSavedGame();
      return;
    }
    const idx = BLIND_LEVELS[saved.levelIdx] ? saved.levelIdx : 1;
    setLevelIdx(idx); levelIdxRef.current = idx; levelRef.current = BLIND_LEVELS[idx];
    setPlayerColor(saved.playerColor); playerColorRef.current = saved.playerColor;
    moveListRef.current = saved.moveList;
    pendingRef.current = null;
    setLog([]);
    setResultText(null);
    setPhase("playing"); phaseRef.current = "playing";
    const lastSan = saved.moveList[saved.moveList.length - 1];
    const yourMove = eng.getSide() === saved.playerColor;
    const speech = `Last move was ${sanToSpeech(lastSan)}.`;
    lastMoveSpeechRef.current = speech;
    announce(`Resumed your game after ${saved.moveList.length} moves. ${speech}${yourMove ? " Your move." : ""}`);
    if (!yourMove) botTurn();
  };

  const toggleMic = async () => {
    if (micOn) {
      setMicOn(false); micOnRef.current = false;
      recRef.current?.stop();
      return;
    }
    /* Ask for the mic via getUserMedia first: this reliably raises the
       browser's permission prompt from the click, where a bare
       SpeechRecognition.start() can fail silently with "not-allowed". */
    const perm = await requestMicPermission();
    if (!perm.ok) {
      announce(perm.reason === "denied"
        ? "Microphone access was denied. Allow it in your browser's site settings, then try again."
        : "I couldn't access a microphone on this device — you can still play with the text box.");
      return;
    }
    recRef.current?.resetBlock();
    setMicOn(true); micOnRef.current = true;
    maybeListen();
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    speakerRef.current.setEnabled(next);
  };

  const submitText = (e) => {
    e.preventDefault();
    const text = input;
    setInput("");
    handleUtterance(text, 1);
  };

  const micSupported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    /* Backdrop click is ignored mid-game: a blind player can't see what a
       stray tap hit. The ✕ still closes — the game autosaves, so nothing
       is lost, and reopening offers Resume. */
    <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={e => { if (e.target === e.currentTarget && phase !== "playing") onClose(); }}>
      <div className="promoBox blindBox">
        <button className="modalCloseX" onClick={onClose} aria-label="Close Blind Chess"
          title={phase === "playing" ? "Close — your game is saved for resume" : "Close"}>✕</button>
        <div className="boxHead">🕶️ Blind Chess</div>

        {phase === "setup" && (
          <div className="blindSetup">
            <p className="blindHint">
              Play a full game by voice — no board. Say moves like “knight to f3”,
              ask “what’s the position?”, or say “repeat” any time.
            </p>
            <label className="blindLabel">
              Opponent
              <select value={levelIdx} onChange={e => setLevelIdx(Number(e.target.value))}>
                {BLIND_LEVELS.map((l, i) => <option key={l.elo} value={i}>{l.label}</option>)}
              </select>
            </label>
            {voices.length > 0 && (
              <label className="blindLabel">
                Coach voice
                <select value={voiceName} onChange={e => pickVoice(e.target.value)}>
                  <option value="">Auto (best available)</option>
                  {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </label>
            )}
            {!micSupported && (
              <p className="blindHint">Voice input isn’t supported in this browser — you can still play with the text box.</p>
            )}
            {savedGame && (
              <button className="btn gold" onClick={resumeGame}>
                Resume Game ({savedGame.moveList.length} {savedGame.moveList.length === 1 ? "move" : "moves"} in)
              </button>
            )}
            <div className="ctrls">
              <button className={"btn " + (savedGame ? "ghost" : "gold")} onClick={() => startGame(1)}>Play as White</button>
              <button className="btn ghost" onClick={() => startGame(-1)}>Play as Black</button>
            </div>
          </div>
        )}

        {phase !== "setup" && (
          <>
            <div className="blindStatus">
              {phase === "over" ? resultText
                : botThinking ? "Bot is thinking…"
                : listening ? "Listening…"
                : micOn ? "Mic ready" : "Your move"}
            </div>
            <div className="blindLog" aria-live="polite">
              {log.map((entry, i) => (
                <div key={i} className={"blindMsg " + entry.who}>
                  <span className="blindWho">{entry.who === "bot" ? "Coach" : "You"}</span>
                  {entry.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {phase === "playing" && (
              <>
                <form className="blindInputRow" onSubmit={submitText}>
                  <input
                    type="text" value={input} onChange={e => setInput(e.target.value)}
                    placeholder='Type a move or command… e.g. "knight f3"'
                    aria-label="Move or command"
                  />
                  <button className="btn gold" type="submit">Send</button>
                </form>
                <div className="ctrls blindCtrls">
                  {micSupported && (
                    <button className={"btn " + (micOn ? "gold" : "ghost")} onClick={toggleMic}>
                      {micOn ? "🎙 Mic on" : "🎙 Mic off"}
                    </button>
                  )}
                  <button className="btn ghost" onClick={toggleVoice}>{voiceOn ? "🔊 Voice" : "🔇 Muted"}</button>
                  <button className="btn ghost" onClick={() => runCommand("repeat")}>Repeat</button>
                  <button className="btn ghost" onClick={() => runCommand("position")}>Position</button>
                  <button className="btn ghost" onClick={() => runCommand("board")}>Read board</button>
                  <button className="btn ghost" onClick={() => runCommand("hint")}>Hint</button>
                  <button className="btn ghost" onClick={() => runCommand("undo")}>Undo</button>
                  <button className="btn ghost" onClick={() => runCommand("help")}>Help</button>
                  <button className="btn ghost" onClick={() => runCommand("resign")}>Resign</button>
                </div>
              </>
            )}

            {phase === "over" && (
              <div className="ctrls">
                <button className="btn gold" onClick={() => startGame(playerColor)}>New Game</button>
                <button className="btn ghost" onClick={() => setPhase("setup")}>Change Settings</button>
                <button className="btn ghost" onClick={onClose}>Exit</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
