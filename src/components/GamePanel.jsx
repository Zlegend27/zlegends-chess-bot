import { useState } from "react";

/** Replaces the old always-both-visible Scoresheet + Bot Analysis boxes
 *  with one tabbed card. The Analysis tab's actual content (bot eval vs.
 *  puzzle prompt vs. rush HUD vs. quiz vs. opening replay -- five
 *  mutually-exclusive states already computed in App.jsx) is passed in
 *  as `analysisContent` rather than re-derived here, so none of that
 *  real branching logic gets copied/forked into a second place. */
export default function GamePanel({
  pairs, moveGrades, curMoveIdx, reviewing, onReviewIndex, gradeTag,
  hasMoves, onCopyPgn, onPastePgn, pgnToast,
  analysisContent, analysisLabel = "Analysis",
}) {
  const [tab, setTab] = useState("moves");

  return (
    <div className="overflow-hidden rounded-2xl border border-[#8B2FC966] bg-[#1D1038CC] backdrop-blur-sm">
      <div className="flex items-center gap-1 border-b border-[#8B2FC93D] p-1.5">
        <TabButton active={tab === "moves"} onClick={() => setTab("moves")}>Moves</TabButton>
        <TabButton active={tab === "analysis"} onClick={() => setTab("analysis")}>{analysisLabel}</TabButton>
        <div className="ml-auto flex items-center gap-1 pr-0.5">
          {hasMoves ? (
            <PanelBtn onClick={onCopyPgn}>Copy PGN</PanelBtn>
          ) : (
            <PanelBtn onClick={onPastePgn}>Paste PGN</PanelBtn>
          )}
        </div>
      </div>

      <div className="p-4">
        {tab === "moves" ? (
          <div>
            {pairs.length === 0 ? (
              <p className="text-sm italic text-[#9D8FC4]">No moves yet — white to play.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 overflow-y-auto font-mono text-sm">
                {pairs.map(([w, b], i) => {
                  const wGrade = moveGrades && moveGrades[i * 2];
                  const bGrade = moveGrades && moveGrades[i * 2 + 1];
                  return (
                    <div className="contents" key={i}>
                      <span className="text-right tabular-nums text-[#9D8FC4]">{i + 1}.</span>
                      <span
                        className={curMoveIdx === i * 2 ? "font-bold text-[#F5D93E]" : "text-[#F4EFFF]"}
                        style={reviewing ? { cursor: "pointer" } : undefined}
                        onClick={reviewing ? () => onReviewIndex(i * 2 + 1) : undefined}
                      >
                        {w}{wGrade && <span className={"moveGrade " + wGrade}>{gradeTag[wGrade]}</span>}
                      </span>
                      <span
                        className={curMoveIdx === i * 2 + 1 ? "font-bold text-[#F5D93E]" : "text-[#F4EFFF]"}
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
            {pgnToast && <div className="mt-2 font-mono text-xs text-[#3EE7F5]">{pgnToast}</div>}
          </div>
        ) : (
          analysisContent
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 items-center rounded-lg border-0 px-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5] ${
        active ? "bg-[#3EE7F526] text-[#3EE7F5]" : "bg-transparent text-[#9D8FC4] hover:text-[#F4EFFF]"
      }`}
    >
      {children}
    </button>
  );
}

function PanelBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center rounded-lg border-0 bg-transparent px-2.5 text-[11px] font-bold tracking-wide text-[#9D8FC4] transition-colors hover:bg-[#8B2FC926] hover:text-[#F4EFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5]"
    >
      {children}
    </button>
  );
}
