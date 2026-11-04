import test from "node:test";
import assert from "node:assert/strict";
import { fnv1a, stableStringify, summarizeArray, compareSnapshots, collectEnvironment } from "../src/diagnostics.js";

test("stableStringify sorts object keys recursively", () => {
  assert.equal(stableStringify({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});
test("fnv1a is deterministic", () => {
  assert.equal(fnv1a("diagnostics"), fnv1a("diagnostics"));
  assert.notEqual(fnv1a("diagnostics"), fnv1a("different"));
});
test("summarizeArray returns stable statistics", () => {
  const result = summarizeArray([1, 2, 3]);
  assert.deepEqual({ length: result.length, min: result.min, max: result.max, mean: result.mean }, { length: 3, min: 1, max: 3, mean: 2 });
  assert.equal(result.digest, summarizeArray([1, 2, 3]).digest);
});
test("compareSnapshots identifies added, removed, changed and unchanged modules", () => {
  const before = { results: { canvas: { digest: "a" }, webgl: { digest: "b" }, audio: { digest: "c" } } };
  const after = { results: { canvas: { digest: "a" }, webgl: { digest: "x" }, environment: { digest: "d" } } };
  assert.deepEqual(compareSnapshots(before, after).map(x => [x.module, x.status]), [
    ["audio", "removed"], ["canvas", "unchanged"], ["environment", "added"], ["webgl", "changed"]
  ]);
});
test("collectEnvironment tolerates missing browser globals", () => {
  const env = collectEnvironment(undefined, undefined);
  assert.equal(env.userAgent, "unavailable");
  assert.equal(env.features.canvas2d, false);
});
