/* Owl's Adventure map: six islands joined by a dotted path. Owl sits on the
   island she's working on; tapping an open island lists its levels. Locked
   islands say how many stars they need. */
import { useState } from "react";
import { AnimalIcon } from "./AnimalIcon";
import { ISLANDS, levelStars, islandStars, islandOpen, totalStars, currentIsland } from "./kidAdventure";

/* Where each island sits on the map (percent of width, px from the top),
   zig-zagging up from Piece Park at the bottom. */
const SPOTS = [
  { left: "4%", top: 610 }, { left: "52%", top: 490 }, { left: "6%", top: 370 },
  { left: "52%", top: 250 }, { left: "6%", top: 130 }, { left: "50%", top: 10 },
];
const starText = (n, of = 3) => "★".repeat(n) + "☆".repeat(Math.max(0, of - n));

/* `openId`/`onOpen`: the island whose levels are listed, kept by the app so
   coming back from a level shows the same island. */
export default function AdventureMap({ ctx, openId: pickedId, onOpen, onLevel, onBack }) {
  const here = currentIsland(ctx);
  const [ownId, setOwnId] = useState(here.id);
  const openId = pickedId ?? ownId;
  const setOpenId = (id) => { setOwnId(id); onOpen?.(id); };
  const island = ISLANDS.find((i) => i.id === openId) ?? here;
  const total = totalStars(ctx);
  const max = ISLANDS.reduce((s, i) => s + i.levels.length * 3, 0);
  return (
    <div className="khRoot">
      <div className="khTop">
        <button className="khBack" onClick={onBack}>← Home</button>
        <span className="khChip">⭐ {total} / {max}</span>
      </div>
      <h1 className="khTitle">Owl&apos;s Adventure</h1>

      <div className="kaMap">
        <svg className="kaPath" viewBox="0 0 100 760" preserveAspectRatio="none" aria-hidden="true">
          <path d="M22 680 C 50 660, 75 600, 74 550 S 30 470, 26 430 S 70 330, 74 310 S 30 210, 26 190 S 60 90, 74 70" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="0.5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {ISLANDS.map((isl, i) => {
          const open = islandOpen(isl, ctx);
          const got = islandStars(isl, ctx), of = isl.levels.length * 3;
          return (
            <button key={isl.id} className={"kaIsland" + (open ? "" : " kaLocked") + (isl.id === openId ? " kaPicked" : "")}
              style={SPOTS[i]} onClick={() => setOpenId(isl.id)} aria-label={`${isl.name}${open ? `, ${got} of ${of} stars` : `, locked`}`}>
              {/* Owl sits on the island she's working on, whatever the screen width. */}
              <span className="kaBlobWrap">
                <span className="kaBlob" style={{ background: isl.color }} aria-hidden="true">{open ? isl.emoji : "🔒"}</span>
                {isl.id === here.id && <span className="kaOwl" aria-hidden="true"><AnimalIcon kind="Owl" size={40} /></span>}
              </span>
              <b>{isl.name}</b>
              <span className="kaStars">{open ? `⭐ ${got}/${of}` : `needs ⭐ ${isl.needs}`}</span>
            </button>
          );
        })}
      </div>

      <section className="khCard kaSheet">
        <h2 className="khQuestTitle"><span style={{ color: "inherit", fontSize: 22 }}>{island.emoji} {island.name}</span><span>⭐ {islandStars(island, ctx)}/{island.levels.length * 3}</span></h2>
        <p className="khSub" style={{ margin: "0 0 8px" }}>{island.blurb}</p>
        {!islandOpen(island, ctx) ? (
          <div className="khChest"><span className="khChestIcon" aria-hidden="true">🔒</span><span>Earn {island.needs - total} more ⭐ to open {island.name}. Stars come from the levels on the open islands.</span></div>
        ) : (
          <div className="kaLevels">
            {island.levels.map((l) => {
              const got = levelStars(l, ctx);
              return (
                <button key={l.id} className={"kaLevel" + (got ? " kaDone" : "") + (l.boss ? " kaBoss" : "")} onClick={() => onLevel(l)}>
                  <span className="kaLevelIcon" aria-hidden="true">{l.icon}</span>
                  <span className="kaLevelName">{l.title}</span>
                  <span className="kaLevelStars" aria-label={`${got} stars`}>{starText(got)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
