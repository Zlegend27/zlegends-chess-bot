import { describe, test, expect } from "vitest";
import {
  nodeAt, playerNode, replyShares, pickReply, judgeMove, mainLine, scenarios, playerTurns,
  recordReview, dueReviews, reviewId, parseReviewId, BOX_DAYS,
} from "./openingTrainer";

/* A tiny Vienna-like course: White to move after 1.e4 e5 2.Nc3. */
const nodes = {
  "e4 e5": { p: { rep: "Nc3", ok: ["Nf3"], ev: { Nc3: 30, Nf3: 35 } } },
  "e4 e5 Nc3": { o: { r: { Nf6: [50, 60, 70], Nc6: [40, 30, 25], Qh4: [10, 2, 0] }, punish: { Qh4: ["Nf3", "Qh5"] } } },
  "e4 e5 Nc3 Nf6": { p: { rep: "f4", ok: [], ev: { f4: 20 } } },
  "e4 e5 Nc3 Nc6": { p: { rep: "f4", ok: ["Bc4"], ev: { f4: 15, Bc4: 20 } } },
  "e4 e5 Nc3 Nf6 f4": { o: { r: { d5: [30, 50, 70], exf4: [70, 50, 30] } } },
};

describe("Opening Trainer logic", () => {
  test("reply shares are per level, most common first, with mistakes marked", () => {
    const easy = replyShares(nodes["e4 e5 Nc3"], 0);
    expect(easy.map((r) => r.san)).toEqual(["Nf6", "Nc6", "Qh4"]);
    expect(easy[0].share).toBeCloseTo(0.5);
    expect(easy[2].mistake).toBe(true);
    /* A reply nobody at a level plays isn't offered at that level. */
    expect(replyShares(nodes["e4 e5 Nc3"], 2).map((r) => r.san)).not.toContain("Qh4");
  });

  test("the bot picks replies the way players at the level do", () => {
    const node = nodes["e4 e5 Nc3"];
    expect(pickReply(node, 1, () => 0.1)).toBe("Nf6");
    expect(pickReply(node, 1, () => 0.7)).toBe("Nc6");
    expect(pickReply(node, 0, () => 0.99)).toBe("Qh4");
  });

  test("moves are judged against the course", () => {
    expect(judgeMove(nodes["e4 e5 Nc3 Nc6"], "f4")).toBe("book");
    expect(judgeMove(nodes["e4 e5 Nc3 Nc6"], "Bc4")).toBe("good");
    expect(judgeMove(nodes["e4 e5 Nc3 Nc6"], "a3")).toBe("off");
    expect(judgeMove(null, "f4")).toBe("off");
  });

  test("the main line follows the course and the level's most common replies, and ends with the data", () => {
    expect(mainLine(nodes, ["e4", "e5"], 0)).toEqual(["e4", "e5", "Nc3", "Nf6", "f4", "exf4"]);
    expect(mainLine(nodes, ["e4", "e5"], 2)).toEqual(["e4", "e5", "Nc3", "Nf6", "f4", "d5"]);
  });

  test("scenarios are the other common replies and every mistake", () => {
    const s = scenarios(nodes, ["e4", "e5"], 0);
    const replies = s.map((x) => x.reply);
    expect(replies).toContain("Nc6");
    expect(replies).toContain("Qh4");
    expect(s.find((x) => x.reply === "Qh4").punish).toEqual(["Nf3", "Qh5"]);
    expect(replies).not.toContain("Nf6");
  });

  test("a quiz asks for the player's moves only", () => {
    const line = mainLine(nodes, ["e4", "e5"], 0);
    expect(playerTurns(nodes, line, ["e4", "e5"])).toEqual([2, 4]);
  });

  test("review: a miss comes back tomorrow, right answers wait longer", () => {
    let items = recordReview({}, "a", false, 100);
    expect(items.a).toEqual({ box: 1, due: 100 + BOX_DAYS[1] });
    expect(dueReviews(items, 100)).toEqual([]);
    expect(dueReviews(items, 101)).toEqual(["a"]);
    items = recordReview(items, "a", true, 101);
    expect(items.a.box).toBe(2);
    expect(items.a.due).toBe(101 + BOX_DAYS[2]);
    items = recordReview(items, "a", false, 104);
    expect(items.a.box).toBe(1);
  });

  test("review ids round-trip", () => {
    const id = reviewId("vienna", "vienna-gambit", ["e4", "e5", "Nc3"]);
    expect(parseReviewId(id)).toEqual({ course: "vienna", line: "vienna-gambit", moves: ["e4", "e5", "Nc3"] });
  });

  test("nodeAt finds positions and nothing past the opening", () => {
    expect(nodeAt(nodes, ["e4", "e5"]).p.rep).toBe("Nc3");
    expect(nodeAt(nodes, ["e4", "e5", "Nc3", "Nf6", "f4", "d5"])).toBe(null);
  });

  test("playerNode answers a mistake with the line that punishes it", () => {
    expect(playerNode(nodes, ["e4", "e5"]).p.rep).toBe("Nc3");
    const after = playerNode(nodes, ["e4", "e5", "Nc3", "Qh4"]);
    expect(after.p.rep).toBe("Nf3");
    expect(after.punishOnly).toBe(true);
    expect(playerNode(nodes, ["e4", "e5", "Nc3", "Nf6", "f4", "d5"])).toBe(null);
  });
});
