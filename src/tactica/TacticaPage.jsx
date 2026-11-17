import { Component, useEffect, useState } from "react";
import { loadSetting, saveSetting } from "../utils/storage";
import { noteTacticaChange } from "./accountSync.js";
import { track } from "../utils/track";
import MenuScreen from "./MenuScreen";
import TutorialMode from "./TutorialMode";
import BlitzMode from "./BlitzMode";
import RunMode from "./RunMode";
import BotMode from "./BotMode";
import VersusMode from "./VersusMode";
import OpeningScene from "./OpeningScene";
import MemoryMode from "./MemoryMode";
import { loadStory, saveStory, afterOpening } from "./story";
import { unlock, play, setFlies } from "./sound";
import "./tactica.css";

/* Chess Tactica: a menu over the bin, and the modes it opens. Everything
   sits inside .tactica, which carries the game's own carved wood and brass
   look (tactica.css). Sound starts on the first touch (phones require it);
   wooden buttons knock, brass ones click, and the bin's flies buzz past
   now and then. */
/* `player` ({ session, profile, displayName, avatar, onSignIn }) is who
   plays 1v1. `start` opens one mode directly (the site's Puzzles tab opens
   "blitz"); leaving that mode then leaves Tactica, back to where it came
   from, instead of stopping at Tactica's own menu.

   The opening plays the first time Tactica's menu would be shown, and leads
   into the Tutorial. After that it never plays by itself: picking Tutorial
   plays it again, now with a Skip. It is never put in front of a run. */
/* If the 3D can't start (the phone ran out of graphics memory, or too many
   tabs hold 3D views), Tactica says so in its own words with a way out,
   instead of the whole site's error screen. */
class TacticaGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { track("tactica_error", { message: String(error?.message ?? error).slice(0, 200) }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="tactica">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: "radial-gradient(circle at 50% 40%, #2a1a10, #0c0806)" }}>
          <h2 className="tc-title m-0 text-2xl">The board wouldn't open</h2>
          <p className="m-0 max-w-xs text-sm text-[var(--tc-cream-dim)]">Chess Tactica's 3D couldn't start on this device just now. Closing other tabs or apps and trying again usually fixes it.</p>
          <button type="button" className="tc-plank tc-center tc-small" style={{ width: 200 }} onClick={() => window.location.reload()}>Try again</button>
          <button type="button" className="tc-plank tc-center tc-small" style={{ width: 200 }} onClick={this.props.onExit}>Leave Chess Tactica</button>
        </div>
      </div>
    );
  }
}

export default function TacticaPage(props) {
  return <TacticaGuard onExit={props.onExit}><TacticaPageInner {...props} /></TacticaGuard>;
}

function TacticaPageInner({ pieceImgSrc, sweetheart, player, start = null, onExit, onLeaderboard = null }) {
  /* A 1v1 game still on (a refresh mid-game) goes straight back to it. */
  const [screen, setScreen] = useState(() => (loadSetting("tacticaPvpActive", null) ? "versus" : start ?? (loadStory().seen ? "menu" : "opening")));
  /* Whether the opening on screen is a rewatch (so it can be skipped). */
  const [rewatch] = useState(() => loadStory().seen);
  const [seenNow, setSeenNow] = useState(false);
  const openingDone = (answer) => { saveStory(afterOpening(loadStory(), answer)); setSeenNow(true); setScreen("tutorial"); };
  const [blitzBest, setBlitzBest] = useState(() => loadSetting("tacticaBlitzBest", 0));
  const toMenu = () => setScreen("menu");
  const leave = (mode) => (start === mode ? onExit : toMenu);
  const recordBest = (score) => { setBlitzBest(score); saveSetting("tacticaBlitzBest", score); noteTacticaChange(); };
  const [runBest, setRunBest] = useState(() => loadSetting("tacticaRunBest", 0));
  const recordRunBest = (score) => { setRunBest(score); saveSetting("tacticaRunBest", score); noteTacticaChange(); };

  useEffect(() => { if (screen !== "menu") track("tactica_mode", { mode: screen }); }, [screen]);
  useEffect(() => {
    setFlies(true);
    return () => setFlies(false);
  }, []);

  /* Every touch unlocks sound; buttons make their own sound as they sink. */
  const onPointerDown = (e) => {
    unlock();
    const button = e.target.closest?.("button");
    if (!button || button.disabled) return;
    if (button.classList.contains("tc-brass")) play("brass", { volume: 0.7 });
    else if (button.classList.contains("tc-plank") || button.classList.contains("tc-round")) play("plank", { volume: 0.35 });
    else if (button.classList.contains("tc-frame")) play("tap", { volume: 0.4 });
  };

  let page;
  if (screen === "opening") page = <OpeningScene sweetheart={sweetheart} skippable={(rewatch || seenNow) && loadStory().seen} onDone={openingDone} />;
  else if (screen === "tutorial") page = <TutorialMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "run") page = <RunMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} best={runBest} onBest={recordRunBest} displayName={player?.displayName} onLeaderboard={onLeaderboard ? () => onLeaderboard("run") : null} onExit={toMenu} />;
  else if (screen === "memories") page = <MemoryMode onExit={toMenu} />;
  else if (screen === "bot") page = <BotMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "versus") page = <VersusMode {...player} pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "blitz") page = <BlitzMode sweetheart={sweetheart} best={blitzBest} displayName={player?.displayName} onBest={recordBest} onExit={leave("blitz")} exitLabel={start === "blitz" ? "Back to Puzzles" : undefined} />;
  else page = <MenuScreen onPick={(id) => setScreen(id === "tutorial" ? "opening" : id)} onOpening={() => setScreen("opening")} onExit={onExit} blitzBest={blitzBest} sweetheart={sweetheart} />;
  return <div className="tactica" onPointerDownCapture={onPointerDown} onClickCapture={unlock} onTouchEndCapture={unlock}>{page}</div>;
}
