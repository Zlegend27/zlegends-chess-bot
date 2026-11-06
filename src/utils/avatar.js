/* A player's look in the lobby and at the table: either their Discord
   picture on a pixel body, or a pixel character they build on their
   profile. Saved on the account (Supabase user metadata), so it follows
   them to every device; drawn with PixelAvatar. */
import { getSupabase } from "./supabase";

export const SKINS = ["#F5D0B0", "#E0AC80", "#C68642", "#8D5524", "#5C3A21"];
export const HAIR_COLORS = ["#2B1B12", "#6B3E1E", "#D9A441", "#E8E8E8", "#C0392B", "#8B2FC9", "#3EE7F5"];
export const SHIRTS = ["#8B2FC9", "#3EE7F5", "#F5D93E", "#D94BF0", "#4CBB47", "#F05348", "#2E86DE", "#F4EFFF"];
export const PANTS = ["#1A0B33", "#2E4A7D", "#4A3B2A", "#333333", "#6B6B6B"];
export const HAIR_STYLES = ["Short", "Long", "Spiky", "Bald"];

export const DEFAULT_AVATAR = { kind: "pixel", skin: 1, hairStyle: 0, hair: 0, shirt: 0, pants: 0 };

/* 16x24 character. o outline, h hair, s skin, e eyes, m mouth, t shirt,
   b shirt shade, p trousers, k shoes. Rows 0-9 are the head, which the
   Discord look replaces with the player's picture. */
const HEAD = [
  "....oooooooo....",
  "...ohhhhhhhho...",
  "..ohhhhhhhhhho..",
  "..ohssssssssho..",
  "..osssssssssso..",
  "..ossessssesso..",
  "..osssssssssso..",
  "..ossssmmsssso..",
  "...osssssssso...",
  "....oooooooo....",
];
const BODY = [
  "......osso......",
  "..otttttttttto..",
  ".otttttttttttto.",
  ".osttttttttttso.",
  ".osttttttttttso.",
  ".osttbbbbbbttso.",
  "..o.tttttttt.o..",
  "...oppppppppo...",
  "...oppppppppo...",
  "...opppoopppo...",
  "...oppo..oppo...",
  "...oppo..oppo...",
  "..okkko..okkko..",
  "..ooooo..ooooo..",
];
export const HEAD_ROWS = HEAD.length;

function headFor(style) {
  const head = [...HEAD];
  if (style === 1) {
    /* Long: hair falls down both sides of the face. */
    for (let y = 4; y <= 7; y++) head[y] = head[y].replace(/^\.\.o/, ".oh").replace(/o\.\.$/, "ho.");
    head[8] = "..ohsssssssho...".slice(0, 16);
  } else if (style === 2) {
    head[0] = "...h.h.hh.h.h...";
  } else if (style === 3) {
    head[1] = "...osssssssso...";
    head[2] = "..osssssssssso..";
    head[3] = "..osssssssssso..";
  }
  return head;
}

/** Keeps a saved avatar valid even if it was saved by an older version. */
export function normalizeAvatar(raw) {
  const pick = (v, list, fallback) => (Number.isInteger(v) && v >= 0 && v < list.length ? v : fallback);
  const a = raw && typeof raw === "object" ? raw : {};
  return {
    kind: a.kind === "discord" ? "discord" : "pixel",
    skin: pick(a.skin, SKINS, DEFAULT_AVATAR.skin),
    hairStyle: pick(a.hairStyle, HAIR_STYLES, DEFAULT_AVATAR.hairStyle),
    hair: pick(a.hair, HAIR_COLORS, DEFAULT_AVATAR.hair),
    shirt: pick(a.shirt, SHIRTS, DEFAULT_AVATAR.shirt),
    pants: pick(a.pants, PANTS, DEFAULT_AVATAR.pants),
  };
}

function shade(hex, amount = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** { rows, pal } for PixelAvatar. `bodyOnly` leaves the head rows empty
 *  for the Discord look, which draws the picture there instead. */
export function spriteFor(avatar, { bodyOnly = false } = {}) {
  const a = normalizeAvatar(avatar);
  const head = bodyOnly ? HEAD.map(() => ".".repeat(16)) : headFor(a.hairStyle);
  return {
    rows: [...head, ...BODY],
    pal: {
      o: "#150C24", h: HAIR_COLORS[a.hair], s: SKINS[a.skin], e: "#150C24", m: "#9C4A3A",
      t: SHIRTS[a.shirt], b: shade(SHIRTS[a.shirt]), p: PANTS[a.pants], k: "#150C24",
    },
  };
}

/** The saved avatar from a session, or the default. */
export const avatarFromSession = (session) => normalizeAvatar(session?.user?.user_metadata?.zl_avatar);

/** Saves the avatar on the account. Resolves to whether it worked. */
export async function saveAvatar(avatar) {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.auth.updateUser({ data: { zl_avatar: normalizeAvatar(avatar) } });
  return !error;
}
