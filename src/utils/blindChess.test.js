import { describe, it, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import {
  parseUtterance, parseMoveSpec, parseClarification, filterByClarification,
  sanToSpeech, isPromotionChoice, sqName,
} from "./blindChess";
import { answerQuestion, describeStanding } from "./blindDescriber";

const startEngine = () => createEngine();
const engineWithFen = (fen) => { const e = createEngine(); e.loadFen(fen); return e; };
const sans = (r) => r.matches.map(m => m.san).sort();

describe("move parsing from the start position", () => {
  it.each([
    ["pawn d4", "d4"],
    ["pawn to d4", "d4"],
    ["move my pawn to d4", "d4"],
    ["play pawn to d4", "d4"],
    ["knight f3", "Nf3"],
    ["knight to f3", "Nf3"],
    ["Knight f3.", "Nf3"],
    ["e4", "e4"],
  ])("%s → %s", (said, san) => {
    const r = parseUtterance(startEngine(), said);
    expect(r.kind).toBe("move");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].san).toBe(san);
  });

  it("understands spelled-out homophone squares: 'pawn to e for'", () => {
    const r = parseUtterance(startEngine(), "pawn to e for");
    expect(r.matches.map(m => m.san)).toEqual(["e4"]);
  });

  it("understands 'night to f three'", () => {
    const r = parseUtterance(startEngine(), "night to f three");
    expect(r.matches.map(m => m.san)).toEqual(["Nf3"]);
  });

  it("understands from-to form: 'e2 to e4'", () => {
    const r = parseUtterance(startEngine(), "e2 to e4");
    expect(r.matches.map(m => m.san)).toEqual(["e4"]);
  });

  it("understands UCI-ish run-together 'e2e4'", () => {
    const r = parseUtterance(startEngine(), "e2e4");
    expect(r.matches.map(m => m.san)).toEqual(["e4"]);
  });

  it("bare square with two candidates is ambiguous: 'e3'", () => {
    // pawn e3 and ... nothing else can reach e3 at start except the e-pawn
    const r = parseUtterance(startEngine(), "e3");
    expect(r.matches.map(m => m.san)).toEqual(["e3"]);
  });

  it("returns zero matches for an illegal move", () => {
    const r = parseUtterance(startEngine(), "queen to h5");
    expect(r.kind).toBe("move");
    expect(r.matches).toHaveLength(0);
  });
});

describe("disambiguation", () => {
  // Two knights (b1, f3→no; use g1 + d2) can both reach f3.
  const TWO_KNIGHTS_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPNPPPP/R1BQKBNR w KQkq - 0 1";

  it("two knights reaching f3 → two matches", () => {
    const r = parseUtterance(engineWithFen(TWO_KNIGHTS_FEN), "knight f3");
    expect(r.matches).toHaveLength(2);
    expect(r.matches.map(m => sqName(m.from64)).sort()).toEqual(["d2", "g1"]);
  });

  it("clarifying with a square narrows to one", () => {
    const r = parseUtterance(engineWithFen(TWO_KNIGHTS_FEN), "knight f3");
    const clar = parseClarification("the one on g1");
    const left = filterByClarification(r.matches, clar);
    expect(left).toHaveLength(1);
    expect(sqName(left[0].from64)).toBe("g1");
  });

  it("clarifying with a file narrows to one", () => {
    const r = parseUtterance(engineWithFen(TWO_KNIGHTS_FEN), "knight f3");
    const clar = parseClarification("the d file one");
    const left = filterByClarification(r.matches, clar);
    expect(left).toHaveLength(1);
    expect(sqName(left[0].from64)).toBe("d2");
  });

  it("SAN-style spoken disambiguator: 'knight g f3'", () => {
    const r = parseUtterance(engineWithFen(TWO_KNIGHTS_FEN), "knight g f3");
    expect(r.matches).toHaveLength(1);
    expect(sqName(r.matches[0].from64)).toBe("g1");
  });
});

describe("captures", () => {
  // White queen d1→d5 possible? Use a simple position: queen on d4, black pawn e5.
  const CAP_FEN = "rnbqkbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 1";

  it("'queen takes e5' matches the capture", () => {
    const r = parseUtterance(engineWithFen(CAP_FEN), "queen takes e5");
    expect(r.matches.map(m => m.san)).toEqual(["Qxe5+"]);
  });

  it("'takes' filters out non-captures to the same square", () => {
    // queen can also quietly go to d5? point: saying takes must require capture
    const r = parseUtterance(engineWithFen(CAP_FEN), "queen takes d5");
    expect(r.matches).toHaveLength(0);
  });
});

describe("castling", () => {
  const CASTLE_FEN = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";

  it.each([
    ["castle kingside", "O-O"],
    ["castle king side", "O-O"],
    ["castle short", "O-O"],
    ["castle queenside", "O-O-O"],
    ["castle long", "O-O-O"],
    ["long castle", "O-O-O"],
  ])("%s → %s", (said, san) => {
    const r = parseUtterance(engineWithFen(CASTLE_FEN), said);
    expect(r.matches.map(m => m.san)).toEqual([san]);
  });

  it("bare 'castle' with both sides legal → two matches", () => {
    const r = parseUtterance(engineWithFen(CASTLE_FEN), "castle");
    expect(r.matches).toHaveLength(2);
  });
});

describe("promotion", () => {
  const PROMO_FEN = "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1";

  it("'e8' with no promo piece → promotion choice", () => {
    const r = parseUtterance(engineWithFen(PROMO_FEN), "e8");
    expect(r.kind).toBe("promotion");
    expect(isPromotionChoice(r.matches)).toBe(true);
    expect(r.matches).toHaveLength(4);
  });

  it("'pawn e8 promote to queen' resolves fully", () => {
    const r = parseUtterance(engineWithFen(PROMO_FEN), "pawn e8 promote to queen");
    expect(r.matches.map(m => m.san)).toEqual(["e8=Q"]);
  });

  it("a bare piece word answers the promotion question", () => {
    const clar = parseClarification("queen");
    const r = parseUtterance(engineWithFen(PROMO_FEN), "e8");
    const left = filterByClarification(r.matches, clar);
    expect(left.map(m => m.san)).toEqual(["e8=Q"]);
  });
});

describe("commands", () => {
  it.each([
    ["repeat", "repeat"],
    ["say that again", "repeat"],
    ["read the board", "board"],
    ["what is the position", "position"],
    ["whose turn is it", "turn"],
    ["what pieces have been captured", "captured"],
    ["what is threatening my king", "threats"],
    ["am i in check", "threats"],
    ["undo", "undo"],
    ["take back", "undo"],
    ["hint", "hint"],
    ["what should i play", "hint"],
    ["i resign", "resign"],
    ["new game", "new"],
    ["yes", "yes"],
    ["no cancel that", "no"],
  ])("'%s' → %s", (said, cmd) => {
    const r = parseUtterance(startEngine(), said);
    expect(r.kind).toBe("command");
    expect(r.command).toBe(cmd);
  });

  it("commands win over move parsing: 'what was captured' is not a capture move", () => {
    const r = parseUtterance(startEngine(), "what pieces have been captured");
    expect(r.kind).toBe("command");
  });

  it.each([
    ["help", "help"],
    ["what can I say", "help"],
    ["how am i doing", "standing"],
    ["who is winning", "standing"],
    ["what's the score", "standing"],
    ["offer a draw", "draw"],
    ["i want a draw", "draw"],
    ["draw", "draw"],
  ])("'%s' → %s", (said, cmd) => {
    const r = parseUtterance(startEngine(), said);
    expect(r.kind).toBe("command");
    expect(r.command).toBe(cmd);
  });

  it("'help me' still means hint, bare 'help' means the help menu", () => {
    expect(parseUtterance(startEngine(), "help me").command).toBe("hint");
    expect(parseUtterance(startEngine(), "help").command).toBe("help");
  });
});

describe("describeStanding", () => {
  it("start position is roughly equal", () => {
    const a = describeStanding(startEngine(), 1);
    expect(a).toContain("roughly equal");
    expect(a).toContain("Material is even");
  });

  it("queen odds reads as winning for White, losing for Black", () => {
    const e = engineWithFen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(describeStanding(e, 1)).toContain("up 9 points");
    expect(describeStanding(e, -1)).toContain("down 9 points");
    expect(describeStanding(e, 1)).toMatch(/winning/);
  });
});

describe("questions", () => {
  it.each([
    ["where can my knight move", "mobility"],
    ["where can the knight on g1 go", "mobility"],
    ["what squares can this knight move to", "mobility"],
    ["what are my moves", "mobility"],
    ["what can i take", "captureAt"],
    ["can i capture on e5", "captureAt"],
    ["what's on e5", "squareContent"],
    ["what piece is on d4", "squareContent"],
    ["if i move my knight to e5 am i capturing", "isCapture"],
    ["is that a capture", "isCapture"],
    ["can i castle", "legality"],
    ["can i play knight to f3", "legality"],
  ])("'%s' → %s question", (said, kind) => {
    const r = parseUtterance(startEngine(), said);
    expect(r.kind).toBe("question");
    expect(r.question).toBe(kind);
  });

  it("questions don't get mistaken for moves: 'can i castle' doesn't castle", () => {
    const r = parseUtterance(startEngine(), "can i castle");
    expect(r.kind).toBe("question");
  });

  it("answers knight mobility for both knights at once", () => {
    const a = answerQuestion(startEngine(), parseUtterance(startEngine(), "where can my knight move"));
    expect(a).toContain("knight on b1");
    expect(a).toContain("knight on g1");
    expect(a).toContain("f3");
    expect(a).toContain("a3");
  });

  it("answers mobility for one specific knight", () => {
    const a = answerQuestion(startEngine(), parseUtterance(startEngine(), "where can the knight on g1 move"));
    expect(a).toContain("g1");
    expect(a).not.toContain("b1");
  });

  it("mobility answer calls out captures", () => {
    // Queen d4 vs black pawn e5: queen has quiet moves plus a capture
    const e = engineWithFen("rnbqkbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 1");
    const a = answerQuestion(e, parseUtterance(e, "where can my queen move"));
    expect(a).toContain("take the pawn on e5");
  });

  it("answers what's on a square", () => {
    const e = startEngine();
    expect(answerQuestion(e, parseUtterance(e, "what's on e2"))).toBe("e2 has a White pawn.");
    expect(answerQuestion(e, parseUtterance(e, "what's on e5"))).toBe("e5 is empty.");
  });

  it("answers available captures, none at start", () => {
    const e = startEngine();
    expect(answerQuestion(e, parseUtterance(e, "what can i take"))).toBe("You have no captures available right now.");
  });

  it("lists capture options with attackers", () => {
    const e = engineWithFen("rnbqkbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 1");
    const a = answerQuestion(e, parseUtterance(e, "what can i take"));
    expect(a).toContain("take the pawn on e5");
    expect(a).toContain("queen from d4");
  });

  it("answers is-that-a-capture for an embedded move", () => {
    const e = engineWithFen("rnbqkbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 1");
    const yes = answerQuestion(e, parseUtterance(e, "if i move my queen to e5 am i capturing"));
    expect(yes).toMatch(/^Yes/);
    const no = answerQuestion(e, parseUtterance(e, "if i move my queen to d5 would i be capturing"));
    expect(no).toMatch(/^No/);
  });

  it("answers castling legality", () => {
    const yes = answerQuestion(
      engineWithFen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1"),
      parseUtterance(startEngine(), "can i castle"));
    expect(yes).toContain("either side");
    const no = answerQuestion(startEngine(), parseUtterance(startEngine(), "can i castle"));
    expect(no).toMatch(/^No/);
  });
});

describe("conversational filler", () => {
  it.each([
    ["okay lets do pawn e4", "e4"],
    ["um knight to f3 please", "Nf3"],
    ["alright so pawn to d4", "d4"],
    ["i want to play knight f3", "Nf3"],
    ["how about e4", "e4"],
  ])("'%s' is a move, not a yes/no: %s", (said, san) => {
    const r = parseUtterance(startEngine(), said);
    expect(r.kind).toBe("move");
    expect(r.matches.map(m => m.san)).toEqual([san]);
  });

  it("filler + castle still castles", () => {
    const r = parseUtterance(
      engineWithFen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1"),
      "sure lets castle kingside");
    expect(r.matches.map(m => m.san)).toEqual(["O-O"]);
  });

  it("filler + question still answers", () => {
    const r = parseUtterance(startEngine(), "okay so what can i take");
    expect(r.kind).toBe("question");
    expect(r.question).toBe("captureAt");
  });

  it.each(["yes", "yes please", "yeah thats right", "okay", "sure", "correct"])(
    "pure affirmation '%s' is still a yes", (said) => {
      const r = parseUtterance(startEngine(), said);
      expect(r.kind).toBe("command");
      expect(r.command).toBe("yes");
    });

  it.each(["no", "no wait", "nope cancel"])("pure negation '%s' is still a no", (said) => {
    const r = parseUtterance(startEngine(), said);
    expect(r.kind).toBe("command");
    expect(r.command).toBe("no");
  });
});

describe("unknown input", () => {
  it("gibberish → unknown", () => {
    expect(parseUtterance(startEngine(), "banana sandwich").kind).toBe("unknown");
    expect(parseUtterance(startEngine(), "").kind).toBe("unknown");
  });
});

describe("parseMoveSpec details", () => {
  it("does not treat the article 'a' as a file disambiguator", () => {
    const spec = parseMoveSpec("move a pawn to e4");
    expect(spec.to).toBe("e4");
    expect(spec.fromFile).toBeNull();
  });

  it("'from' marks the origin square", () => {
    const spec = parseMoveSpec("rook from a1 to d1");
    expect(spec.from).toBe("a1");
    expect(spec.to).toBe("d1");
  });
});

describe("sanToSpeech", () => {
  it.each([
    ["e4", "pawn to e4"],
    ["Nf3", "knight to f3"],
    ["Qxe5+", "queen takes e5, check"],
    ["exd5", "pawn on the e file takes d5"],
    ["O-O", "castles kingside"],
    ["O-O-O", "castles queenside"],
    ["e8=Q+", "pawn to e8, promoting to queen, check"],
    ["Nbd2", "knight on the b file to d2"],
    ["R1d1", "rook on rank 1 to d1"],
    ["Qh4xe1#", "queen on h4 takes e1, checkmate"],
  ])("%s → %s", (san, speech) => {
    expect(sanToSpeech(san)).toBe(speech);
  });
});
