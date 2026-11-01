import { Suspense } from "react";
import { WN, WB, WR, WQ, WK, mPromo } from "../engine/chessEngine";
import PixelAvatar, { ZPAL, ZPIX } from "../components/PixelAvatar";
import StarField from "../components/StarField";
import Confetti from "../components/Confetti";
import Modal from "../components/Modal";
import GamePanel from "../components/GamePanel";
import BotBubble from "../components/BotBubble";
import { DIFFICULTIES } from "../utils/difficulties";
import { RANK_BOT_ASSESSMENT_EVERY } from "../utils/rankBotMath";
import { RUSH_DURATIONS } from "../utils/rushDurations";

/* The game screen: the board, the bot card, the move list and the controls
   for a live game, a puzzle, a review or a rush. Loaded when a game starts
   (see App.jsx). Everything it reads or does comes in as a prop. */
export default function PlayView({ rankTestNote, GRADE_COLOR, GRADE_TAG, MoodImg, RushThemeArt, Tray, activeOpening, activePuzzle, analysisBusy, analysisContent, analysisLabel, analysisMove, analyzing, arrowLine, beginRestartCountdown, bestArrow, boardColorId, boardRef, boardVars, botColor, botLine, botMood, botTaken, colorPick, curMoveIdx, difficultyIdx, difficultyRef, displayName, dragCellSize, dragFrom, dragPos, eng, evalLabel, evalPawns, exitMissedAttempt, exitPractice, exitPuzzle, exitReplay, exitRush, formatClock, gameStyle, gradeDetail, gradeProgress, grading, hideEvalBar, hideRushSummary, hinting, inChk, liveOpening, missedAttempt, missedStepIdx, mode, moveGrades, moveList, nameDraft, nameEditOpen, newGame, newGameConfirm, nextPuzzle, onCopyPgn, onDifficultyChange, onHint, onMissedSwipeEnd, onMissedSwipeStart, openLeaderboard, openReviewPage, pairs, pastedGame, pauseSpectate, pgnToast, pieceImgSrc, pieceSetId, playMove, playerAdvantageCp, playerColor, playerShare, practice, practiceMove, practiceNext, practiceReveal, promo, puzzleBand, puzzleFeedback, puzzleMove, puzzleSolved, pz, quizDoneToast, quizMove, quizOpening, rankBotAssessedElo, rankBotGames, ratingInfo, replayFull, replayIndex, replayPlaying, replayStep, restartCountdown, result, resumeSpectate, reviewIndex, reviewInfo, reviewMissedPuzzle, reviewing, rows, rushBandIdx, rushBestMap, rushDuration, rushLifetime, rushMilestone, rushMissed, rushMistakes, rushMode, rushResult, rushSolved, rushSummaryOpen, rushTimeLeft, saveDisplayName, setBotLine, setColorPick, setMissedStepIdx, setNameDraft, setNameEditOpen, setNewGameConfirm, setPlayerColor, setPromo, setReplayIndex, setReviewIndex, setRushSummaryOpen, setShareLinkFallback, setShareToast, setSiteView, shareLinkFallback, shareToast, spectateBlackIdx, spectateMode, spectateOpeningId, spectatePaused, spectateWhiteIdx, startPuzzle, startQuiz, startSpectate, status, stopSpectate, sweetheart, thinking, toggleAnalyze, toggleReplayPlay, uiT, undo, youDiff, youTaken }) {
  return (
    <div className={"root" + (hideEvalBar ? " noEval" : "") + (boardColorId === "standard" ? " theme-standard" : "")} style={boardVars}>
      <StarField sweetheart={sweetheart} />
      {rushMilestone > 0 && <Confetti key={rushMilestone} />}
      <div className="layout">
        <div className="boardCol">
          {rushMode ? (
            <div className="card rushHud">
              {rushDuration == null ? (
                <div className="rushClock rushClockInfinite" aria-label="No timer">&#8734;</div>
              ) : (
                <div className={"rushClock" + (rushTimeLeft <= 10 ? " low" : "")}>{formatClock(rushTimeLeft)}</div>
              )}
              <div className="rushHudBody">
                <div className="rushHudTop">
                  <span className="rushHudBand">{pz.RATING_BANDS[rushBandIdx]?.label || ""}</span>
                  <span className="rushHudSolved">Solved {rushSolved}</span>
                </div>
                <div className="rushMistakeBoxes" aria-label={`${rushMistakes} of 3 mistakes`}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className={"rushMistakeBox" + (i < rushMistakes ? " filled" : "")} />
                  ))}
                </div>
                <div className="rushHudLifetime">Lifetime solved: {rushLifetime}</div>
              </div>
            </div>
          ) : activePuzzle ? (
            /* Neither the Rush HUD (clock/mistakes, a solo race) nor the
               bot-facing card (avatar/mood/name, an opponent framing) fit
               an untimed Daily/Ranked puzzle -- there's no clock and no
               one to "face", just a position and a rating. */
            <div className="card puzzleHud">
              <div className="avatarBox">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--cyan)" aria-hidden="true">
                  <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
                </svg>
              </div>
              <div className="cardMeta">
                <div className="puzzleHudLabel">{puzzleBand ? `${puzzleBand.label} Puzzle` : "Daily Puzzle"}</div>
                <div className="trayEmpty puzzleMeta">Rated {activePuzzle.rating}</div>
              </div>
            </div>
          ) : (
            <div className={"card botCard" + (mode === "play" && !result && !thinking && !pastedGame && eng.getSide() === botColor ? " turnGlow" : "")}>
              <div className={"avatarBox" + (!pastedGame && botMood !== "neutral" ? " reactionBox " + botMood : "")}>
                {pastedGame ? <img src={pieceImgSrc(WK, botColor === 1)} alt="" className="reviewAvatarPc" /> : (
                  <>
                    {botMood === "angry" && <MoodImg src="/bot-angry.webp" alt="Zlegend2700 is furious" />}
                    {botMood === "happy" && <MoodImg src="/bot-happy.webp" alt="Zlegend2700 is thrilled" />}
                    {botMood === "neutral" && <PixelAvatar rows={ZPIX} pal={ZPAL} size={44} />}
                  </>
                )}
              </div>
              <div className="cardMeta">
                <div className="cardName bot">{pastedGame && reviewInfo ? (botColor === 1 ? reviewInfo.white : reviewInfo.black) : spectateMode ? `${DIFFICULTIES[botColor === 1 ? spectateWhiteIdx : spectateBlackIdx].label} (${botColor === 1 ? "White" : "Black"})` : "Zlegend2700"}</div>
                {!pastedGame && <div className="trayEmpty">{gameStyle.label} today</div>}
                {!spectateMode && !pastedGame && difficultyRef.current.id === "rank" && (
                  /* The checkpointed level, not the live dial. rankBotElo
                     moves after every move and was being printed straight
                     here, so the bot's own card could read a different
                     number from the player card a second later. The
                     checkpoint only changes every few games, and is the
                     same number the player card shows. */
                  <div className="trayEmpty openingTag" title="Rank Bot adapts to how you play">
                    {rankBotAssessedElo == null
                      ? "Still learning your level"
                      : `Playing around ~${rankBotAssessedElo} Elo`}
                  </div>
                )}
                {liveOpening && (
                  <div className="trayEmpty openingTag">{liveOpening.name} · {liveOpening.eco}</div>
                )}
                <Tray pieces={botTaken} colorClass={playerColor === 1 ? "wpc" : "bpc"} />
              </div>
              {youDiff < 0 && <div className="lead">+{-youDiff}</div>}
            </div>
          )}

          {botLine && mode === "play" && !spectateMode && !activePuzzle && !rushMode && (
            <BotBubble line={botLine} avatarSize={32} className="mt-1" onDismiss={() => setBotLine(null)} />
          )}

          <div className="boardWrap">
            {!hideEvalBar && (
              <div className="evalbar" title={"Eval " + evalLabel} role="img" aria-label={`Evaluation: ${evalLabel}, ${playerAdvantageCp >= 0 ? "you're ahead" : "bot is ahead"}`}>
                <div className="pfill" style={{ height: playerShare + "%" }} />
                <div className="tick" />
                {/* Numeric readout for power users, not just the fill
                   height -- only past +/-0.5 so it's not fighting the
                   tick mark right at a dead-even position. .pfill is
                   height-driven from the bottom (column-reverse), and
                   whiteShare/playerShare is clamped to [4,96] -- so the
                   very top of the bar is *always* still background, even
                   at a near-total advantage. One fixed position/color
                   that's always legible, rather than needing to track
                   which region currently owns which pixel. */}
                {Math.abs(evalPawns) >= 0.5 && (
                  <span className="evalNum">{evalLabel}</span>
                )}
              </div>
            )}
            <div style={{ position: "relative", flex: 1 }}>
              <div className="board" role="grid" aria-label="Chess board" ref={boardRef}>
                {rows}
                {arrowLine && (() => {
                  /* One geometry for every theme now (see arrowLine above)
                     -- only the color differs: chess.com green on the
                     Standard board, this app's yellow everywhere else. */
                  const std = boardColorId === "standard";
                  const color = std ? "#15A310" : "#F5D93E";
                  const opacity = std ? 0.8 : 0.85;
                  return (
                    <svg className="arrowLayer" viewBox="0 0 8 8">
                      <path d={arrowLine.path} fill="none" stroke={color} strokeOpacity={opacity}
                        strokeWidth="0.26" strokeLinecap="round" strokeLinejoin="round" />
                      <polygon points={arrowLine.head} fill={color} fillOpacity={opacity} />
                    </svg>
                  );
                })()}
                {promo && (
                  <div className="promoOv">
                    <div className="promoBox pieceBox">
                      {[WQ, WR, WB, WN].map(pp => (
                        <button key={pp} onClick={() => {
                          const m = promo.moves.find(x => mPromo(x) === pp);
                          setPromo(null);
                          if (m) (activePuzzle ? puzzleMove(m) : quizOpening ? quizMove(m) : (practice && !practice.done) ? practiceMove(m) : analyzing ? analysisMove(m) : playMove(m));
                        }}>
                          <img className={"pc " + (eng.getSide() === 1 ? "w" : "b")} style={{ width: 44, height: 44 }} src={pieceImgSrc(pp, eng.getSide() === 1)} alt="" draggable="false" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {colorPick && (
                  <div className="promoOv">
                    <div className="promoBox pieceBox">
                      <button onClick={() => { setColorPick(false); newGame(1); }} title="Play as White">
                        <img className="pc w" style={{ width: 44, height: 44 }} src={pieceImgSrc(1, true)} alt="" draggable="false" />
                      </button>
                      <button onClick={() => { setColorPick(false); newGame(-1); }} title="Play as Black">
                        <img className="pc b" style={{ width: 44, height: 44 }} src={pieceImgSrc(1, false)} alt="" draggable="false" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {dragFrom >= 0 && dragPos && (
                <img className={"pc dragGhost " + (eng.pieceAt(dragFrom) > 0 ? "w" : "b") + (pieceSetId === "sweetheart" && Math.abs(eng.pieceAt(dragFrom)) === 6 ? " kingBoost" : "") + (pieceSetId === "sweetheart" && eng.pieceAt(dragFrom) === -2 ? " knightBoost" : "")}
                  src={pieceImgSrc(Math.abs(eng.pieceAt(dragFrom)), eng.pieceAt(dragFrom) > 0)}
                  alt="" draggable="false"
                  style={{ left: dragPos.x, top: dragPos.y, width: dragCellSize, height: dragCellSize }} />
              )}
            </div>
          </div>

          {rankTestNote && (
            <div className="text-center font-mono text-xs" style={{ color: "var(--dim)" }}>
              Test mode{rankTestNote.step != null && <> · lead {(rankTestNote.lead / 100).toFixed(1)} · step {(rankTestNote.step / 100).toFixed(1)} · you ~{rankTestNote.playerElo} (up to {rankTestNote.potential}) · {rankTestNote.mode} · {(rankTestNote.totalMs / 1000).toFixed(1)}s</>}
            </div>
          )}
          <div className={"card youCard" + (mode === "play" && !result && !thinking && !pastedGame && eng.getSide() === playerColor ? " turnGlow" : "")}>
            <div className="avatarBox">
              {pastedGame
                ? <img src={pieceImgSrc(WK, playerColor === 1)} alt="" className="reviewAvatarPc" />
                : <img src="/you-avatar.webp" alt="You (Challenger)" className="youAvatarImg" />}
            </div>
            <div className="cardMeta">
              <div className="cardName you" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{pastedGame && reviewInfo ? (playerColor === 1 ? reviewInfo.white : reviewInfo.black) : spectateMode ? `${DIFFICULTIES[playerColor === 1 ? spectateWhiteIdx : spectateBlackIdx].label} (${playerColor === 1 ? "White" : "Black"})` : (displayName || "Challenger")}</span>
                {!spectateMode && !pastedGame && (
                  <button className="nameEditBtn" onClick={() => { setNameDraft(displayName); setNameEditOpen(true); }} title="Edit your name" aria-label="Edit your name">✎</button>
                )}
              </div>
              {pastedGame ? null : !spectateMode && !activePuzzle && !rushMode && difficultyRef.current.id === "rank" ? (
                <div className="trayEmpty" style={{ color: "var(--cyan)" }}>
                  {rankBotAssessedElo == null
                    ? `Calibrating Elo — game ${(rankBotGames % RANK_BOT_ASSESSMENT_EVERY) + 1}/${RANK_BOT_ASSESSMENT_EVERY}`
                    : `~${rankBotAssessedElo} Elo`}
                </div>
              ) : (
                !spectateMode && ratingInfo && !ratingInfo.error && ratingInfo.games > 0 && (
                  <div className="trayEmpty" style={{ color: "var(--cyan)" }}>~{ratingInfo.rating} Elo</div>
                )
              )}
              {activePuzzle ? (
                <div className="trayEmpty puzzleMeta">
                  {rushMode
                    ? (puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)
                    : (puzzleSolved ? "Solved! Nice work." : puzzleFeedback || `Find the best move for ${eng.getSide() === 1 ? "White" : "Black"}.`)}
                </div>
              ) : (
                <Tray pieces={youTaken} colorClass={playerColor === 1 ? "bpc" : "wpc"} />
              )}
            </div>
            {youDiff > 0 && <div className="lead">+{youDiff}</div>}
          </div>

          <div className="statusRow">
            <span className={"status" + (result ? " over" : "")} aria-live="polite">{status}</span>
            {inChk && <span className="bang">!!</span>}
            {mode === "replay" && <span className="replayBadge">{activeOpening ? "Opening" : "Replay"}</span>}
            {reviewing && <span className="replayBadge">Move {reviewIndex}/{moveList.length}</span>}
          </div>

          {mode === "replay" && (
            <div className="ctrls replayCtrls" style={{ justifyContent: "center" }}>
              <button className="btn ghost" onClick={() => setReplayIndex(0)} disabled={replayIndex === 0}>{"|◀"}</button>
              <button className="btn ghost" onClick={() => replayStep(-1)} disabled={replayIndex === 0}>{"◀"}</button>
              <button className="btn" onClick={toggleReplayPlay} disabled={replayIndex >= replayFull.length && !replayPlaying}>
                {replayPlaying ? "Pause" : "Play"}
              </button>
              <button className="btn ghost" onClick={() => replayStep(1)} disabled={replayIndex >= replayFull.length}>{"▶"}</button>
              <button className="btn ghost" onClick={() => setReplayIndex(replayFull.length)} disabled={replayIndex >= replayFull.length}>{"▶|"}</button>
              <button className={"btn" + (analyzing ? "" : " ghost")} onClick={toggleAnalyze}>
                {analyzing ? (analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
              </button>
              {activeOpening && <button className="btn gold" onClick={() => startQuiz(activeOpening)}>Try the Opening</button>}
              <button className="btn gold" onClick={exitReplay}>Start your own game</button>
            </div>
          )}

          {reviewing && (() => {
            /* Modern segmented stepper + a distinct Analyze toggle. The
               .reviewCtrls class stays on the wrapper -- the mobile
               media query keys its flex `order` off it. Every plain
               button needs an explicit bg-* (no Tailwind preflight in
               this build; without one they render native gray). */
            const stepBtn = `flex h-9 w-9 items-center justify-center bg-transparent ${uiT.mutedLabel} transition-colors ${uiT.hoverInk} disabled:opacity-30 disabled:hover:${uiT.mutedLabel} focus-visible:outline-none focus-visible:ring-2 ${uiT.ring}`;
            const chev = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
            /* Jump between the moves that decided the game instead of
               stepping through every quiet ply -- grades[i] belongs to
               reviewIndex i+1 (the position after that move played). */
            const isKeyMoment = (g) => g === "mistake" || g === "blunder" || g === "miss";
            const prevMistake = moveGrades ? (() => {
              for (let i = reviewIndex - 1; i >= 1; i--) if (isKeyMoment(moveGrades[i - 1])) return i;
              return null;
            })() : null;
            const nextMistake = moveGrades ? (() => {
              for (let i = reviewIndex + 1; i <= moveList.length; i++) if (isKeyMoment(moveGrades[i - 1])) return i;
              return null;
            })() : null;
            const bang = (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11 4h2v11h-2zM11 17.5h2v2.5h-2z" />
              </svg>
            );
            return (
              <div className="reviewCtrls mt-1 flex items-center justify-center gap-2">
                <div className={`flex items-center overflow-hidden rounded-xl border backdrop-blur-sm ${uiT.cardBorder} ${uiT.panelBg}`}>
                  <button className={stepBtn} onClick={() => setReviewIndex(0)} disabled={reviewIndex === 0} aria-label="First move">
                    {chev("M6 6h2v12H6zm3.5 6 8.5 6V6z")}
                  </button>
                  <button className={stepBtn} onClick={() => setReviewIndex(i => Math.max(0, i - 1))} disabled={reviewIndex === 0} aria-label="Previous move">
                    {chev("M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z")}
                  </button>
                  <span className={"min-w-[52px] px-1 text-center font-mono text-[11px] tabular-nums " + uiT.dimText}>
                    {reviewIndex}/{moveList.length}
                  </span>
                  <button className={stepBtn} onClick={() => setReviewIndex(i => Math.min(moveList.length, i + 1))} disabled={reviewIndex === moveList.length} aria-label="Next move">
                    {chev("M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z")}
                  </button>
                  <button className={stepBtn} onClick={() => setReviewIndex(moveList.length)} disabled={reviewIndex === moveList.length} aria-label="Last move">
                    {chev("M16 6h2v12h-2zM6 18l8.5-6L6 6z")}
                  </button>
                  {/* Not every outside game says which side was "you".
                      playerColor only sets the orientation for these games,
                      so flipping it moves the cards, trays and eval bar
                      along with the board. */}
                  {pastedGame && (
                    <button className={stepBtn} onClick={() => setPlayerColor(c => -c)} aria-label="Flip board" title="Flip board">
                      {chev("M7 3 3 7h3v9h2V7h3L7 3zm10 18 4-4h-3V8h-2v9h-3l4 4z")}
                    </button>
                  )}
                  {moveGrades && (
                    <>
                      <span className={"h-5 w-px " + (sweetheart ? "bg-sh-rose/40" : "bg-violet/40")} aria-hidden="true" />
                      <button className={stepBtn.replace("w-9 ", "px-1 ") + (sweetheart ? " -space-x-1 text-sh-red hover:text-[#E0576B] disabled:hover:text-sh-red" : " -space-x-1 text-[#F05348] hover:text-[#FF7B6E] disabled:hover:text-[#F05348]")}
                        onClick={() => setReviewIndex(prevMistake)} disabled={prevMistake == null}
                        aria-label="Previous mistake" title="Previous mistake">
                        {chev("M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z")}{bang}
                      </button>
                      <button className={stepBtn.replace("w-9 ", "px-1 ") + (sweetheart ? " -space-x-1 text-sh-red hover:text-[#E0576B] disabled:hover:text-sh-red" : " -space-x-1 text-[#F05348] hover:text-[#FF7B6E] disabled:hover:text-[#F05348]")}
                        onClick={() => setReviewIndex(nextMistake)} disabled={nextMistake == null}
                        aria-label="Next mistake" title="Next mistake">
                        {bang}{chev("M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z")}
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={toggleAnalyze}
                  className={`flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 ${uiT.ring} ${
                    analyzing
                      ? (sweetheart ? "border-sh-lteal/50 bg-sh-lteal/12 text-sh-lteal" : "border-cyan/50 bg-cyan/12 text-cyan")
                      : `${uiT.cardBorder} ${uiT.panelBg} ${uiT.mutedLabel} ${sweetheart ? "hover:border-sh-lteal/40" : "hover:border-cyan/40"} ${uiT.hoverInk}`
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
                  </svg>
                  {analyzing ? (grading ? `Grading ${gradeProgress}/${moveList.length}` : "Analyzing") : "Analyze"}
                </button>
              </div>
            );
          })()}
          {practice && (() => {
            /* Practice drill banner. States: finished the whole queue,
               wandered off the drill position (stepper), solved this one,
               or still trying. Kept under the stepper where the coaching
               line normally lives -- which stays hidden during practice,
               since it literally prints the answer. */
            const btn = `rounded-lg border ${uiT.cardBorder} bg-transparent px-2.5 py-1 text-[11px] font-bold ${uiT.mutedLabel} transition-colors ${sweetheart ? "hover:border-sh-lteal/50" : "hover:border-cyan/40"} ${uiT.hoverInk} focus-visible:outline-none focus-visible:ring-2 ${uiT.ring}`;
            const atDrill = reviewIndex === practice.queue[practice.idx];
            const ply = practice.queue[practice.idx];
            const sideName = ply % 2 === 0 ? "White" : "Black";
            return (
              <div className={`reviewCtrls mt-1.5 flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] backdrop-blur-sm ${uiT.accentBorder} ${uiT.panelBg} ${uiT.ink}`} style={{ maxWidth: 420 }}>
                {practice.done ? (
                  <>
                    <span>🎉 That's all {practice.queue.length} — nice work!</span>
                    <button className={btn} onClick={exitPractice}>Done</button>
                  </>
                ) : practice.feedback === "correct" ? (
                  <>
                    <span className={"font-bold " + (sweetheart ? "text-[#1E9E5A]" : "text-[#6FCF97]")}>Correct!</span>
                    <button className={btn} onClick={practiceNext}>Next puzzle →</button>
                    <button className={btn} onClick={exitPractice}>Close practice</button>
                  </>
                ) : !atDrill ? (
                  <>
                    <span className={uiT.dimText}>Practice paused</span>
                    <button className={btn} onClick={() => setReviewIndex(ply)}>Resume</button>
                    <button className={btn} onClick={exitPractice}>Close practice</button>
                  </>
                ) : (
                  <>
                    <span>
                      <b className={uiT.accentText}>{practice.idx + 1}/{practice.queue.length}</b> · Find the better move for {sideName}
                      {practice.feedback === "wrong" && <b className={sweetheart ? "text-sh-red" : "text-[#F05348]"}> — not quite, try again</b>}
                    </span>
                    {!practice.revealed && <button className={btn} onClick={practiceReveal}>Show answer</button>}
                    <button className={btn} onClick={practiceNext}>Skip</button>
                    <button className={btn} onClick={exitPractice}>Close practice</button>
                  </>
                )}
              </div>
            );
          })()}
          {reviewing && moveGrades && reviewIndex >= 1 && !practice && (() => {
            /* "You played Qh5?, best was Nf3" -- the coaching line for the
               move currently on the board, straight from the bestSans the
               grading pass already computed. Only graded slips get it;
               clean moves need no second-guessing. */
            const g = moveGrades[reviewIndex - 1];
            if (g !== "inaccuracy" && g !== "mistake" && g !== "blunder" && g !== "miss") return null;
            const best = gradeDetail?.bestSans?.[reviewIndex - 1];
            const played = moveList[reviewIndex - 1];
            if (!best || best === played) return null;
            return (
              <div className="status analyzeHint" style={{ fontSize: 11, opacity: 0.9, textTransform: "none" }}>
                <b style={{ color: GRADE_COLOR[g] }}>{played}{GRADE_TAG[g]}</b>
                <span style={{ opacity: 0.8 }}> — {g === "miss" ? "missed" : "best was"} </span>
                <b style={{ color: "#6FCF97" }}>{best}</b>
              </div>
            );
          })()}
          {analyzing && (
            <div className="status analyzeHint" style={{ fontSize: 11, opacity: 0.85 }}>
              {bestArrow?.san
                ? <>Best move: <b style={{ color: boardColorId === "standard" ? "#4CBB47" : sweetheart ? "#F06BAE" : "#F5D93E", textTransform: "none" }}>{bestArrow.san}</b> · move any piece to explore</>
                : analysisBusy ? "Finding the best move…" : "Move any piece to explore the position"}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="gamePanelSlot">
            <GamePanel
              pairs={pairs} moveGrades={moveGrades} curMoveIdx={curMoveIdx} reviewing={reviewing}
              onReviewIndex={setReviewIndex} gradeTag={GRADE_TAG}
              hasMoves={moveList.length > 0} onCopyPgn={onCopyPgn}
              onPastePgn={activePuzzle ? null : openReviewPage}
              openAnalysis={pastedGame || (reviewing && analyzing)}
              pgnToast={pgnToast}
              analysisContent={analysisContent} analysisLabel={analysisLabel}
              sideToMove={eng.getSide() === 1 ? "White" : "Black"}
              sweetheart={sweetheart}
            />
          </div>

          {pastedGame && mode === "play" && (
            <div className="ctrls playCtrls">
              <button className="btn gold" onClick={openReviewPage}>Review Another</button>
              <button className="btn ghost" onClick={() => { setPromo(null); setColorPick(true); }}>Play a Game</button>
            </div>
          )}
          {mode === "play" && !activePuzzle && !spectateMode && !pastedGame && (
            <div className="ctrls playCtrls">
              <button className="btn" onClick={() => {
                if (!result && eng.plyCount() > 4) setNewGameConfirm(true);
                else { setPromo(null); setColorPick(true); }
              }}>New</button>
              <button className="btn" onClick={undo} disabled={thinking || !!result || eng.plyCount() === 0}>Undo</button>
              <button className="btn ghost" onClick={onHint}
                disabled={thinking || hinting || !!result || !!promo || !!quizOpening || eng.getSide() !== playerColor}>
                {hinting ? "Thinking…" : "Best Move"}
              </button>
              {(moveList.length === 0 || !!result) && (
                <select value={difficultyIdx} onChange={e => onDifficultyChange(Number(e.target.value))}>
                  {DIFFICULTIES.map((d, i) => <option key={i} value={i}>{d.adaptive ? d.label : "Level: " + d.label}</option>)}
                </select>
              )}
              {result && <button className="btn gold" onClick={() => newGame(playerColor)}>Rematch!</button>}
              {shareToast && <div className="toast">{shareToast}</div>}
              {quizDoneToast && <div className="toast">{quizDoneToast}</div>}
            </div>
          )}
          {newGameConfirm && (
            <div className="newGameConfirm">
              <span>Abandon this game?</span>
              <button className="btn gold" style={{ minHeight: 30, padding: "5px 12px", fontSize: 11 }}
                onClick={() => { setNewGameConfirm(false); setPromo(null); setColorPick(true); }}>Yes, start new</button>
              <button className="btn ghost" style={{ minHeight: 30, padding: "5px 12px", fontSize: 11 }}
                onClick={() => setNewGameConfirm(false)}>Cancel</button>
            </div>
          )}

          {spectateMode && (
            <div className="ctrls playCtrls">
              {result ? (
                <button className="btn gold" onClick={() => startSpectate(spectateWhiteIdx, spectateBlackIdx, spectateOpeningId)}>Watch Again</button>
              ) : spectatePaused ? (
                <>
                  <button className="btn gold" onClick={resumeSpectate}>Resume</button>
                  <button className={"btn" + (analyzing ? "" : " ghost")} onClick={toggleAnalyze}>
                    {analyzing ? "Analyzing" : "Analyze"}
                  </button>
                </>
              ) : (
                <button className="btn ghost" onClick={pauseSpectate}>Pause</button>
              )}
              <button className="btn ghost" onClick={stopSpectate}>Stop watching</button>
            </div>
          )}
          {spectateMode && spectatePaused && analyzing && (
            <div className="status analyzeHint" style={{ fontSize: 11, opacity: 0.8 }}>
              Move any piece to explore — Resume discards exploratory moves and lets the bots continue
            </div>
          )}

          {activePuzzle && !rushMode && (
            <div className="ctrls puzzleCtrls">
              <button className="btn ghost" onClick={() => startPuzzle(activePuzzle)}>Retry</button>
              <button className="btn gold" onClick={nextPuzzle}>Next Puzzle</button>
              <button className="btn ghost" onClick={() => { exitPuzzle(); setSiteView("puzzlesHome"); }}>Back to puzzles</button>
            </div>
          )}

          {activePuzzle && rushMode && !rushResult && (
            <div className="ctrls puzzleCtrls">
              <button className="btn ghost" onClick={exitRush}>End Rush</button>
            </div>
          )}

          {/* Once a run has ended, End Rush no longer applies -- Results
             brings the heartbreak screen back if it's been dismissed
             (never shown alongside it, no redundant control), Puzzles
             actually leaves. Not shown during a missed-puzzle attempt --
             that gets its own row below instead. */}
          {activePuzzle && rushMode && rushResult && !missedAttempt && (
            <div className="ctrls puzzleCtrls">
              {!rushSummaryOpen && (
                <button className="btn ghost" onClick={() => setRushSummaryOpen(true)}>Results</button>
              )}
              <button className="btn ghost" onClick={exitRush}>Puzzles</button>
            </div>
          )}

          {/* Attempting a puzzle from the heartbreak screen's missed-
             puzzle stepper -- Exit goes back to the summary (with the
             other missed puzzles still there), not out of the rush. */}
          {activePuzzle && missedAttempt && (
            <div className="ctrls puzzleCtrls">
              <button className="btn ghost" onClick={() => startPuzzle(missedAttempt)}>Retry</button>
              <button className={"btn" + (analyzing ? "" : " ghost")} onClick={toggleAnalyze}>
                {analyzing ? (analysisBusy ? "Analyzing…" : "Analyzing") : "Analyze"}
              </button>
              <button className="btn ghost" onClick={exitMissedAttempt}>Back to results</button>
            </div>
          )}

        </div>
      </div>

      {/* Guarded outside Modal, not just via its `open` prop -- rushResult
         is null except right when this is meant to show, and JSX children
         are evaluated eagerly by the caller (React.createElement) before
         Modal's own early-return ever runs, so rushResult.reason below
         would throw on every other render without this. rushSummaryOpen
         is the new bit: closing this (X/backdrop/Escape) calls
         hideRushSummary, not exitRush -- rushMode/rushResult live on so
         the final position stays on the board and puzzleCtrls' Results
         button can bring this back up. */}
      {rushMode && rushResult && rushSummaryOpen && (
        <Modal open onClose={hideRushSummary} closeLabel="Close results" className="rushThemeBox rushEndBox" minWidth={300} maxWidth={440} style={{ padding: 0 }}>
          <div className="rushThemeInner">
            <Suspense fallback={null}><RushThemeArt /></Suspense>
            <div className="rushEndHead">
              <p className="rushEndEyebrow">
                Puzzle Rush &middot; {RUSH_DURATIONS.find(d => d.seconds === rushDuration)?.label}
              </p>
              <p className="rushEndSub">{rushResult.reason === "time" ? "Time's up." : "Three misses."} Your heart, and your streak, in pieces.</p>
            </div>
            <div className="rushEndStat">
              <span className="rushEndStatNum">{rushResult.solved}</span>
              <span className="rushEndStatLbl">puzzle{rushResult.solved === 1 ? "" : "s"} solved<br />best: {rushBestMap[rushDuration == null ? "none" : String(rushDuration)] || 0}</span>
            </div>
            {rushMissed.length > 0 && (
              <div className="rushEndMissed" onPointerDown={onMissedSwipeStart} onPointerUp={onMissedSwipeEnd}>
                <p className="rushEndMissedHead">
                  Missed puzzles
                  <span className="rushEndMissedXs" aria-label={`Missed puzzle ${missedStepIdx + 1} of ${rushMissed.length}`}>
                    {rushMissed.map((_, i) => (
                      <span key={i} className={"rushEndMissedX" + (i === missedStepIdx ? " current" : "")}>&#10005;</span>
                    ))}
                  </span>
                </p>
                <div className="rushEndStepperRow">
                  <button className="rushEndStepperBtn" disabled={missedStepIdx === 0}
                    onClick={() => setMissedStepIdx(i => Math.max(0, i - 1))} aria-label="Previous missed puzzle">&#8249;</button>
                  <button className="rushEndRatingBtn" onClick={() => reviewMissedPuzzle(rushMissed[missedStepIdx])}>
                    <span className="rushEndRatingNum">Rated {rushMissed[missedStepIdx].rating}</span>
                    <span className="rushEndRatingLbl">Tap to retry this one</span>
                  </button>
                  <button className="rushEndStepperBtn" disabled={missedStepIdx === rushMissed.length - 1}
                    onClick={() => setMissedStepIdx(i => Math.min(rushMissed.length - 1, i + 1))} aria-label="Next missed puzzle">&#8250;</button>
                </div>
              </div>
            )}
            <div className="rushEndActions">
              <button className="rushEndRestart" onClick={beginRestartCountdown} disabled={restartCountdown != null}
                aria-label={restartCountdown != null ? `Starting in ${restartCountdown}` : "Try again"} title="Try again">
                {restartCountdown != null ? (
                  <span className="rushEndRestartCount">{restartCountdown}</span>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                )}
              </button>
              <button className="rushEndTrophy" onClick={() => openLeaderboard(rushDuration ?? 60)} aria-label="View leaderboard" title="View leaderboard">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3h-2V1H8v2H6C4.9 3 4 3.9 4 5v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.95V17H9v2h6v-2h-3v-3.11c1.63-.32 2.98-1.45 3.61-2.95C18.08 10.63 20 8.55 20 6V5c0-1.1-.9-2-2-2zM6 6V5h2v3.82C6.84 8.4 6 7.3 6 6zm12 0c0 1.3-.84 2.4-2 2.82V5h2v1z" /></svg>
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={nameEditOpen} onClose={() => setNameEditOpen(false)} closeLabel="Close" zIndex={51}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Your Name
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Shown on your "You" card and on the Puzzle Rush leaderboard.
            </div>
            <input
              type="text" value={nameDraft} maxLength={24} placeholder="Challenger"
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveDisplayName(); }}
              className="modalInput"
            />
            <button className="btn gold" onClick={saveDisplayName}>Save</button>
      </Modal>

      <Modal open={!!shareLinkFallback} onClose={() => setShareLinkFallback(null)} closeLabel="Close" zIndex={51} maxWidth={400}>
            <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Share This Game
            </div>
            <div className="pv" style={{ fontSize: 12, opacity: 0.85 }}>
              Couldn't copy automatically — tap the link below to select it, or hit Copy.
            </div>
            <input
              type="text" readOnly value={shareLinkFallback || ""}
              onFocus={e => e.target.select()}
              className="modalInput sm"
            />
            <button className="btn gold" onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareLinkFallback);
                setShareLinkFallback(null);
                setShareToast("Link copied — send it to a viewer!");
                setTimeout(() => setShareToast(null), 2500);
              } catch { /* still selectable in the input above */ }
            }}>Copy</button>
      </Modal>

    </div>
  );
}
