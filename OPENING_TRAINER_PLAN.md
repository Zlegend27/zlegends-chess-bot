# Opening Trainer plan

Agreed with the site owner on 2026-11-09. One **Opening Trainer** under the Learn tab replaces both the Vienna Trainer and the Theory Trainer.

## Goal

Teach openings so players understand them, not memorize them. The owner's concern: the current trainers confuse and build bad habits. The trainer stops at the end of the opening; it never strings players into memorizing middlegames. It teaches what the opening is trying to achieve and how to play on from there.

## Openings (first version)

| Side | Opening | Lines underneath |
|---|---|---|
| White | Vienna Game | Vienna Gambit |
| White | Italian Game | |
| White | Ruy Lopez | |
| White | Scotch Game | |
| White | London System | |
| White | Queen's Gambit | |
| Black | Sicilian Defence | Accelerated Dragon |
| Black | French Defence | |
| Black | Caro-Kann Defence | |
| Black | Scandinavian Defence | |
| Black | Queen's Gambit Declined | |
| Black | King's Indian Defence | |

## Levels

Easy, Medium and Hard imitate players around **Chess.com 800, 1300 and 1800**. Lichess ratings run higher, so the data bands are set on Lichess numbers: roughly 1100-1400, 1500-1800 and 1900-2200.

## Each opening is a short course

1. **The idea.** What the opening is trying to achieve: pawn structure, key squares, typical plans. Shown on the board in short animated snippets.
2. **Quiz.** The bot plays the main line and you find your moves. A miss shows the right move and why, and the line comes back later.
3. **Scenarios.** The opponent's most common replies at your level, from real games. For each: what it is, why they play it, the right answer, and the punishment (the bot shows what goes wrong after a bad answer). Traps to spring and traps to avoid.
4. **Practice.** Play the bot at Easy, Medium or Hard. It plays what real players at that level play, until the opening ends (about move 10-12). Each of your moves gets feedback, and the end shows "your plan from here", not more moves to learn.

Plus a light spaced-repetition review of the moves you keep missing, and a progress ring per opening.

## Data

The Vienna pipeline (scripts/vienna), generalised. It counts which move real Lichess players (CC0 database) chose in every position of each opening, per rating band. Stockfish picks sound repertoire moves and finds the punishments. The "why" text is written per opening and tested against the real move data, as the Vienna notes are.

## Look

The app-shell (Tailwind) card language of Home and Leaderboard, polished: board thumbnails, progress rings, the Zlegend coach. No plain lists and buttons. Mockups go to the owner for approval before anything is built.

## Status

- [x] Mockups approved
- [x] Data pipeline for all openings
- [x] Course content (ideas, scenarios, traps) per opening
- [x] Trainer screens
- [x] Old trainers removed
