/* The Analysis tab beside the board: one panel per state (puzzle, Rush,
   opening quiz, opening replay, or a game with its post-game report and
   the bot's live search). Moved out of App.jsx; it only reads App's state,
   so everything arrives as a prop under the same name it had there. */
import { sideAccuracy } from "../utils/reviewScoring";
import { fullMoves } from "../utils/moveNumber";
import { GRADE_COLOR, GRADE_TAG } from "../utils/grades";
import EvalGraph from "./EvalGraph";
import BoltIcon from "./BoltIcon";

export default function AnalysisPanel({ activePuzzle, missedAttempt, puzzleSolved, puzzleFeedback, eng, rushMode, rushResult, toggleAnalyze, analyzing, analysisBusy, pz, rushBandIdx, quizOpening, moveList, quizFeedback, activeOpening, replayIndex, grading, gradeProgress, reviewing, moveGrades, mode, pastedGame, playerColor, gradeDetail, reviewIndex, setReviewIndex, practiceQueue, practice, startPractice, info, evalLabel, sweetheart, uiT, playerAdvantageCp }) {
  /* The tab itself is already named (Rush/Puzzle/Quiz/Opening/Analysis via
     analysisLabel), so no state repeats a heading inside its own content
     anymore -- each shows one small context chip where it earns its place,
     then the actual text. Rush deliberately shows no clock/score here:
     the rushHud card above the board already owns those numbers, and
     mirroring them in a second spot was pure clutter. */
  const analysisChip = (text, tone = "dim") => (
    <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
      tone === "gold" ? (sweetheart ? "bg-sh-lgold/15 text-sh-lgold" : "bg-yellow/12 text-yellow")
      : tone === "cyan" ? (sweetheart ? "bg-sh-lteal/15 text-sh-lteal" : "bg-cyan/12 text-cyan")
      : (sweetheart ? "bg-sh-rose/12 " + uiT.dimText : "bg-violet/15 text-dim")
    }`}>{text}</span>
  );
  const analysisHint = (text) => <p className={"m-0 text-[13px] leading-relaxed " + uiT.mutedLabel}>{text}</p>;
  /* Post-game "report card": once Analyze has graded the moves, tally
     each side's brilliants/mistakes/etc so the player gets a chess.com-
     style game summary instead of having to scroll the scoresheet
     counting ?? marks by hand. White's moves are the even plies. */
  const gradeReport = (reviewing && moveGrades) ? (() => {
    /* Pasted/shared games are someone else's moves -- plain White/Black
       there, You/Bot only for games actually played here. */
    const ownGame = mode !== "replay" && !pastedGame;
    const whiteIsYou = ownGame && playerColor === 1;
    const blackIsYou = ownGame && playerColor === -1;
    const tally = (parity) => {
      const counts = { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, miss: 0, mistake: 0, blunder: 0 };
      moveGrades.forEach((g, i) => { if (g && i % 2 === parity) counts[g] += 1; });
      return counts;
    };
    /* There used to be a "~N rated play" figure here too, averaging Rank
       Bot's loss->implied-Elo mapping over the game. It read ~2000 for an 833
       player: a single clean move counts as 3000, so the average runs far too
       high. That mapping was built to nudge a dial, not to be averaged into a
       rating, so it stays off until it's calibrated on real games. */
    const sideStats = (parity) => {
      if (!gradeDetail) return null;
      const acc = sideAccuracy(gradeDetail.plyScores.filter((m, i) => m && i % 2 === parity));
      return acc == null ? null : { acc: Math.round(acc) };
    };
    return {
      cols: [
        { label: whiteIsYou ? "You" : blackIsYou ? "Bot" : "White", counts: tally(0), stats: sideStats(0) },
        { label: blackIsYou ? "You" : whiteIsYou ? "Bot" : "Black", counts: tally(1), stats: sideStats(1) },
      ],
    };
  })() : null;
  return activePuzzle ? (
    missedAttempt ? (
      /* Attempting a puzzle from the heartbreak screen's missed-puzzle
         stepper -- Analyze lives in the Retry/Analyze/Exit row under the
         board here, not embedded in this tab, so this stays a plain hint
         like a normal Daily/Ranked attempt. */
      <div className="flex flex-col gap-2.5">
        {analysisChip(`Rated ${missedAttempt.rating}`, "gold")}
        {analysisHint(puzzleSolved ? "Solved! Nice work." : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
      </div>
    ) : rushMode && rushResult ? (
      /* The run is over but the final puzzle's position is still on the
         board (see rushSummaryOpen/canAnalyze) -- the "find the best
         move" prompt no longer applies, so this swaps to the same
         Analyze toggle every other analyzable mode gets instead. */
      <div className="flex flex-col gap-2.5">
        {analysisChip("Rush over", "gold")}
        {analysisHint("Take a look at the final position, or bring the results back up.")}
        <button
          onClick={toggleAnalyze}
          className="flex h-9 w-fit items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          style={analyzing
            ? { borderColor: "#F06BAE80", background: "#F06BAE1F", color: "var(--sh-rose)" }
            : { borderColor: "#F06BAE3D", background: "#1D0A22CC", color: "var(--sh-dim)" }}
        >
          {analyzing ? (
            <img src="/sweetheart-sprite.webp" alt="" className={"shAnalyzeSpinner" + (analysisBusy ? " busy" : "")} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
            </svg>
          )}
          {analyzing ? (analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
        </button>
      </div>
    ) : rushMode ? (
      <div className="flex flex-col gap-2.5">
        {analysisChip(<><BoltIcon size={11} />{pz.RATING_BANDS[rushBandIdx]?.label || ""}</>, "gold")}
        {analysisHint(puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
      </div>
    ) : (
      <div className="flex flex-col gap-2.5">
        {analysisChip(`Rated ${activePuzzle.rating}`, "gold")}
        {analysisHint(puzzleSolved ? "Solved! Nice work." : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
      </div>
    )
  ) : quizOpening ? (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {analysisChip(quizOpening.name, "cyan")}
        {analysisChip(`Move ${fullMoves(Math.min(moveList.length + 1, quizOpening.moves.length))} of ${fullMoves(quizOpening.moves.length)}`)}
      </div>
      {analysisHint(quizFeedback || `Play ${eng.getSide() === 1 ? "White" : "Black"}'s next move from memory.`)}
    </div>
  ) : activeOpening ? (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {analysisChip(activeOpening.name, "cyan")}
        {analysisChip(activeOpening.eco)}
      </div>
      {analysisHint(replayIndex === 0 ? activeOpening.summary : activeOpening.steps[replayIndex - 1])}
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {grading && (
        <div className="flex flex-col gap-1.5">
          <div className={"text-[12px] " + uiT.dimText}>Grading positions… {gradeProgress}/{moveList.length}</div>
          <div className={"h-1.5 w-full overflow-hidden rounded-full " + (sweetheart ? "bg-sh-rose/20" : "bg-violet/20")}>
            <div
              className={"h-full rounded-full transition-[width] duration-200 ease-out " + (sweetheart ? "bg-sh-lteal" : "bg-cyan")}
              style={{ width: `${Math.min(100, (gradeProgress / moveList.length) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {gradeReport && !grading && (
        <div className={`rounded-xl border p-3 ${sweetheart ? "border-sh-rose/24 bg-sh-lcard/70" : "border-violet/24 bg-[#150C2466]"}`}>
          <div className={"mb-2 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Game report</div>
          {gradeReport.cols.some(c => c.stats) && (
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              {gradeReport.cols.map((col) => (
                <div key={col.label} className={"rounded-lg px-2.5 py-2 text-center " + uiT.panelBg}>
                  <div className={"text-[10px] font-bold uppercase tracking-[0.12em] " + uiT.dimText}>{col.label}</div>
                  <div className={"mt-0.5 text-xl font-bold leading-none " + uiT.interactiveText}>{col.stats ? `${col.stats.acc}%` : "—"}</div>
                  <div className={"mt-1 text-[10px] " + uiT.dimText}>accuracy</div>
                </div>
              ))}
            </div>
          )}
          {gradeDetail && (
            <div className="mb-2.5">
              <EvalGraph scores={gradeDetail.scores} grades={moveGrades} current={reviewIndex} onSeek={setReviewIndex} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {gradeReport.cols.map((col) => (
              <div key={col.label}>
                <div className={"mb-1.5 text-xs font-bold " + uiT.ink}>{col.label}</div>
                <div className="flex flex-col gap-1">
                  {Object.entries(col.counts).map(([g, n]) => (
                    <div key={g} className="flex items-center justify-between gap-1 text-[11px]">
                      <span className={"flex items-center gap-1 capitalize " + uiT.mutedLabel}>
                        <b style={{ color: GRADE_COLOR[g], minWidth: 14 }}>{GRADE_TAG[g]}</b>{g}
                      </span>
                      <span className={n > 0 ? "font-bold " + uiT.ink : uiT.dimText}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {practiceQueue.length > 0 && !practice && (
            <button
              onClick={startPractice}
              className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${uiT.ring} ${sweetheart ? "border-sh-lgold/40 bg-sh-lgold/10 text-sh-lgold hover:border-sh-lgold/70 hover:bg-sh-lgold/18" : "border-yellow/30 bg-yellow/8 text-yellow hover:border-yellow/60 hover:bg-yellow/14"}`}
            >
              🎯 Practice your mistakes ({practiceQueue.length})
            </button>
          )}
        </div>
      )}
      {info ? (
      info.book ? (
        <div className="flex flex-col gap-2.5">
          {analysisChip("Opening book", "cyan")}
          {analysisHint("The bot is playing known theory — analysis starts once it's out of book.")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className={"rounded-xl px-3 py-2.5 " + (sweetheart ? "bg-sh-lcard/80" : "bg-[#150C2480]")}>
              <div className={`text-lg font-bold leading-none ${playerAdvantageCp >= 50 ? uiT.interactiveText : playerAdvantageCp <= -50 ? (sweetheart ? "text-sh-red" : "text-[#FF7B9C]") : uiT.ink}`}>{evalLabel}</div>
              <div className={"mt-1 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Eval</div>
            </div>
            <div className={"rounded-xl px-3 py-2.5 " + (sweetheart ? "bg-sh-lcard/80" : "bg-[#150C2480]")}>
              <div className={"text-lg font-bold leading-none " + uiT.ink}>{info.depth}</div>
              <div className={"mt-1 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Depth</div>
            </div>
          </div>
          {info.pv.length > 0 && (
            <div>
              <div className={"mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] " + uiT.dimText}>Expected line</div>
              <div className="flex flex-wrap gap-1">
                {info.pv.slice(0, 8).map((sanMove, i) => (
                  <span key={i} className={"rounded-md px-1.5 py-0.5 font-mono text-xs " + (sweetheart ? "bg-sh-rose/15 " + uiT.ink : "bg-violet/15 text-paper")}>{sanMove}</span>
                ))}
                {info.pv.length > 8 && <span className={"px-1 py-0.5 text-xs " + uiT.dimText}>+{info.pv.length - 8} more</span>}
              </div>
            </div>
          )}
          <div className={"text-[11px] " + uiT.dimText}>{(info.nodes / 1000).toFixed(0)}k nodes · {(info.time / 1000).toFixed(1)}s</div>
        </div>
      )
    ) : (
      !pastedGame && analysisHint("After each bot move, its eval, search depth, and the line it expects will show up here.")
    )}
    </div>
  );
}
