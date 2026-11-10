import { describe, test, expect } from "vitest";
import { boardFrom, movesFor, apply, starPar, starRating, winner, aiMove, sq, pieceNum } from "./kidMini";

describe("Kinnda mini-games", () => {
  test("pieces move the chess way, without kings or check", () => {
    const rook = movesFor(boardFrom("Ra1 pa4"), true).map((m) => m.to);
    expect(rook).toContain(sq("a4"));
    expect(rook).not.toContain(sq("a5"));
    expect(rook).toContain(sq("h1"));
    const knight = movesFor(boardFrom("Nb1"), true).map((m) => m.to).sort((a, b) => a - b);
    expect(knight).toEqual([sq("d2"), sq("a3"), sq("c3")].sort((a, b) => a - b));
    const pawn = movesFor(boardFrom("Pe2 pd3 pe3"), true).map((m) => m.to);
    expect(pawn).toEqual([sq("d3")]);
    const black = movesFor(boardFrom("pe7"), false).map((m) => m.to).sort((a, b) => a - b);
    expect(black).toEqual([sq("e5"), sq("e6")]);
    expect(movesFor(boardFrom("Ra1"), true, [sq("a3")]).map((m) => m.to)).not.toContain(sq("a4"));
    expect(pieceNum({ t: "Q", w: false })).toBe(-5);
  });

  test("the star hunt knows the fewest moves", () => {
    expect(starPar("R", sq("a1"), [sq("a8"), sq("h8")])).toBe(2);
    expect(starPar("N", sq("b1"), [sq("c3")])).toBe(1);
    expect(starPar("B", sq("c1"), [sq("d2"), sq("h6")])).toBe(2);
    expect(starPar("B", sq("c1"), [sq("h6"), sq("a3")])).toBe(3);
    expect(starPar("R", sq("a1"), [sq("a8")], [sq("a4")])).toBe(3);
    expect(starRating(5, 5)).toBe(3);
    expect(starRating(7, 5)).toBe(2);
    expect(starRating(9, 5)).toBe(1);
  });

  test("Pawn Wars: reaching the far side wins, being stuck loses", () => {
    expect(winner(boardFrom("Pe8 pa7"), "pawnwars", "black")).toBe("white");
    expect(winner(boardFrom("Pa2 pa1"), "pawnwars", "white")).toBe("black");
    expect(winner(boardFrom("Pa2 pa3"), "pawnwars", "white")).toBe("black");
    expect(winner(boardFrom("Pa2 ph7"), "pawnwars", "white")).toBe(null);
  });

  test("Queen vs. pawns: catch them all, or lose when one gets through", () => {
    expect(winner(boardFrom("Qd1"), "queenhunt", "black")).toBe("white");
    expect(winner(boardFrom("Qd4 pa1"), "queenhunt", "white")).toBe("black");
  });

  test("the computer takes a win when it sees one and stops a runner", () => {
    const win = aiMove(boardFrom("Pa2 pb2 ph7"), "pawnwars", false, 2, () => 0.5);
    expect(win.to).toBe(sq("b1"));
    /* The last pawn is one step from promoting: the queen must stop it
       (block a1, which leaves Black no move, or take it). */
    const queen = aiMove(boardFrom("Qd1 pa2"), "queenhunt", true, 2, () => 0.5);
    expect(winner(apply(boardFrom("Qd1 pa2"), queen), "queenhunt", "black")).toBe("white");
  });
});
