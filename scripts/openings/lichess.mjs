/* Reading the Lichess games database (database.lichess.org, CC0): its
   compressed monthly files and their movetext. Shared by the Opening
   Trainer's data scripts. */
import { Transform } from "node:stream";

/* Lichess compresses in parallel blocks, each one announced by a small
   "skippable" frame holding the next block's size. Node's decompressor
   rejects those frames, so this drops them and passes the blocks through. */
export function dropSkippableFrames() {
  let pending = Buffer.alloc(0), passLeft = 0, plain = false;
  return new Transform({
    transform(chunk, _enc, done) {
      if (plain) { done(null, chunk); return; }
      pending = Buffer.concat([pending, chunk]);
      const out = [];
      for (;;) {
        if (passLeft > 0) {
          const n = Math.min(passLeft, pending.length);
          out.push(pending.subarray(0, n));
          pending = pending.subarray(n);
          passLeft -= n;
          if (passLeft > 0) break;
        }
        if (pending.length < 8) break;
        const magic = pending.readUInt32LE(0);
        if ((magic & 0xfffffff0) !== 0x184d2a50) { plain = true; out.push(pending); pending = Buffer.alloc(0); break; }
        const size = pending.readUInt32LE(4);
        if (pending.length < 8 + size) break;
        passLeft = size === 4 ? pending.readUInt32LE(8) : 0;
        pending = pending.subarray(8 + size);
      }
      done(null, Buffer.concat(out));
    },
  });
}

/** The moves of a game's movetext as SAN, without clocks, evals, move
 *  numbers, annotations or the result. */
export function sansOf(movetext) {
  return movetext.replace(/\{[^}]*\}/g, " ").replace(/\d+\.(\.\.)?/g, " ").split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).map((t) => t.replace(/[?!]+$/, ""));
}
