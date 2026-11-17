/* Downloads Chess Tactica's textures and skies into public/tactica/env/.
   Every file is public domain (CC0): Poly Haven (polyhaven.com) and
   ambientCG (ambientcg.com). 1K versions, sized for phones. Safe to run
   again: files already there are skipped.

     node scripts/fetch-tactica-art.mjs */
import { mkdirSync, existsSync, writeFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const OUT = new URL("../public/tactica/env/", import.meta.url);
const UA = { "User-Agent": "chess-game-asset-fetch" };

/* [world, Poly Haven id, which maps, file prefix]. Maps: diff, nor, rough. */
const TEXTURES = [
  ["bin", "rusty_corrugated_iron", ["diff", "nor", "rough"], "wall"],
  ["bin", "snow_02", ["diff", "nor"], "snow"],
  ["ice", "snow_02", ["diff", "nor", "rough"], "snow"],
  ["ice", "marble_cliff_01", ["diff", "nor"], "cliff"],
  ["volcano", "burned_ground_01", ["diff", "nor", "rough"], "ground"],
  ["volcano", "rock_face_03", ["diff", "nor"], "rock"],
  ["demon", "castle_wall_slates", ["diff", "nor", "rough"], "floor"],
  ["demon", "castle_brick_07", ["diff", "nor"], "pillar"],
  ["demon", "metal_plate_02", ["diff", "nor", "rough"], "armor"],
];
/* [world, Poly Haven HDRI id]: lighting and reflections, and the sky where one shows. */
const SKIES = [
  ["bin", "abandoned_garage"],
  ["ice", "snow_field_2_puresky"],
  ["volcano", "industrial_sunset_puresky"],
  ["demon", "qwantani_night_puresky"],
];
/* [world, ambientCG id, file prefix]: ice for the floes' sides, lava. */
const ACG = [
  ["ice", "Ice002", "ice"],
  ["volcano", "Lava004", "lava"],
];

/* Poly Haven models (glTF, 1K textures), saved to public/tactica/models/<id>/.
   The textures in the repo were then shrunk to 512 px (they are small on
   screen); a fresh run downloads 1K again. */
const MODELS = [
  // the bin's rubbish
  "trashbag", "can_rusted", "plastic_bottle_gallon", "cardboard_box_01", "russian_food_cans_01",
  // rocks for the lake (snowed on) and the volcano (burnt)
  "rock_09", "rock_07", "moon_rock_01", "moon_rock_02", "moon_rock_03", "moon_rock_05",
  // the demon's realm
  "gothic_statue", "antique_estoc", "antique_katana_01", "wooden_handle_saber", "hatchet", "wooden_axe_02", "bull_head",
];

const MAP_KEY = { diff: "Diffuse", nor: "nor_gl", rough: "Rough" };

async function get(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
async function save(url, file, md5) {
  if (existsSync(file)) return "kept";
  const data = await get(url);
  if (md5 && createHash("md5").update(data).digest("hex") !== md5) throw new Error(`checksum mismatch: ${url}`);
  writeFileSync(file, data);
  return `${(data.length / 1024).toFixed(0)} KB`;
}

for (const world of ["bin", "ice", "volcano", "demon"]) mkdirSync(new URL(`${world}/`, OUT), { recursive: true });

for (const [world, id, maps, prefix] of TEXTURES) {
  const files = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());
  for (const m of maps) {
    const entry = files[MAP_KEY[m]]["1k"].jpg;
    const file = new URL(`${world}/${prefix}_${m}.jpg`, OUT);
    console.log(`${world}/${prefix}_${m}.jpg  ${await save(entry.url, file, entry.md5)}  (${id})`);
  }
}
for (const [world, id] of SKIES) {
  const files = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());
  const entry = files.hdri["1k"].hdr;
  console.log(`${world}/sky.hdr  ${await save(entry.url, new URL(`${world}/sky.hdr`, OUT), entry.md5)}  (${id})`);
}
const MODELS_OUT = new URL("../public/tactica/models/", import.meta.url);
for (const id of MODELS) {
  const gltf = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString()).gltf["1k"].gltf;
  const dir = new URL(`${id}/`, MODELS_OUT);
  mkdirSync(new URL("textures/", dir), { recursive: true });
  const done = await save(gltf.url, new URL(`${id}.gltf`, dir), gltf.md5);
  for (const [path, f] of Object.entries(gltf.include)) {
    if (path.includes("/")) mkdirSync(new URL(path.slice(0, path.lastIndexOf("/") + 1), dir), { recursive: true });
    await save(f.url, new URL(path, dir), f.md5);
  }
  console.log(`models/${id}  ${done}`);
}

for (const [world, id, prefix] of ACG) {
  const dir = new URL(`${world}/`, OUT);
  if (existsSync(new URL(`${prefix}_diff.jpg`, dir))) { console.log(`${world}/${prefix}_*  kept`); continue; }
  const tmp = new URL(`_${id}/`, OUT);
  mkdirSync(tmp, { recursive: true });
  const zip = new URL(`${id}.zip`, tmp);
  writeFileSync(zip, await get(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`));
  execFileSync("unzip", ["-o", "-q", zip.pathname.replace(/^\/([A-Za-z]:)/, "$1"), "-d", tmp.pathname.replace(/^\/([A-Za-z]:)/, "$1")]);
  for (const name of readdirSync(tmp)) {
    const kind = /_Color\.jpg$/.test(name) ? "diff" : /_NormalGL\.jpg$/.test(name) ? "nor" : /_Roughness\.jpg$/.test(name) ? "rough" : /_Emission\.jpg$/.test(name) ? "glow" : null;
    if (kind) renameSync(new URL(name, tmp), new URL(`${prefix}_${kind}.jpg`, dir));
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${world}/${prefix}_*  ${readdirSync(dir).filter((n) => n.startsWith(prefix + "_")).join(", ")}  (${id})`);
}
