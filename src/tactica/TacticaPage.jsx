import { useState } from "react";
import { loadSetting, saveSetting } from "../utils/storage";
import MenuScreen from "./MenuScreen";
import TutorialMode from "./TutorialMode";
import BlitzMode from "./BlitzMode";
import RunMode from "./RunMode";
import BotMode from "./BotMode";

/* Chess Tactica: a menu over the bin, and the modes it opens. */
export default function TacticaPage({ pieceImgSrc, sweetheart }) {
  const [screen, setScreen] = useState("menu");
  const [blitzBest, setBlitzBest] = useState(() => loadSetting("tacticaBlitzBest", 0));
  const toMenu = () => setScreen("menu");
  const recordBest = (score) => { setBlitzBest(score); saveSetting("tacticaBlitzBest", score); };
  const [runBest, setRunBest] = useState(() => loadSetting("tacticaRunBest", 0));
  const recordRunBest = (score) => { setRunBest(score); saveSetting("tacticaRunBest", score); };

  if (screen === "tutorial") return <TutorialMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  if (screen === "run") return <RunMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} best={runBest} onBest={recordRunBest} onExit={toMenu} />;
  if (screen === "bot") return <BotMode pieceImgSrc={pieceImgSrc} sweetheart={sweetheart} onExit={toMenu} />;
  if (screen === "blitz") return <BlitzMode sweetheart={sweetheart} best={blitzBest} onBest={recordBest} onExit={toMenu} />;
  return <MenuScreen best={blitzBest} runBest={runBest} onPick={setScreen} sweetheart={sweetheart} />;
}
