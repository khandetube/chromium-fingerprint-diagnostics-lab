import test from "node:test";
import assert from "node:assert/strict";
import { fnv1a, stableStringify, summarizeArray, compareSnapshots, collectEnvironment, canvasProbe, webglProbe, audioProbe, validateSnapshot, benchmarkProbe, webglRenderingProbe, compatibilityProbe, contextLifecycleProbe } from "../src/diagnostics.js";

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
    schemaVersion: 2, id: "run-1", timestamp: "2026-11-04T10:00:00.000Z",
    environment: {}, probes: {},
    results: Object.fromEntries(["canvas", "webgl", "audio", "environment", "benchmark"].map(key =>
      [key, { available: true, digest: "deadbeef" }]))
  };
  assert.equal(validateSnapshot(snapshot), true);
});
test("validateSnapshot rejects malformed, oversized, and unsupported snapshots", () => {
  assert.equal(validateSnapshot(null), false);
  assert.equal(validateSnapshot({ schemaVersion: 2 }), false);
  const snapshot = {
    schemaVersion: 2, id: "run-1", timestamp: "2026-11-04T10:00:00.000Z",
    environment: {}, probes: {},
    results: Object.fromEntries(["canvas", "webgl", "audio", "environment", "benchmark"].map(key =>
      [key, { available: true, digest: "x".repeat(129) }]))
  };
  assert.equal(validateSnapshot(snapshot), false);
  snapshot.results.extra = { available: true, digest: "x" };
  assert.equal(validateSnapshot(snapshot), false);
});


test("benchmarkProbe returns deterministic workload structure and finite metrics", () => {
  let tick = 0;
  const result = benchmarkProbe({ iterations: 3, operations: 500, now: () => tick++ });
  assert.equal(result.available, true);
  assert.deepEqual(Object.keys(result.workloads), ["numeric", "array", "serialization"]);
  for (const item of Object.values(result.workloads)) {
    assert.equal(item.available, true);
    assert.ok(Number.isFinite(item.medianMs));
    assert.ok(Number.isFinite(item.operationsPerSecond));
    assert.ok(item.operationsPerSecond > 0);
  }
});
test("benchmarkProbe clamps unsafe iteration and operation settings", () => {
  let tick = 0;
  const result = benchmarkProbe({ iterations: 1000, operations: 1, now: () => tick++ });
  assert.equal(result.iterations, 9);
  assert.equal(result.operations, 500);
});

test("webglProbe collects WebGL limits, extensions, shader precision and context attributes", () => {
  const gl = {
    VERSION:1, SHADING_LANGUAGE_VERSION:2, MAX_TEXTURE_SIZE:3, MAX_CUBE_MAP_TEXTURE_SIZE:4,
    MAX_RENDERBUFFER_SIZE:5, MAX_VERTEX_ATTRIBS:6, MAX_VERTEX_UNIFORM_VECTORS:7,
    MAX_FRAGMENT_UNIFORM_VECTORS:8, MAX_VARYING_VECTORS:9, MAX_TEXTURE_IMAGE_UNITS:10,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS:11, MAX_VIEWPORT_DIMS:12,
    VERTEX_SHADER:13, FRAGMENT_SHADER:14, LOW_FLOAT:15, MEDIUM_FLOAT:16, HIGH_FLOAT:17,
    getParameter(key){return ({1:"WebGL 2.0",2:"GLSL ES 3.00",3:8192,4:4096,5:8192,6:16,7:256,8:224,9:16,10:16,11:32,12:[8192,8192]})[key]??null;},
    getExtension(){return null;}, getSupportedExtensions(){return ["OES_texture_float","EXT_color_buffer_float"];},
    getShaderPrecisionFormat(){return {rangeMin:127,rangeMax:127,precision:23};},
    getContextAttributes(){return {alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:"default"};}
  };
  const result=webglProbe({createElement:()=>({getContext:type=>type==="webgl2"?gl:null})});
  assert.equal(result.available,true);
  assert.equal(result.api,"WebGL 2");
  assert.equal(result.limits.maxTextureSize,8192);
  assert.equal(result.extensionCount,2);
  assert.equal(result.precision.vertex_shader_high_float.precision,23);
  assert.equal(result.contextAttributes.antialias,true);
  assert.equal(typeof result.digest,"string");
});
test("webglProbe gracefully handles exceptions from browser WebGL APIs", () => {
  const result=webglProbe({createElement:()=>({getContext:()=>{throw new Error("GPU context blocked")}})});
  assert.equal(result.available,false);
  assert.match(result.reason,/GPU context blocked/);
});

test("webglRenderingProbe returns a safe unavailable result without a context", () => {
  const result=webglRenderingProbe({createElement:()=>({getContext:()=>null})});
  assert.equal(result.available,false);
  assert.match(result.reason,/context unavailable/);
});
test("webglRenderingProbe compiles, links, draws and reads a pixel", () => {
  let id=0;
  const gl={
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,
    TRIANGLES:7,FLOAT:8,COLOR_BUFFER_BIT:9,RGBA:10,UNSIGNED_BYTE:11,NO_ERROR:0,
    createShader:type=>({id:++id,type}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>" ",
    createProgram:()=>({id:++id}),attachShader(){},bindAttribLocation(){},linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>" ",
    createBuffer:()=>({id:++id}),bindBuffer(){},bufferData(){},viewport(){},useProgram(){},enableVertexAttribArray(){},vertexAttribPointer(){},
    clearColor(){},clear(){},drawArrays(){},readPixels(x,y,w,h,f,t,p){p.set([20,180,80,255]);},
    getError:()=>0,isContextLost:()=>false,deleteBuffer(){},deleteProgram(){},deleteShader(){}
  };
  const result=webglRenderingProbe({createElement:()=>({getContext:type=>type==="webgl2"?null:gl})});
  assert.equal(result.available,true);
  assert.equal(result.shaderCompile,true);
  assert.equal(result.programLink,true);
  assert.equal(result.drawReadback,true);
  assert.deepEqual(result.centerPixel,[20,180,80,255]);
});

test("compatibilityProbe returns a bounded binary API matrix", () => {
  const matrix=compatibilityProbe({serviceWorker:{}},{Worker:function(){},WebAssembly:{},OffscreenCanvas:function(){}},{createElement:()=>({getContext:type=>type==="2d"?{}:null})});
  assert.equal(matrix.matrix.webWorkers,true);
  assert.equal(matrix.matrix.webgl1,false);
  assert.equal(matrix.matrix.canvas2d,true);
  assert.equal(matrix.total,Object.keys(matrix.matrix).length);
  assert.equal(typeof matrix.digest,"string");
});
test("schema version 3 requires GPU and compatibility evidence modules", () => {
  const keys=["canvas","webgl","audio","environment","benchmark","gpuRendering","compatibility","contextLifecycle"];
  const snapshot={schemaVersion:3,id:"v3",timestamp:"2026-11-04T00:00:00.000Z",environment:{},probes:{},results:Object.fromEntries(keys.map(key=>[key,{available:true,digest:"abc"}]))};
  assert.equal(validateSnapshot(snapshot),true);
  delete snapshot.results.compatibility;
  assert.equal(validateSnapshot(snapshot),false);
});

test("contextLifecycleProbe handles missing WebGL without hanging", async () => {
  const result=await contextLifecycleProbe({createElement:()=>({getContext:()=>null})});
  assert.equal(result.available,false);
  assert.match(result.reason,/WebGL unavailable/);
});
