# Blind Chess Trainer: plan

Written 2026-11-24 from the owner's concept, after reviewing the current
Blind Chess code.

**Status (2026-11-24): phases 1, 2 and 4 built.** Owner's decisions: keep
the voice game as a choice; no AI (engine and templates); no widget for
now; it lives in Learn (/blind); progress on the device, synced to the
account (supabase/013_blind_training.sql, OWNER MUST RUN IT). Built: five
drills (square colours, piece reach, piece tracking, what's on the
square, name the opening) at levels 1-10 that adapt (4 right in a row
up, 2 wrong down), answered by tapping, typing or voice, read aloud if
chosen, Show the board after each answer, a days-in-a-row streak, and
"Play a full game by voice". The voice game was fixed (listening now
starts straight from the tap, speech is unlocked on the first tap, a
clear message where voice input isn't available, such as the installed
iPhone app) and moved from a cramped popup to the page. Not yet: phase
3's drills (threats, hanging pieces, calculation, boardless mate in 1).
Not tested on a real phone.

## 1. What exists today (reviewed)

Blind Chess is a full game against Stockfish played by voice, with no
board:

- `src/utils/speech.js`: the browser's own speech (Web Speech API).
  Voice out picks the most natural voice installed; voice in uses the
  browser's recogniser (Chrome, Edge, Safari; not Firefox, which falls
  back to typing). Free, nothing sent to us.
- `src/utils/blindChess.js` (tested, 378 lines of tests): turns spoken or
  typed words into moves ("knight to f3", "castle", "e4"), asks "which
  knight?" when two could go, confirms when the recogniser isn't sure,
  and reads moves back in words.
- `src/utils/blindDescriber.js`: describes the board, captured pieces,
  the material standing and threats, and answers questions like "where
  is my queen?".
- `src/components/BlindMode.jsx`: the game screen (levels, coach voice,
  text box always available).
- Engines: Stockfish (in the browser) and our own engine, both can check
  any position.
- Data to draw questions from: 1,000 rated Lichess puzzles, 15 openings
  with move-by-move notes, the Opening Trainer's move trees.

Important for the plan:

- **There's no AI in it today.** The "AI voice" is the browser reading
  text aloud; understanding is rule-based. That's a strength (free,
  instant, private, works offline) but it means "AI handles conversation
  and explanations" would be new: a language model behind a server
  function (see decision 2).
- **Blind Chess is also the site's accessibility answer** for blind
  players (the Accessibility page says "a full game played by voice").
  Replacing it outright would take that away.

## 2. Decisions for the owner

1. **Keep the voice game?** Recommended: keep it, as one choice inside the
   new Blind Chess Trainer ("Play a full game"), next to the drills.
   Alternative: drills only.
2. **AI explanations?**
   - (a) Recommended for the first version: no language model. Answers
     and explanations come from the engine and written templates ("The
     knight on f3 attacks e5 and d4: that's why …"). Free, instant,
     private, offline, can't say something wrong about the position.
   - (b) Later, optional: a language model (Claude) for follow-up
     questions in your own words. Needs a server function on Vercel
     (the key can't be in the site), a usage cost per question, a daily
     limit per player, a Privacy Policy line, and Vercel Pro if it's ever
     paid. The engine still decides what's correct; the model only
     words it.
3. **The widget.** A real iPhone home-screen widget needs a native iPhone
   app (Swift, the App Store, a developer account at $99/year); a website
   can't make one, and iPhone doesn't support web-app widgets. Options:
   - (a) Recommended: "Quick drill" mode in the site, designed for 30
     seconds, plus a home-screen shortcut that opens straight into it
     (works on Android; on iPhone it's the installed app's icon opening
     there). 
   - (b) Later: a small native iPhone app with a widget that shows one
     question a day and opens the site. Big step; only if the drills
     prove popular.
4. **Where it lives.** Recommended: Learn (it's training), with the
   Play page's Blind Chess card pointing to it.
5. **Saving progress.** Recommended: on the device first (like puzzles),
   then synced to accounts with a new table (one SQL file for you to run).

## 3. How it would work

### One question engine, three ways to answer

Every drill is a question object made from real positions and checked
by the engine, never by guesswork:

    { prompt, spoken, kind: "square" | "move" | "choice" | "yesno" | "name",
      choices?, check(answer) -> { correct, explanation }, fen, level }

- **Audio:** the question is spoken; the answer is spoken back; the
  existing parser understands squares, moves, yes/no and names; feedback
  is spoken. Hands-free.
- **Text:** the same question as text, a box to type the answer
  ("Nf3", "knight f3", "f3", "yes"), feedback and a short explanation,
  then a follow-up question.
- **Quick (the "widget" mode):** the same question as 2 to 4 buttons to
  tap. Made for 30 seconds.

**Show the board** after any answer, to see what you missed (optional,
off during the question).

### Drill types (first version in bold)

| Type | Example | Checked by |
|---|---|---|
| **Square colours** | "Is f6 light or dark?" | maths |
| **Knight and bishop reach** | "Name a square a knight on g1 can go to." | the engine's moves |
| **Piece tracking** | "1.e4 e5 2.Nf3 Nc6 3.Bb5: where is White's light bishop?" | replaying the moves |
| **What's on a square** | "After 1.d4 d5 2.c4: what's on c4?" | replaying |
| **Opening recognition** | "1.e4 c5: which opening?" / "Best reply here?" | openings data, trainer trees |
| Threats | "After these moves, what does Black threaten?" | the describer + engine |
| Hanging pieces | "Can White win a piece? Which move?" | engine capture check |
| Calculation | "White plays Nxe5. Black takes. What's on e5 now?" | replaying |
| Boardless puzzles | small positions read as a piece list, mate in 1 | puzzle data + engine |

### Getting harder

- Levels 1 to 10: level 1 is single squares and one-move sequences;
  higher levels use longer sequences (up to about 12 moves), more pieces,
  and ask about less obvious things.
- It adapts: 4 right in a row moves you up a level, 2 wrong moves you
  down, per drill type. Aimed at players up to about 1000.
- Sessions: 5 questions (about a minute) or 30 seconds in Quick; a daily
  streak like the daily puzzle.

### Shared progress

Per drill type: level, accuracy, best streak, days practised. On the
device first; then a `blind_training` table (one row per player and drill
type, the same private-by-browser-or-account rules as games, 012-style
size limits) so it follows your account.

## 4. Build phases

Each phase leaves something usable; I'd show each before it goes live.

1. **Question engine and Text + Quick modes** with the five bold drill
   types, levels, local progress, Show the board. Tests that every
   generated question's answer is right (engine-checked). (L)
2. **Audio mode** using the existing speech and parser; spoken
   explanations; the voice game kept as "Play a full game". (M)
3. **More drill types** (threats, hanging pieces, calculation, boardless
   mate in 1) and the daily 30-second drill with a streak. (M-L)
4. **Accounts:** the `blind_training` table and sync (SQL for you to
   run). (M)
5. **Only if decided:** AI follow-up questions (2b), native widget (3b).

## 5. Open questions to settle while building

- Names: "Blind Chess Trainer", "Boardless", "Mind's Eye"?
- Spoken notation: say "knight f3" or "N f3"? (Recommended: words.)
- Should drills use your own games (positions from Game Review) later?
