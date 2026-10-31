import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import {
  parsePgnMoves, replayForeignPgn, parsePgnHeaders, countPgnGames,
  describePasteProblem, reviewInfoFromHeaders, exporterSide,
} from "./pgn";

const applied = (text) => replayForeignPgn(createEngine(), parsePgnMoves(text)).applied.length;

/* Shaped like a Chess.com export: the seven-tag roster plus its own tags,
   per-move clock comments, and explicit Black move numbers. */
const CHESS_COM = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.30"]
[Round "?"]
[White "Zlegend27"]
[Black "SomeOpponent"]
[Result "1-0"]
[WhiteElo "1520"]
[BlackElo "1498"]
[TimeControl "600"]
[Termination "Zlegend27 won by resignation"]
[Link "https://www.chess.com/game/live/123456789"]

1. e4 {[%clk 0:09:58.9]} 1... e5 {[%clk 0:09:57.1]} 2. Nf3 {[%clk 0:09:55.2]} 2... Nc6 {[%clk 0:09:52.8]} 3. Bc4 {[%clk 0:09:50.0]} 1-0
`;

/* A real export, with the opponent anonymised: unlike the sample above it has no clock
   comments, wraps mid-move-pair across lines, and its Link tag names who
   exported it. */
const REAL_CHESS_COM = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.31"]
[Round "?"]
[White "Opponent"]
[Black "Zlegend27_YT"]
[Result "1-0"]
[TimeControl "600"]
[WhiteElo "847"]
[BlackElo "833"]
[Termination "Opponent won by checkmate"]
[ECO "B20"]
[EndTime "18:02:48 GMT+0000"]
[Link "https://www.chess.com/game/live/1?username=zlegend27_yt"]

1. e4 c5 2. Bc4 g6 3. Nf3 e6 4. d4 cxd4 5. Qxd4 Nf6 6. O-O Nc6 7. Qc3 Bg7 8. Bg5
O-O 9. Bb5 Nxe4 10. Qd3 Nxg5 11. Nfd2 Bxb2 12. h4 Ne5 13. Qe3 f6 14. c3 Bxa1 15.
hxg5 fxg5 16. Qxe5 a6 17. Bd3 Qf6 18. Qh2 Bxc3 19. Ne4 Qg7 20. Nbxc3 d5 21. Nxg5
h6 22. Nxe6 Bxe6 23. Ne2 Rac8 24. f4 b5 25. Rf3 b4 26. Bxg6 Qa1+ 27. Kf2 Bf7 28.
Bd3 Qxa2 29. Rg3+ Kh8 30. Qxh6# 1-0
`;

describe("a real Chess.com export", () => {
  test("every move loads, ending in the mate", () => {
    const { applied, sans } = replayForeignPgn(createEngine(), parsePgnMoves(REAL_CHESS_COM));
    expect(applied.length).toBe(59);
    expect(sans.at(-1)).toBe("Qxh6#");
  });

  test("it isn't flagged as a problem", () => {
    expect(describePasteProblem(REAL_CHESS_COM)).toBeNull();
  });

  test("the exporter's side is read from the Link tag, ignoring case", () => {
    expect(exporterSide(parsePgnHeaders(REAL_CHESS_COM))).toBe(-1);
    expect(exporterSide({ White: "Pat", Link: "https://x.test/1?username=PAT" })).toBe(1);
  });

  test("an unknown exporter returns null", () => {
    expect(exporterSide({ White: "A", Black: "B", Link: "https://x.test/1?username=c" })).toBeNull();
    expect(exporterSide({ White: "A", Black: "B" })).toBeNull();
  });
});

describe("games exported from other sites load in full", () => {
  test("a Chess.com export with clocks and headers", () => {
    expect(parsePgnMoves(CHESS_COM)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4"]);
  });

  test("nested variations don't leak moves into the main line", () => {
    expect(applied("1. e4 e5 $1 (1... c5 2. Nf3 (2. c3 d5) 2... d6) 2. Nf3 {good} Nc6 *")).toBe(4);
  });

  test("evaluation comments and NAGs from an annotated export", () => {
    expect(applied("1. e4 $1 {[%eval 0.3]} e5 $2 {[%eval 0.2]} 2. Nf3! Nc6?! *")).toBe(4);
  });

  test("digit-zero castling, with or without a check mark", () => {
    expect(applied("1. e4 e5 2. Nf3 Nf6 3. Bc4 Nxe4 4. 0-0 Nc5 *")).toBe(8);
    expect(parsePgnMoves("1. 0-0+ 0-0-0#")).toEqual(["O-O+", "O-O-O#"]);
  });

  test("an en passant marker is not treated as a move", () => {
    expect(applied("1. e4 a6 2. e5 d5 3. exd6 e.p. Qxd6 *")).toBe(6);
  });

  test("promotion written without an equals sign", () => {
    expect(applied("1. a4 b5 2. axb5 a6 3. bxa6 Bb7 4. axb7 Nc6 5. bxa8Q Qxa8 *")).toBe(10);
  });

  test("move numbers with no dots", () => {
    expect(applied("1 e4 e5 2 Nf3 Nc6 *")).toBe(4);
  });
});

describe("a file holding several games", () => {
  const TWO = '[Event "A"]\n\n1. e4 e5 1-0\n\n[Event "B"]\n\n1. d4 d5 0-1\n';

  test("only the first game loads, instead of blending them into one", () => {
    expect(parsePgnMoves(TWO)).toEqual(["e4", "e5"]);
  });

  test("the games are counted so the player can be told", () => {
    expect(countPgnGames(TWO)).toBe(2);
    expect(countPgnGames(CHESS_COM)).toBe(1);
  });
});

describe("headers", () => {
  test("names, ratings and how the game ended", () => {
    expect(reviewInfoFromHeaders(parsePgnHeaders(CHESS_COM))).toEqual({
      white: "Zlegend27 (1520)",
      black: "SomeOpponent (1498)",
      outcome: "Zlegend27 won by resignation",
    });
  });

  test("a game with no headers still reads sensibly", () => {
    expect(reviewInfoFromHeaders(parsePgnHeaders("1. e4 e5 *"))).toEqual({ white: "White", black: "Black", outcome: "" });
  });

  test("placeholder names and ratings are dropped", () => {
    const h = parsePgnHeaders('[White "?"]\n[Black "Pat"]\n[WhiteElo "?"]\n[BlackElo "0"]\n[Result "*"]');
    expect(reviewInfoFromHeaders(h)).toEqual({ white: "White", black: "Pat", outcome: "" });
  });

  test("the first game's headers win in a multi-game file", () => {
    expect(parsePgnHeaders('[White "First"]\n\n1. e4 *\n\n[White "Second"]\n\n1. d4 *').White).toBe("First");
  });
});

describe("text that isn't a game gets a useful explanation", () => {
  test("a pasted game link", () => {
    expect(describePasteProblem("https://www.chess.com/game/live/123456789")).toMatch(/link/i);
    expect(describePasteProblem("chess.com/game/live/123456789")).toMatch(/link/i);
    expect(describePasteProblem("https://lichess.org/abcd1234")).toMatch(/link/i);
  });

  test("a single position instead of a game", () => {
    expect(describePasteProblem("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toMatch(/position/i);
  });

  test("a game that doesn't start from the normal position", () => {
    const fen = '[FEN "nrbkqbrn/pppppppp/8/8/8/8/PPPPPPPP/NRBKQBRN w KQkq - 0 1"]\n\n1. e4 e5 *';
    expect(describePasteProblem(fen)).toMatch(/starting position/i);
    expect(describePasteProblem('[Variant "Chess960"]\n\n1. e4 e5 *')).toMatch(/starting position/i);
  });

  test("real games are not flagged", () => {
    expect(describePasteProblem(CHESS_COM)).toBeNull();
    expect(describePasteProblem("1. e4 e5 2. Nf3 *")).toBeNull();
    expect(describePasteProblem('[Variant "Standard"]\n\n1. e4 e5 *')).toBeNull();
    expect(describePasteProblem('[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]\n\n1. e4 *')).toBeNull();
  });
});
