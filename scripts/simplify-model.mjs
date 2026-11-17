/* Cuts a heavy model down for phones.

     node scripts/simplify-model.mjs in.glb out.glb ratio img0.jpg img1.jpg ...
     (SLOPPY=1 for models whose triangles are not joined, ERR=0.02 error limit)

   Simplifies every
   triangle mesh to `ratio` of its indices with meshoptimizer (from three's
   own copy), keeps POSITION/NORMAL/TEXCOORD_0/TEXCOORD_1, swaps the images
   for the given files (JPEG). */
import fs from "node:fs";
import { MeshoptSimplifier } from "../node_modules/three/examples/jsm/libs/meshopt_simplifier.module.js";
const [, , input, output, ratioArg, ...imgs] = process.argv;
const ratio = Number(ratioArg);
await MeshoptSimplifier.ready;
const b = fs.readFileSync(input);
const jlen = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jlen).toString());
const bin = b.subarray(20 + jlen + 8);
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const read = (ai) => {
  const a = j.accessors[ai], bv = j.bufferViews[a.bufferView], n = SIZE[a.type];
  const Ctor = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : a.componentType === 5123 ? Uint16Array : Uint8Array;
  const bytes = Ctor.BYTES_PER_ELEMENT, stride = bv.byteStride || n * bytes, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Ctor(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
    const o = base + i * stride + k * bytes;
    out[i * n + k] = Ctor === Float32Array ? dv.getFloat32(o, true) : Ctor === Uint32Array ? dv.getUint32(o, true) : Ctor === Uint16Array ? dv.getUint16(o, true) : dv.getUint8(o);
  }
  return out;
};
const parts = []; let off = 0; const views = [], accessors = [];
const push = (buf) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } const o = off; parts.push(buf); off += buf.length; return o; };
const addAccessor = (arr, type, componentType, target, minmax) => {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  views.push({ buffer: 0, byteOffset: push(buf), byteLength: buf.length, ...(target ? { target } : {}) });
  const acc = { bufferView: views.length - 1, componentType, count: arr.length / SIZE[type], type };
  if (minmax) {
    const n = SIZE[type], mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity);
    for (let i = 0; i < arr.length; i += n) for (let k = 0; k < n; k++) { mn[k] = Math.min(mn[k], arr[i + k]); mx[k] = Math.max(mx[k], arr[i + k]); }
    acc.min = mn; acc.max = mx;
  }
  accessors.push(acc);
  return accessors.length - 1;
};
let before = 0, after = 0;
for (const mesh of j.meshes) for (const p of mesh.primitives) {
  const idx = read(p.indices), pos = read(p.attributes.POSITION);
  before += idx.length / 3;
  const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
  const [simple] = process.env.SLOPPY ? MeshoptSimplifier.simplifySloppy(new Uint32Array(idx), pos, 3, null, target, Number(process.env.ERR || 0.08)) : MeshoptSimplifier.simplify(new Uint32Array(idx), pos, 3, target, Number(process.env.ERR || 0.08), []);
  after += simple.length / 3;
  /* Keep only the vertices still used. */
  const remap = new Int32Array(pos.length / 3).fill(-1); let n = 0;
  for (const v of simple) if (remap[v] < 0) remap[v] = n++;
  const newIdx = new Uint32Array(simple.length); for (let i = 0; i < simple.length; i++) newIdx[i] = remap[simple[i]];
  const attrs = {};
  for (const [name, type] of [["POSITION", "VEC3"], ["NORMAL", "VEC3"], ["TEXCOORD_0", "VEC2"], ["TEXCOORD_1", "VEC2"]]) {
    if (p.attributes[name] == null) continue;
    const src = read(p.attributes[name]), k = SIZE[type], dst = new Float32Array(n * k);
    for (let v = 0; v < remap.length; v++) if (remap[v] >= 0) for (let c = 0; c < k; c++) dst[remap[v] * k + c] = src[v * k + c];
    attrs[name] = addAccessor(dst, type, 5126, 34962, name === "POSITION");
  }
  const ii = addAccessor(newIdx, "SCALAR", 5125, 34963, false);
  p.attributes = attrs; p.indices = ii;
}
j.accessors = accessors;
j.images = j.images.map((im, i) => { const data = fs.readFileSync(imgs[i]); views.push({ buffer: 0, byteOffset: push(data), byteLength: data.length }); return { mimeType: "image/jpeg", bufferView: views.length - 1 }; });
j.bufferViews = views;
const total = Buffer.concat(parts), binOut = Buffer.concat([total, Buffer.alloc((4 - (total.length % 4)) % 4)]);
j.buffers = [{ byteLength: binOut.length }];
let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const h = Buffer.alloc(12); h.write("glTF", 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + js.length + binOut.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write("JSON", 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(binOut.length, 0); c2.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(output, Buffer.concat([h, c1, js, c2, binOut]));
console.log("triangles", before, "->", after, "bytes", fs.statSync(output).size);
