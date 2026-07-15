/* ZLEGEND2700's voice -- line banks for the "bot talks" welcome beat
   (HomePage) and post-game one-liners (Play), both rendered through
   BotBubble.jsx. Kept as plain data + two picker functions so the
   personality lives in one place and both call sites stay simple.

   Voice: cocky arcade rival, not mean-spirited -- "can you beat it??"
   energy, not trash talk that'd make a first-time visitor bounce. */

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const WELCOME_FIRST_TIME = [
  "New challenger. I'm ZLEGEND2700 — pick a mode, I'll be ready whenever you are.",
  "Never seen you before. Bot, puzzle, whatever you want first — I'm not picky about how I win.",
  "Fresh face! Fair warning: I don't go easy just because it's your first time.",
];

/** `rankElo` is the returning player's Rank Bot rating (or null if they've
 *  never played it), `games` their Rank Bot game count. */
const welcomeBack = (rankElo, games) => {
  if (rankElo == null || games < 1) {
    return pick([
      "Back again? Good — the board missed you. Well, I didn't, but the board did.",
      "You're back. Let's find something to lose at today.",
    ]);
  }
  if (rankElo >= 1800) {
    return pick([
      `You again. ${rankElo} rated and still coming back for more — respect. Let's go.`,
      `Rank Bot has you at ${rankElo} now. That's actually a little annoying. Rematch.`,
    ]);
  }
  if (rankElo <= 800) {
    return pick([
      `Last I checked you were sitting around ${rankElo}. Should I set up the board or the training wheels?`,
      `${rankElo}, huh. We've got some work to do.`,
    ]);
  }
  return pick([
    `Welcome back. ${rankElo} and climbing — let's see if that holds up today.`,
    `${games} games in and you're still showing up. I like that. Let's make it ${games + 1}.`,
  ]);
};

export function pickWelcomeLine({ firstVisit, rankElo, games }) {
  return firstVisit ? pick(WELCOME_FIRST_TIME) : welcomeBack(rankElo, games);
}

/* Post-game reaction -- deliberately cheap to compute (no move grading
   involved, that's a whole Stockfish pass now) -- just the final result,
   who won, the material count, and which "personality of the day" the
   bot was playing as (see gameStyle in App.jsx), all already sitting in
   state by the time the game ends. */
export function pickPostGameLine({ result, playerWon, isDraw, youDiff, styleLabel, difficultyLabel }) {
  if (!result) return null;
  if (isDraw) {
    return pick([
      "A draw. Fine. I'll allow it — this time.",
      `Split the point. Not the ending I wanted, but ${difficultyLabel ? "against " + difficultyLabel + " you'll" : "you"} take it.`,
    ]);
  }
  if (playerWon) {
    if (youDiff < 0) {
      return pick([
        "You won that DOWN material? Okay, that one actually stung a little.",
        "Beat me a piece down. I need a minute.",
      ]);
    }
    return pick([
      `Alright, that one's yours. ${styleLabel ? "I was playing " + styleLabel + " today, for what it's worth." : "Rematch?"}`,
      "Not bad. Don't get used to it.",
      "You got me. I'll be recalibrating before the next one.",
    ]);
  }
  if (youDiff > 2) {
    return pick([
      "You were UP material and still lost that. We need to talk.",
      "Material lead, lost anyway. That's a you problem.",
    ]);
  }
  return pick([
    `${styleLabel ? styleLabel + " mode paid off there." : "That one's mine."} Run it back?`,
    "GG. That's how it's done.",
    "Another one for the pile. Go again?",
  ]);
}
