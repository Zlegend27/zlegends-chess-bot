/* A player's look across the site: a pixel character they build (the
   avatar builder page), or their account's photo. The character's face is
   their profile picture in the header and menu; the whole character stands
   in the lobby and at the table (with the photo as its head, if they chose
   the photo). Saved on the account (Supabase user metadata), so it follows
   them to every device; drawn with PixelAvatar. */
import { getSupabase } from "./supabase";

export const SKINS = ["#F5D0B0", "#E0AC80", "#C68642", "#8D5524", "#5C3A21"];
export const HAIR_COLORS = ["#2B1B12", "#6B3E1E", "#D9A441", "#E8E8E8", "#C0392B", "#8B2FC9", "#3EE7F5"];
export const SHIRTS = ["#8B2FC9", "#3EE7F5", "#F5D93E", "#D94BF0", "#4CBB47", "#F05348", "#2E86DE", "#F4EFFF"];
export const PANTS = ["#1A0B33", "#2E4A7D", "#4A3B2A", "#333333", "#6B6B6B"];
export const HAIR_STYLES = ["Short", "Long", "Spiky", "Bald", "Mohawk", "Fringe"];
export const EYES = ["Dots", "Wide", "Sleepy", "Wink"];
export const MOUTHS = ["Smile", "Flat", "Open", "Grin"];
export const FACIAL = ["None", "Moustache", "Beard"];
export const EXTRAS = ["None", "Glasses", "Shades", "Crown", "Headband", "Cap"];
/* Behind the face when it's used as a profile picture. */
export const BACKDROPS = ["#2A1650", "#8B2FC9", "#D94BF0", "#3EE7F5", "#4CBB47", "#F5D93E", "#F05348", "#F4EFFF"];

/* kind "discord" means "use my account's photo" (the name dates from when
   Discord was the only way in; saved avatars carry it, so it stays). */
export const DEFAULT_AVATAR = { kind: "pixel", skin: 1, hairStyle: 0, hair: 0, shirt: 0, pants: 0, eyes: 0, mouth: 0, facial: 0, extra: 0, bg: 0 };

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

function headFor(a) {
  const style = a.hairStyle;
  const head = [...HEAD];
  if (style === 4) {
    /* Mohawk: a strip down the middle of a shaved head. */
    head[0] = "....ooohhooo....";
    head[1] = "...ossshhssso...";
    head[2] = "..osssshhsssso..";
    head[3] = "..osssssssssso..";
  } else if (style === 5) {
    /* Fringe: hair down over the forehead. */
    head[3] = "..ohhhhhhhhhho..";
    head[4] = "..ohhsssssshho..";
  }
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
  /* The face is drawn onto the head a pixel at a time. e eyes, m mouth,
     w white, k black, g glasses frame, y gold, c the shirt's colour. */
  const grid = head.map((row) => row.split(""));
  const put = (ch, ...cells) => cells.forEach(([x, y]) => { grid[y][x] = ch; });
  put("s", [5, 5], [10, 5], [7, 7], [8, 7]); // clear the base face
  if (a.eyes === 1) put("e", [5, 4], [5, 5], [10, 4], [10, 5]);
  else if (a.eyes === 2) put("e", [4, 5], [5, 5], [10, 5], [11, 5]);
  else if (a.eyes === 3) put("e", [5, 5], [10, 5], [11, 5]);
  else put("e", [5, 5], [10, 5]);
  if (a.mouth === 0) put("m", [6, 6], [9, 6], [7, 7], [8, 7]);
  else if (a.mouth === 1) put("m", [7, 7], [8, 7]);
  else if (a.mouth === 2) put("k", [7, 7], [8, 7]);
  else put("w", [6, 7], [7, 7], [8, 7], [9, 7]);
  if (a.facial === 1) put("h", [6, 6], [7, 6], [8, 6], [9, 6]);
  else if (a.facial === 2) {
    put("h", [3, 7], [4, 7], [5, 7], [10, 7], [11, 7], [12, 7]);
    for (let x = 4; x <= 11; x++) put("h", [x, 8]);
  }
  if (a.extra === 1) put("g", [4, 5], [6, 5], [7, 5], [8, 5], [9, 5], [11, 5]);
  else if (a.extra === 2) for (let x = 4; x <= 11; x++) put("k", [x, 5]);
  else if (a.extra === 3) {
    put("y", [3, 0], [5, 0], [7, 0], [8, 0], [10, 0], [12, 0]);
    for (let x = 3; x <= 12; x++) put("y", [x, 1]);
  } else if (a.extra === 4) for (let x = 3; x <= 12; x++) put("c", [x, 3]);
  else if (a.extra === 5) {
    for (let x = 4; x <= 11; x++) put("c", [x, 1]);
    for (let x = 3; x <= 12; x++) put("c", [x, 2]);
    for (let x = 3; x <= 14; x++) put("c", [x, 3]);
  }
  return grid.map((row) => row.join(""));
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
    eyes: pick(a.eyes, EYES, 0),
    mouth: pick(a.mouth, MOUTHS, 0),
    facial: pick(a.facial, FACIAL, 0),
    extra: pick(a.extra, EXTRAS, 0),
    bg: pick(a.bg, BACKDROPS, 0),
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
  const head = bodyOnly ? HEAD.map(() => ".".repeat(16)) : headFor(a);
  return {
    rows: [...head, ...BODY],
    pal: {
      o: "#150C24", h: HAIR_COLORS[a.hair], s: SKINS[a.skin], e: "#150C24", m: "#9C4A3A",
      t: SHIRTS[a.shirt], b: shade(SHIRTS[a.shirt]), p: PANTS[a.pants], k: "#150C24",
      w: "#FFFFFF", g: "#150C24", y: "#F5D93E", c: SHIRTS[a.shirt],
    },
  };
}

/** The saved avatar from a session, or the default. Someone who has never
 *  chosen starts with their account's photo if it has one (Google and
 *  Discord do), otherwise with the default character. */
export function avatarFromSession(session) {
  const meta = session?.user?.user_metadata;
  if (meta && !meta.zl_avatar && (meta.avatar_url || meta.picture)) return { ...DEFAULT_AVATAR, kind: "discord" };
  return normalizeAvatar(meta?.zl_avatar);
}

/** A random character, for the builder's Surprise me button. */
export function randomAvatar(kind = "pixel") {
  const any = (list) => (Math.random() * list.length) | 0;
  return {
    kind, skin: any(SKINS), hairStyle: any(HAIR_STYLES), hair: any(HAIR_COLORS), shirt: any(SHIRTS), pants: any(PANTS),
    eyes: any(EYES), mouth: any(MOUTHS), facial: Math.random() < 0.7 ? 0 : any(FACIAL), extra: Math.random() < 0.5 ? 0 : any(EXTRAS), bg: any(BACKDROPS),
  };
}

/** Saves the avatar on the account. Resolves to whether it worked. */
export async function saveAvatar(avatar) {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.auth.updateUser({ data: { zl_avatar: normalizeAvatar(avatar) } });
  return !error;
}
