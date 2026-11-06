import { describe, test, expect } from "vitest";
import { spriteFor, normalizeAvatar, DEFAULT_AVATAR, HAIR_STYLES, HEAD_ROWS } from "./avatar";

describe("player sprites", () => {
  test("every hair style draws a 16x24 sprite with colours for every pixel", () => {
    HAIR_STYLES.forEach((_, hairStyle) => {
      const { rows, pal } = spriteFor({ ...DEFAULT_AVATAR, hairStyle });
      expect(rows).toHaveLength(24);
      for (const row of rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== ".") expect(pal[ch], `colour for "${ch}"`).toBeTruthy();
      }
    });
  });

  test("the Discord look leaves the head empty for the picture", () => {
    const { rows } = spriteFor(DEFAULT_AVATAR, { bodyOnly: true });
    expect(rows.slice(0, HEAD_ROWS).join("")).toMatch(/^\.+$/);
    expect(rows.slice(HEAD_ROWS).join("")).toMatch(/t/);
  });

  test("a broken or old saved avatar falls back to valid choices", () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({ kind: "discord", skin: 99, shirt: 2 })).toEqual({ ...DEFAULT_AVATAR, kind: "discord", shirt: 2 });
  });
});
