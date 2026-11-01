/* Runs Maia3 off the main thread, so the board never stalls while it reads a
   position. One thread only: more would need cross-origin isolation headers,
   which this site doesn't set. Basic graph optimization is what the model's
   publisher requires, since the heavier levels fail on its fp16 weights. */
import * as ort from "onnxruntime-web/wasm";
import { MOVE_SLOTS, moveChances, tokensFor } from "../utils/maiaEncoding";

ort.env.wasm.numThreads = 1;
/* The build bundles this file, but the dev server needs telling where it is. */
if (import.meta.env.DEV) ort.env.wasm.wasmPaths = { wasm: "/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm" };

let session = null;

async function load() {
  session ??= await ort.InferenceSession.create("/maia3/maia3-5m.fp16.onnx", {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "basic",
  });
  return session;
}

async function predict({ fen, selfElo, oppoElo, ucis }) {
  const model = await load();
  const out = await model.run({
    tokens: new ort.Tensor("float32", tokensFor(fen), [1, 64, 12]),
    elo_self: new ort.Tensor("float32", Float32Array.of(selfElo), [1]),
    elo_oppo: new ort.Tensor("float32", Float32Array.of(oppoElo), [1]),
  });
  if (out.logits_move.data.length !== MOVE_SLOTS) throw new Error("unexpected Maia output");
  return moveChances(out.logits_move.data, ucis, fen);
}

self.onmessage = ({ data }) => {
  (data.load ? load().then(() => null) : predict(data)).then(
    (chances) => self.postMessage({ id: data.id, chances }),
    (e) => self.postMessage({ id: data.id, error: String(e?.message || e) }),
  );
};
