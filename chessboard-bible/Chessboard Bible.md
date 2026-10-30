---
tags: [chessboard, index]
---

# Chessboard Bible

Home note for the physical sensor chessboard build. Open this folder as an
Obsidian vault (or open the whole repo — links resolve either way).

Two people work in here: **Zlegend** does the physical build, **Claude** does
the software. See [[Division of Labour]] for the split.

## Start here

- [[Roadmap]] — the arcs, in order, across both tracks
- [[Division of Labour]] — who builds what
- [[Parts Inventory]] — what to buy, when, and what's arrived
- [[Tools]] — what you need, and what you can skip
- [[Build Log]] — session-by-session record
- [[Lessons Learned]] — mistakes and discoveries
- [[Learn/Learn Index|Learn]] — one note per concept, in learning order

## The technical spec

Full engineering detail — BOM, electrical gotchas, physical build, tools,
software edge cases — lives in [BOARD_BUILD.md](../BOARD_BUILD.md).

This vault is the *working* record. That file is the *reference*. When they
disagree, the build log wins — reality beats the plan.

## The one-line version

An ESP32 reads 64 Hall sensors under a frosted glass board, sends piece
positions to the chess app over WiFi, and lights WS2812B LEDs under each
square for hints and legal moves. The app holds all the chess logic; the
board is a sensor and a display, nothing more.

## Guiding principle

> It isn't one chessboard. It's 64 copies of one square that already works.

Nothing scales until the thing being scaled is boring and reliable. Every
arc in the [[Roadmap]] exists to make the next one boring.
