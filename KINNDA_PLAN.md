# Kinnda Chess: the learning upgrade

Approved by the owner on 2026-11-10, with the changes in "Owner's decisions" below. Mockups: `kinnda-design/mockup.html` (kept out of git).

## Goal

Kinnda is for a 9-year-old learning chess from the ground up. The aim is to take her from "knows how the pieces move" to genuinely strong, and to make it something she wants to open every day. It doesn't have to look like a chess app: it should feel like a game.

The owner's asks:
- **Separate learning from playing.** Today everything lives on one screen, around the game.
- **Bring in the Opening Trainer,** taught in a simpler, child-sized way.
- **Daily goals or tasks.**
- **Research how children learn chess best,** and design around it.

## What the research says

- **Small steps, lots of practice, real games alongside.** The Dutch Steps Method (the official method of the Royal Dutch Chess Federation since 1987) splits chess into six steps of short themed lessons. Each lesson is followed by many exercises, and playing and going over your own games is part of every step. The first step alone is meant to take children about a year. Its warning is the one every coaching guide repeats: don't teach too much too soon.
- **Mini-games before full games.** Coaches teach pieces through small games: pawns only (first to the far side wins), one queen hunting eight pawns, and so on. That way a child practises one idea at a time and wins and loses often, in a few minutes. ChessKid's coaching guide and the Steps workbooks both work this way.
- **Openings as ideas, not lines.** For beginners, memorising lines is boring and wasted effort (Hertan, *Basic Chess Openings for Kids*). Children learn openings through principles (centre, develop, castle) and a few traps. Our Opening Trainer already teaches that way, so it fits; the kid version just needs fewer words, fewer branches and more show-don't-tell.
- **Daily habits: keep the bar low.** Duolingo found that tying the streak to a big daily goal made streaks worse. Splitting them, so any one small thing keeps the streak alive, raised 7-day streaks by over 40%. Rewards for every action can also crowd out a child's own interest (the classic drawing-reward study). Kinnda should reward mastery and progress (stars, badges, pieces that grow) more than it pays coins for everything.

Sources: [Steps Method overview](https://lichess.org/@/HanSchut/blog/the-steps-method-for-learning-and-teaching-chess/L74I4Ihq), [ChessKid: Walk Before You Run](https://www.chesskid.com/learn/articles/walk-before-you-run), [ChessKid parents' guide to Stars and Gems](https://www.chesskid.com/learn/articles/parents-guide-chesskid-stars-and-gems), [Duolingo: improving the streak](https://blog.duolingo.com/improving-the-streak), [Chess openings for children](https://learnopoly.com/chess-opening-strategies-for-children/), [UX Mag on streak psychology](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design).

## The new shape

A home screen with two big doors and today's quests:

- **Learn: Owl's Adventure.** A map of islands, each one a step of the Steps-style path. Each island holds short levels (a lesson, then exercises, then a mini-game or a boss). Levels earn up to 3 stars and unlock the next. The islands:
  1. **Piece Park:** how each piece moves, through mini-games: Pawn Wars, Queen vs. 8 Pawns, Knight's Star Hunt, Rook Maze.
  2. **Capture Cove:** capturing, protecting, "is it safe?", trading fairly (piece values).
  3. **Check Castle:** check, escaping check, mate in 1, the first mating patterns.
  4. **Opening Camp:** the golden rules, then the kid Opening Trainer (below).
  5. **Trick Forest:** forks, pins, skewers, discovered attacks.
  6. **Endgame Mountain:** queen mate, rook mate, pawn races, king and pawn.

  Today's seven lesson chapters are not lost: their beats become levels on the islands. Later islands climb toward club level (Owl's "Champion Path").

- **Play: the Game Room.** Games against the animal ladder, puzzles, Puzzle Rush, the daily puzzle and trophies, all as they are today but on their own screen. New here: **Owl's Replay** after each game. Owl shows your best move and one "oops" moment from the game, kid-sized (two moments, not a full review).

- **Today's Quests.** Three small tasks a day, picked from what she is learning: for example, one Adventure level, three puzzles, one game against an animal. **Doing any one keeps the streak alive**; doing all three opens a treasure chest.

## Opening Camp (the kid Opening Trainer)

The full trainer, made child-sized:
- **Two openings to start:** the **Vienna** as White (the owner's choice; she has already started it in the Kinnda lessons), and 1...e5 as Black, meeting the Italian with the Two Knights (also already in the lessons). More (1...d5 against d4, others) unlock later.
- **Same four steps, renamed and simplified:**
  1. **Owl's Story:** the idea in 3-4 animated board snippets with one-line captions.
  2. **Copycat:** play the moves with Owl; a wrong move shows a gentle arrow and Owl explains in one sentence.
  3. **What If?:** the replies real kids-level players make. Each is a card with the move, a one-line reason, and "find your answer". For mistakes, "Gotcha!": she finds the punishment and watches it play out.
  4. **Practice Match:** play it out against Bunny, Cat or Dog, which play what real players at about 800, 1100 and 1300 play. It stops when the opening is over, with Owl's "your plan from here" card.
- **Memory Game:** moves she missed come back on later days (the same spaced review as the main trainer), counting toward Today's Quests.
- **Built on the main app's pieces:** the Lichess move trees (`scripts/openings/`), `src/utils/openingTrainer.js` and the coach notes. The kid trees are shallower: the opening ends around move 6-8, only common replies plus traps. Two new trees are needed for Black: `e4 e5` and later `d4 d5`.

## Rewards that build a chess player

- **Stars** for mastery (1 to 3 per level; 3 means done cleanly). Stars open islands.
- **Piece Pals:** borrowed from Tactica's bonds. Each piece kind she uses well levels up and gets a sparkle, a collar and a crown, so getting better shows on the board.
- **Coins** stay for the shop (hats, boards, tunes, animals), but come mainly from quests and chests, not from every single move.
- **Trophy shelf** stays, with island badges added.

## Reports for the owner (instead of a grown-up corner)

No grown-up screen for now. Instead Kinnda keeps a progress log on the tablet (time played, quests, games and results, puzzles solved and missed by theme, lessons and levels, the moves she keeps missing). A hidden "hold Owl for 3 seconds" copies a progress code; the owner pastes it into a Claude Code session and asks for a report, written there.

## Build order (each phase shown before it goes live)

1. **Home and the split:** Home with the Learn and Play doors and Today's Quests with a forgiving streak. Play becomes its own screen; existing saves carry over.
2. **Opening Camp:** the kid Opening Trainer with the Vienna and 1...e5, Memory Game, kid move trees.
3. **Owl's Adventure map:** islands 1-3 with the mini-games, the existing lessons moved onto the map, stars and unlocking.
4. **Owl's Replay** after games, and **Piece Pals.**
5. **Islands 5-6.**

## Constraints

- **Fire tablet first:** Silk browser and the legacy build. No heavy 3D (Tactica stays in the main app); simple CSS animation only.
- **Storage:** everything stays in localStorage like today (no accounts, no Supabase for a child's data).
- **Rated content:** puzzles keep the existing 1600 cap.
- **Engine:** Stockfish for Owl's Replay only if it runs well on the tablet; otherwise the built-in engine.

## Owner's decisions (2026-11-10)

- First openings: the **Vienna** as White (and 1...e5 / Two Knights as Black).
- Today's Quests aim at about **10 minutes** a day.
- **No grown-up corner** for now; reports are written on request from the progress code (see above).

## Status

- [x] Plan and mockups approved
- [x] Phase 1: Home, split, Today's Quests, progress log and code
- [x] Phase 2: Opening Camp (Vienna Gambit and 1...e5 / Two Knights, kid trees from `build.mjs ... kid`)
- [x] Phase 3: Adventure map, islands 1-3 (mini-games, drills from `scripts/kinnda/makeDrills.mjs`, lessons on the map)
- [x] Phase 4: Owl's Replay, Piece Pals
- [x] Phase 5: islands 5-6

All five phases built and pushed together on 2026-11-10 at the owner's request ("lets do all phases then push"). Island thresholds were lowered from the first draft (Capture Cove 4, Check Castle 10, Opening Camp 14, Trick Forest 24, Endgame Mountain 34 stars) so the Vienna she already started isn't locked away for long.
