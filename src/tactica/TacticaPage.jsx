import { useState } from "react";
import { loadSetting, saveSetting } from "../utils/storage";
import MenuScreen from "./MenuScreen";
import TutorialMode from "./TutorialMode";
import BlitzMode from "./BlitzMode";
import RunMode from "./RunMode";
import BotMode from "./BotMode";
import "./tactica.css";

/* Chess Tactica: a menu over the bin, and the modes it opens. Everything
   sits inside .tactica, which carries the game's own carved wood and brass
   look (tactica.css). */
export default function TacticaPage({ pieceImgSrc, sweetheart, onExit }) {
  const [screen, setScreen] = useState("menu");
  const [blitzBest, setBlitzBest] = useState(() => loadSetting("tacticaBlitzBest", 0));
  const toMenu = () => setScreen("menu");
  const recordBest = (score) => { setBlitzBest(score); saveSetting("tacticaBlitzBest", score); };
  const [runBest, setRunBest] = useState(() => loadSetting("tacticaRunBest", 0));
  const recordRunBest = (score) => { setRunBest(score); saveSetting("tacticaRunBest", score); };

  let page;
  if (screen === "tutorial") page = <TutorialMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "run") page = <RunMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} best={runBest} onBest={recordRunBest} onExit={toMenu} />;
  else if (screen === "bot") page = <BotMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  else if (screen === "blitz") page = <BlitzMode sweetheart={sweetheart} best={blitzBest} onBest={recordBest} onExit={toMenu} />;
  else page = <MenuScreen onPick={setScreen} onExit={onExit} blitzBest={blitzBest} sweetheart={sweetheart} />;
  return <div className="tactica">{page}</div>;
}
