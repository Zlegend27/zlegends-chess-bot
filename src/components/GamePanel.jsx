import { useEffect, useState } from "react";
import { getUiTheme } from "../utils/uiTheme";

/** Replaces the old always-both-visible Scoresheet + Bot Analysis boxes
 *  with one tabbed card. The Analysis tab's actual content (bot eval vs.
 *  puzzle prompt vs. rush HUD vs. quiz vs. opening replay -- five
 *  mutually-exclusive states already computed in App.jsx) is passed in
 *  as `analysisContent` rather than re-derived here, so none of that
 *  real branching logic gets copied/forked into a second place. */
export default function GamePanel({
  pairs, moveGrades, curMoveIdx, reviewing, onReviewIndex, gradeTag,
  hasMoves, onCopyPgn, onPastePgn, pgnToast,
  analysisContent, analysisLabel = "Analysis", sideToMove = "White", sweetheart,
}) {
  const [tab, setTab] = useState("moves");
  const T = getUiTheme(sweetheart);

  /* App.jsx clears pgnToast with a hard setTimeout, which used to make
     the message vanish instantly. Mirroring it into local state that
     outlives the parent's null lets the CSS opacity transition actually
     play before the node unmounts, instead of snapping. */
  const [toastText, setToastText] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    if (pgnToast) { setToastText(pgnToast); setToastVisible(true); }
    else setToastVisible(false);
  }, [pgnToast]);
  useEffect(() => {
    if (toastVisible || !toastText) return;
    const t = setTimeout(() => setToastText(null), 300);
    return () => clearTimeout(t);
  }, [toastVisible, toastText]);

  return (
    <div className={`overflow-hidden rounded-2xl border ${T.cardBorder} ${T.panelBg} backdrop-blur-sm`}>
      <div className={"flex items-center gap-1 border-b p-1.5 " + (sweetheart ? "border-sh-rose/24" : "border-violet/24")}>
        <TabButton active={tab === "moves"} onClick={() => setTab("moves")} sweetheart={sweetheart}>Moves</TabButton>
        <TabButton active={tab === "analysis"} onClick={() => setTab("analysis")} sweetheart={sweetheart}>{analysisLabel}</TabButton>
        <div className="ml-auto flex items-center gap-1 pr-0.5">
          {hasMoves ? (
            <PanelBtn onClick={onCopyPgn} sweetheart={sweetheart}>Copy PGN</PanelBtn>
          ) : (
            <PanelBtn onClick={onPastePgn} sweetheart={sweetheart}>Paste PGN</PanelBtn>
          )}
        </div>
      </div>

      <div className="p-4">
        {tab === "moves" ? (
          <div>
            {pairs.length === 0 ? (
              <p className={"text-sm italic " + T.dimText}>No moves yet — {sideToMove} to play.</p>
            ) : (
              <div className="grid max-h-56 md:max-h-72 grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 overflow-y-auto font-mono text-sm">
                {pairs.map(([w, b], i) => {
                  const wGrade = moveGrades && moveGrades[i * 2];
                  const bGrade = moveGrades && moveGrades[i * 2 + 1];
                  return (
                    <div className="contents" key={i}>
                      <span className={"text-right tabular-nums " + T.dimText}>{i + 1}.</span>
                      <span
                        className={curMoveIdx === i * 2 ? "font-bold " + T.accentText : T.ink}
                        style={reviewing ? { cursor: "pointer" } : undefined}
                        onClick={reviewing ? () => onReviewIndex(i * 2 + 1) : undefined}
                      >
                        {w}{wGrade && <span className={"moveGrade " + wGrade}>{gradeTag[wGrade]}</span>}
                      </span>
                      <span
                        className={curMoveIdx === i * 2 + 1 ? "font-bold " + T.accentText : T.ink}
                        style={reviewing && b ? { cursor: "pointer" } : undefined}
                        onClick={reviewing && b ? () => onReviewIndex(i * 2 + 2) : undefined}
                      >
                        {b || ""}{bGrade && <span className={"moveGrade " + bGrade}>{gradeTag[bGrade]}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {toastText && (
              <div className={`mt-2 font-mono text-xs ${T.interactiveText} transition-opacity duration-300 ${toastVisible ? "opacity-100" : "opacity-0"}`}>
                {toastText}
              </div>
            )}
          </div>
        ) : (
          analysisContent
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, sweetheart }) {
  const T = getUiTheme(sweetheart);
  return (
    <button
      onClick={onClick}
      className={`flex h-8 items-center rounded-lg border-0 px-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 ${T.ring} ${
        active ? (sweetheart ? "bg-sh-lteal/15 text-sh-lteal" : "bg-cyan/15 text-cyan") : "bg-transparent " + T.dimText + " " + T.hoverInk
      }`}
    >
      {children}
    </button>
  );
}

function PanelBtn({ onClick, children, sweetheart }) {
  const T = getUiTheme(sweetheart);
  return (
    <button
      onClick={onClick}
      className={`flex h-8 items-center rounded-lg border-0 bg-transparent px-2.5 text-[11px] font-bold tracking-wide ${T.dimText} transition-colors ${sweetheart ? "hover:bg-sh-rose/15" : "hover:bg-violet/15"} ${T.hoverInk} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
    >
      {children}
    </button>
  );
}
