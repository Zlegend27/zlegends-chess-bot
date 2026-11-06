import { describe, test, expect } from "vitest";
import { detectEcoOpening } from "./ecoOpenings";
import data from "./ecoOpenings.json";

const name = (line) => detectEcoOpening(line.split(" "), data)?.name;

describe("naming the opening", () => {
  test("never names an opening before its moves are played", () => {
    expect(name("e4 e5")).toBe("King's Pawn Game");
    expect(name("e4 e5 Ke2")).toBe("Bongcloud Attack");
  });

  test("names the deepest opening reached, and keeps it after leaving theory", () => {
    expect(name("e4 e5 Nc3")).toBe("Vienna Game");
    expect(name("e4 e5 Nc3 Nf6 f4")).toBe("Vienna Game: Vienna Gambit");
    expect(name("e4 e5 Nc3 Nf6 f4 h6 h3")).toBe(name("e4 e5 Nc3 Nf6 f4 h6"));
  });
});
