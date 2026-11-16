import { describe, test, expect } from "vitest";
import { cleanUsername, parseGameLink, chessComRow, lichessRow } from "./gameImport";

describe("usernames", () => {
  test.each([
    ["  SomePlayer ", "SomePlayer"], ["@some_player", "some_player"],
    ["https://www.chess.com/member/Some-Player", "Some-Player"], ["https://lichess.org/@/someone/", "someone"],
  ])("%s is read as %s", (typed, name) => expect(cleanUsername(typed)).toBe(name));

  test.each(["", "a", "two words", "1. e4 e5", "name!"])("%s isn't a username", (typed) => expect(cleanUsername(typed)).toBeNull());
});

describe("game links", () => {
  test.each([
    ["https://lichess.org/AbCd1234", "AbCd1234"], ["lichess.org/AbCd1234/black", "AbCd1234"],
    ["https://lichess.org/AbCd1234wxyz", "AbCd1234"], ["https://lichess.org/AbCd1234#23", "AbCd1234"],
  ])("%s is a Lichess game", (link, id) => expect(parseGameLink(link)).toEqual({ site: "lichess", id }));

  test.each([
    ["https://www.chess.com/game/live/123456789", "live"], ["chess.com/game/daily/42?tab=review", "daily"],
    ["https://www.chess.com/analysis/game/live/123456789", "live"], ["https://www.chess.com/es/game/live/123456789", "live"],
  ])("%s is a Chess.com game", (link, kind) => expect(parseGameLink(link)).toMatchObject({ site: "chesscom", kind }));

  test.each(["1. e4 e5 2. Nf3", "https://lichess.org/@/someone", "https://www.chess.com/member/someone", "https://example.com/game/live/1"])(
    "%s isn't a game link", (text) => expect(parseGameLink(text)).toBeNull());
});

describe("a Chess.com game in the list", () => {
  const game = {
    uuid: "u1", url: "https://www.chess.com/game/live/99", rules: "chess", time_class: "blitz", end_time: 1700000000,
    pgn: '[White "Ann"]\n[Black "Bo"]\n\n1. e4 {[%clk 0:03:00]} e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',
    white: { username: "Ann", rating: 900, result: "win" }, black: { username: "Bo", rating: 880, result: "checkmated" },
    accuracies: { white: 91.2, black: 40.5 },
  };

  test("is told from the searched player's side", () => {
    expect(chessComRow(game, "bo")).toMatchObject({ color: -1, outcome: "loss", how: "checkmate", opponent: "Ann", opponentElo: 900, plies: 7, speed: "blitz", endedAt: 1700000000000 });
    expect(chessComRow(game, "ANN")).toMatchObject({ color: 1, outcome: "win", opponent: "Bo" });
  });

  test("keeps Chess.com's own accuracy when the game has one", () => {
    expect(chessComRow(game, "ann").siteAccuracy).toEqual({ white: 91.2, black: 40.5 });
    expect(chessComRow({ ...game, accuracies: undefined }, "ann").siteAccuracy).toBeNull();
  });

  test("a draw is a draw for both, and variants are left out", () => {
    const drawn = { ...game, white: { ...game.white, result: "repetition" }, black: { ...game.black, result: "repetition" } };
    expect(chessComRow(drawn, "ann")).toMatchObject({ outcome: "draw", how: "repetition" });
    expect(chessComRow({ ...game, rules: "chess960" }, "ann")).toBeNull();
  });
});

describe("a Lichess game in the list", () => {
  const game = {
    id: "AbCd1234", variant: "standard", speed: "rapid", status: "resign", winner: "black", createdAt: 1, lastMoveAt: 5,
    players: { white: { user: { name: "Ann" }, rating: 1500 }, black: { user: { name: "Bo" }, rating: 1520 } },
    moves: "e4 e5 Nf3", pgn: "1. e4 e5 2. Nf3 0-1",
  };

  test("is told from the searched player's side", () => {
    expect(lichessRow(game, "ann")).toMatchObject({ color: 1, outcome: "loss", how: "resignation", opponent: "Bo", opponentElo: 1520, plies: 3, url: "https://lichess.org/AbCd1234" });
  });

  test("names a computer opponent, and leaves variants out", () => {
    const vsAi = { ...game, players: { ...game.players, black: { aiLevel: 3 } } };
    expect(lichessRow(vsAi, "ann").opponent).toBe("Stockfish level 3");
    expect(lichessRow({ ...game, variant: "atomic" }, "ann")).toBeNull();
  });
});
