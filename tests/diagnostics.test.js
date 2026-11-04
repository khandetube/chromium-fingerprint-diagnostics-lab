import test from "node:test";
import assert from "node:assert/strict";
import { fnv1a, stableStringify, summarizeArray, compareSnapshots, collectEnvironment, canvasProbe, webglProbe, audioProbe, validateSnapshot } from "../src/diagnostics.js";

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

test("summarizeArray reports invalid values without corrupting statistics", () => {
  const result = summarizeArray([1, Number.NaN, 3, Infinity]);
  assert.equal(result.validCount, 2);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.mean, 2);
});
test("compareSnapshots treats missing digests as added or removed", () => {
  assert.deepEqual(compareSnapshots({results:{}},{results:{canvas:{digest:"abc"}}})[0].status,"added");
});

test("canvasProbe returns a structured unavailable result when pixel readback is blocked", () => {
  const doc = { createElement: () => ({ getContext: () => ({ fillRect(){}, fillText(){}, beginPath(){}, arc(){}, fill(){}, getImageData(){ throw new Error("readback blocked"); } }) }) };
  const result = canvasProbe(doc); assert.equal(result.available, false); assert.match(result.reason, /readback blocked/);
});
test("webglProbe reports missing contexts without throwing", () => {
  const result = webglProbe({ createElement: () => ({ getContext: () => null }) }); assert.equal(result.available, false); assert.match(result.reason, /WebGL unavailable/);
});
test("audioProbe returns unavailable when OfflineAudioContext is missing", async () => {
  const result = await audioProbe({}); assert.equal(result.available, false); assert.equal(result.digest, null);
});
test("collectEnvironment detects storage exceptions safely", () => {
  const win = { get localStorage(){ throw new Error("blocked"); }, document: null }; const env = collectEnvironment({}, win); assert.equal(env.features.localStorage, false);
});


test("validateSnapshot accepts a complete version-1 snapshot", () => {
  const snapshot = {
    schemaVersion: 1, id: "run-1", timestamp: "2026-11-04T10:00:00.000Z",
    environment: {}, probes: {},
    results: Object.fromEntries(["canvas", "webgl", "audio", "environment"].map(key =>
      [key, { available: true, digest: "deadbeef" }]))
  };
  assert.equal(validateSnapshot(snapshot), true);
});
test("validateSnapshot rejects malformed, oversized, and unsupported snapshots", () => {
  assert.equal(validateSnapshot(null), false);
  assert.equal(validateSnapshot({ schemaVersion: 2 }), false);
  const snapshot = {
    schemaVersion: 1, id: "run-1", timestamp: "2026-11-04T10:00:00.000Z",
    environment: {}, probes: {},
    results: Object.fromEntries(["canvas", "webgl", "audio", "environment"].map(key =>
      [key, { available: true, digest: "x".repeat(129) }]))
  };
  assert.equal(validateSnapshot(snapshot), false);
  snapshot.results.extra = { available: true, digest: "x" };
  assert.equal(validateSnapshot(snapshot), false);
});
