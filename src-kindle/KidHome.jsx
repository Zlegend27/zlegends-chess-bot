/* Kinnda's home screen: Owl says hello, two big doors (Learn and Play),
   and Today's Quests with the streak and the treasure chest.

   Holding Owl for three seconds opens the progress code for a grown-up to
   copy (see reportCode in kidProgress.js); nothing on screen says so, so a
   child doesn't stumble into it. */
import { useEffect, useRef, useState } from "react";
import { AnimalIcon } from "./AnimalIcon";
import { CHEST_COINS } from "./kidProgress";

const HOLD_MS = 3000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** What Owl says: about yesterday's games if there were any, else about today. */
function greeting({ hour, yesterday, quests, streak }) {
  const hello = hour < 12 ? "Good morning!" : hour < 18 ? "Hi there!" : "Good evening!";
  const wins = yesterday?.games?.filter((g) => g.result === "win") ?? [];
  if (wins.length) {
    const names = [...new Set(wins.map((g) => g.opponent))];
    const who = names.length === 1 ? cap(names[0]) : "the animals";
    return `${hello} Yesterday you beat ${who}${wins.length > 1 ? ` ${wins.length} times` : ""}! Ready for today's quests?`;
  }
  const done = quests.filter((q) => q.complete).length;
  if (done === quests.length) return "All three quests done today! You're a star.";
  if (done) return `${done} quest${done > 1 ? "s" : ""} done! Your streak is safe today.`;
  if (streak > 1) return `${hello} You're on a ${streak}-day streak. Do one quest to keep it going!`;
  return `${hello} Pick a quest and let's play some chess!`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function KidHome({ shop, quests, streak, week, yesterday, learnText, learnPct, memoryDue, chestReady, chestOpened, onOpenChest, onGo, musicOn, onMusic, reportCode }) {
  const [holding, setHolding] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const holdTimer = useRef(null);
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const startHold = () => {
    setHolding(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { setHolding(false); setCopied(false); setCodeOpen(true); }, HOLD_MS);
  };
  const endHold = () => { setHolding(false); clearTimeout(holdTimer.current); };

  const code = codeOpen ? reportCode() : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { /* select the text so it can be copied by hand */ document.getElementById("khCode")?.select(); }
  };
  const share = async () => { try { await navigator.share({ title: "Kinnda progress", text: code }); } catch { /* cancelled */ } };

  const done = quests.filter((q) => q.complete).length;
  return (
    <div className="khRoot">
      <div className="khTop">
        <span className="khChip" title="Days in a row with at least one quest">🔥 {streak} day{streak === 1 ? "" : "s"}</span>
        <span className="khChip">🪙 {shop.coins}</span>
        <button className="khChip khMusic" onClick={onMusic} aria-label={musicOn ? "Pause music" : "Play music"}>{musicOn ? "🔊" : "🔈"}</button>
      </div>

      <div className="khHello">
        <button
          className={"khOwl" + (holding ? " khHolding" : "")}
          onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Owl"
        >
          <AnimalIcon kind="Owl" size={84} mood={done === quests.length ? "happy" : undefined} />
        </button>
        <div className="khBubble">{greeting({ hour: new Date().getHours(), yesterday, quests, streak })}</div>
      </div>

      <div className="khDoors">
        <button className="khDoor khLearn" onClick={() => onGo("learn")}>
          <span className="khArt" aria-hidden="true">🗺️</span>
          <span>
            <b>Learn</b>
            <span className="khDoorSub">Owl&apos;s Adventure · {learnText}</span>
            <span className="khBar"><i style={{ width: `${Math.round(learnPct * 100)}%` }} /></span>
          </span>
        </button>
        <button className="khDoor khPlay" onClick={() => onGo("room")}>
          <span className="khArt" aria-hidden="true">🎮</span>
          <span>
            <b>Play</b>
            <span className="khDoorSub">Games, puzzles and Puzzle Rush</span>
          </span>
        </button>
      </div>

      <section className="khCard">
        <h2 className="khQuestTitle">Today&apos;s quests <span>{done} of {quests.length}</span></h2>
        {quests.map((q) => (
          <div className="khQuest" key={q.id}>
            <span className={"khTick" + (q.complete ? " khDone" : "")} aria-hidden="true">{q.complete ? "✓" : q.icon}</span>
            <span className="khQuestText">
              {q.text}
              {q.need > 1 && <span className="khCount"> · {q.done}/{q.need}</span>}
            </span>
            {q.complete
              ? <span className="khStar" aria-label="Done">⭐</span>
              : <button className="khGo" onClick={() => onGo(q.go)}>Go</button>}
          </div>
        ))}
        {chestReady ? (
          <button className="khChest khChestReady" onClick={onOpenChest}>
            <span className="khChestIcon" aria-hidden="true">🧰</span>
            <span>All three done! Tap to open your treasure chest!</span>
          </button>
        ) : chestOpened ? (
          <div className="khChest"><span className="khChestIcon" aria-hidden="true">💰</span><span>Chest opened: +{CHEST_COINS} coins. See you tomorrow!</span></div>
        ) : (
          <div className="khChest"><span className="khChestIcon" aria-hidden="true">🧰</span><span>Do all three to open today&apos;s treasure chest. Any one keeps your 🔥 streak.</span></div>
        )}
        <div className="khWeek">
          {week.map((d) => (
            <div key={d.key} className={"khDay" + (d.lit ? " khLit" : "") + (d.today ? " khToday" : "")}>
              <span aria-hidden="true">{d.lit ? "🔥" : "·"}</span>{DAY_NAMES[d.weekday]}
            </div>
          ))}
        </div>
      </section>

      {memoryDue > 0 && (
        <button className="khCard khMemory" onClick={() => onGo("memory")}>
          <span className="khChestIcon" aria-hidden="true">🧠</span>
          <span><b>Memory Game</b><br /><span className="khCount">{memoryDue} opening move{memoryDue === 1 ? "" : "s"} to remember today</span></span>
          <span className="khGo">Play</span>
        </button>
      )}

      {codeOpen && (
        <div className="kShopOv" onClick={(e) => { if (e.target === e.currentTarget) setCodeOpen(false); }}>
          <button className="kCloseX" onClick={() => setCodeOpen(false)} aria-label="Close">✕</button>
          <h2 className="kLessonTitle" style={{ textAlign: "center" }}>Progress code</h2>
          <div className="kMoves" style={{ width: "var(--kCol)", fontSize: 15 }}>
            For a grown-up: copy this and paste it into a chat to get a report on how she&apos;s doing.
          </div>
          <textarea id="khCode" className="khCode" readOnly value={code} onFocus={(e) => e.target.select()} />
          <div className="kCtrls">
            <button className="kBtnGreen" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
            {typeof navigator !== "undefined" && navigator.share && <button className="kBtnBlue" onClick={share}>Share</button>}
          </div>
        </div>
      )}
    </div>
  );
}
