/* The Game Room: everything for playing, apart from learning. Pick an
   animal from the ladder and play, or go to the daily puzzle, puzzles,
   Puzzle Rush, trophies or the shop. */
import { AnimalIcon } from "./AnimalIcon";

const starText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

export default function GameRoom({ opponents, current, gameOpp, thinking, shop, medalFor, gameUnderway, dailyStreak, dailyDone, bestRush, onPick, onPlay, onNewGame, onDaily, onPuzzles, onRush, onTrophies, onShop, onBack }) {
  const opp = opponents[current];
  const totalMedals = opponents.filter((d) => medalFor(shop.winsByAnimal?.[d.id] || 0)).length;
  return (
    <div className="khRoot">
      <div className="khTop">
        <button className="khBack" onClick={onBack}>← Home</button>
        <span className="khChip">🪙 {shop.coins}</span>
      </div>
      <h1 className="khTitle">Game Room</h1>
      <p className="khSub">Play for fun. Everything you learn with Owl helps here!</p>

      <h2 className="khH2">Choose your opponent</h2>
      <div className="khLadder" role="radiogroup" aria-label="Opponent">
        {opponents.map((d, i) => {
          const locked = d.unlockable && !shop.ownedAnimals.includes(d.id);
          const wins = shop.winsByAnimal?.[d.id] || 0;
          const medal = medalFor(wins);
          return (
            <button
              key={d.id}
              role="radio"
              aria-checked={i === current}
              className={"khRung" + (i === current ? " khNow" : "") + (locked ? " khLocked" : "")}
              onClick={() => (locked ? onShop() : onPick(i))}
            >
              <AnimalIcon kind={d.label} size={48} />
              <b>{d.label}</b>
              <span className="khStars">{starText(d.stars)}</span>
              <span className="khRungNote">{locked ? `🔒 ${d.price}🪙` : medal ? `${medal} ${wins}` : "not yet"}</span>
            </button>
          );
        })}
      </div>
      {/* A game in progress keeps its own opponent; a different animal picked
          here plays the next game. */}
      <div className="khPlayRow">
        <button className="khBig khMint" onClick={onPlay}>▶ {gameUnderway ? `Back to your game vs ${opponents[gameOpp].label}` : `Play ${opp.label}`}</button>
        {gameUnderway && <button className="khBig khWhite" onClick={onNewGame}>New game{current !== gameOpp ? ` vs ${opp.label}` : ""}</button>}
      </div>

      <div className="khTiles">
        {thinking && <p className="khSub" style={{ gridColumn: "1 / -1", margin: 0 }}>{opponents[gameOpp].label} is still thinking about your game. Puzzles open in a moment!</p>}
        <button className="khTile" style={{ background: "#FFE9B8" }} onClick={onDaily} disabled={thinking}>
          <span className="khTileArt" aria-hidden="true">📅</span>
          <b>Daily Puzzle{dailyDone ? " ✓" : ""}</b>
          <span>{dailyStreak > 0 ? `🔥 ${dailyStreak} day${dailyStreak === 1 ? "" : "s"} in a row` : "A new one every day"}</span>
        </button>
        <button className="khTile" style={{ background: "#E3F4FF" }} onClick={onPuzzles} disabled={thinking}>
          <span className="khTileArt" aria-hidden="true">🧩</span>
          <b>Puzzles</b>
          <span>Easy · Medium · Hard</span>
        </button>
        <button className="khTile" style={{ background: "#FFE0EA" }} onClick={onRush} disabled={thinking}>
          <span className="khTileArt" aria-hidden="true">⚡</span>
          <b>Puzzle Rush</b>
          <span>{bestRush ? `Best ${bestRush}` : "Beat the clock"}</span>
        </button>
        <button className="khTile" style={{ background: "#E9E0FF" }} onClick={onTrophies}>
          <span className="khTileArt" aria-hidden="true">🏆</span>
          <b>Trophies</b>
          <span>{totalMedals} medal{totalMedals === 1 ? "" : "s"}</span>
        </button>
        <button className="khTile" style={{ background: "#E2F7D9" }} onClick={onShop}>
          <span className="khTileArt" aria-hidden="true">🛍️</span>
          <b>Shop</b>
          <span>Hats, boards, pieces, music</span>
        </button>
      </div>
    </div>
  );
}
