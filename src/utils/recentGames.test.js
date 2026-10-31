import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { buildPgn, parsePgnMoves, replayForeignPgn } from "./pgn";
import { summarizeGame } from "./gameHistory";

/* The recent-games list is only useful if a saved game can be loaded back
   in full. Saving writes buildPgn(); reopening runs parsePgnMoves() and
   replayForeignPgn(). These tests guard that round trip, since a break
   there would show up as a silently shortened game, not an error. */
describe("a saved game reloads in full", () => {
  test("a finished game survives the save-and-reopen round trip", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6"];
    const pgn = buildPgn(moves, "*");
    const tokens = parsePgnMoves(pgn);
    const { applied, sans } = replayForeignPgn(createEngine(), tokens);
    expect(applied.length).toBe(moves.length);
    expect(sans).toEqual(moves);
  });

  test("a game with castling on both sides still loads", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O", "Be7", "d3", "O-O"];
    const { applied } = replayForeignPgn(createEngine(), parsePgnMoves(buildPgn(moves, "*")));
    expect(applied.length).toBe(moves.length);
  });
});

describe("summarizeGame reports the outcome from the player's side", () => {
  const base = { difficulty_label: "Dog", created_at: "2026-10-01T12:00:00Z", pgn: "1. e4 *", result_reason: "Checkmate" };

  test("a win as White", () => {
    expect(summarizeGame({ ...base, player_color: 1, winner: 1 }).outcome).toBe("win");
  });

  test("a loss as White", () => {
    expect(summarizeGame({ ...base, player_color: 1, winner: -1 }).outcome).toBe("loss");
  });

  test("a win as Black is a win, not a loss", () => {
    expect(summarizeGame({ ...base, player_color: -1, winner: -1 }).outcome).toBe("win");
  });

  test("a draw", () => {
    expect(summarizeGame({ ...base, player_color: 1, winner: 0, result_reason: "Stalemate" }).outcome).toBe("draw");
  });

  test("walking away is reported as unfinished, not as a loss", () => {
    const s = summarizeGame({ ...base, player_color: 1, winner: null, result_reason: "Abandoned" });
    expect(s.outcome).toBe("abandoned");
  });

  test("a missing opponent label falls back rather than printing undefined", () => {
    expect(summarizeGame({ ...base, difficulty_label: null, player_color: 1, winner: 1 }).opponent).toBe("Unknown");
  });
});
