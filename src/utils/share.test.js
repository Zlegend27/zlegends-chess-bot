import { describe, it, expect } from "vitest";
import { encodeGame, decodeGame } from "./share.js";
import { readGame } from "../../api/_game.js";

describe("shared game codes", () => {
  const moves = ["f3", "e5", "g4", "Qh4#"];
  it("are URL-safe and round-trip", () => {
    const code = encodeGame(-1, moves);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeGame(code)).toEqual({ playerColor: -1, moveList: moves });
  });
  it("still read old #g= links (plain base64)", () => {
    const old = btoa(JSON.stringify({ c: 1, m: ["e4", "e5"] }));
    expect(decodeGame(old)).toEqual({ playerColor: 1, moveList: ["e4", "e5"] });
  });
  it("give the link preview a result and the final position", () => {
    const g = readGame(encodeGame(1, moves));
    expect(g.title).toBe("Black wins by checkmate");
    expect(g.summary).toBe("2 moves");
    expect(g.board[31]).toBe(-5); // the queen on h4
  });
  it("shrug off junk", () => {
    expect(readGame("not-a-game")).toBeNull();
    expect(readGame("")).toBeNull();
  });
});
