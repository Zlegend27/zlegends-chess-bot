import { useEffect, useState } from "react";
import { loadSetting, saveSetting } from "../utils/storage";
import MenuScreen from "./MenuScreen";
import TutorialMode from "./TutorialMode";
import BlitzMode from "./BlitzMode";
import RunMode from "./RunMode";
import BotMode from "./BotMode";
import { unlock, play, setFlies } from "./sound";
import "./tactica.css";

/* Chess Tactica: a menu over the bin, and the modes it opens. Everything
   sits inside .tactica, which carries the game's own carved wood and brass
   look (tactica.css). Sound starts on the first touch (phones require it);
   wooden buttons knock, brass ones click, and the bin's flies buzz past
   now and then. */
export default function TacticaPage({ pieceImgSrc, sweetheart, onExit }) {
  const [screen, setScreen] = useState("menu");
  const [blitzBest, setBlitzBest] = useState(() => loadSetting("tacticaBlitzBest", 0));
  const toMenu = () => setScreen("menu");
  const recordBest = (score) => { setBlitzBest(score); saveSetting("tacticaBlitzBest", score); };
  const [runBest, setRunBest] = useState(() => loadSetting("tacticaRunBest", 0));
  const recordRunBest = (score) => { setRunBest(score); saveSetting("tacticaRunBest", score); };

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
  if (screen === "tutorial") page = <TutorialMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "run") page = <RunMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} best={runBest} onBest={recordRunBest} onExit={toMenu} />;
  else if (screen === "bot") page = <BotMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "blitz") page = <BlitzMode sweetheart={sweetheart} best={blitzBest} onBest={recordBest} onExit={toMenu} />;
  else page = <MenuScreen onPick={setScreen} onExit={onExit} blitzBest={blitzBest} sweetheart={sweetheart} />;
  return <div className="tactica" onPointerDownCapture={onPointerDown} onClickCapture={unlock} onTouchEndCapture={unlock}>{page}</div>;
}
