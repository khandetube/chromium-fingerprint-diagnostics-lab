const encoder = new TextEncoder();
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}
export function fnv1a(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input; let hash = 0x811c9dc5;
  for (const byte of bytes) { hash ^= byte; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, "0");
}
export function summarizeArray(values, precision = 6) {
  if (!values || values.length === 0) return { length: 0, min: null, max: null, mean: null, validCount: 0, invalidCount: 0, digest: fnv1a("") };
  let min = Infinity, max = -Infinity, sum = 0, validCount = 0;
  const normalized = Array.from(values, n => {
    const v = Number(n); if (!Number.isFinite(v)) return null;
    min = Math.min(min, v); max = Math.max(max, v); sum += v; validCount++; return Number(v.toFixed(precision));
  });
  return { length: values.length, min: validCount ? min : null, max: validCount ? max : null, mean: validCount ? Number((sum / validCount).toFixed(precision)) : null, validCount, invalidCount: values.length - validCount, digest: fnv1a(stableStringify(normalized)) };
}
export function compareSnapshots(a, b) {
  const keys = new Set([...Object.keys(a?.results ?? {}), ...Object.keys(b?.results ?? {})]);
  return [...keys].sort().map(key => {
    const left = a?.results?.[key]?.digest ?? null, right = b?.results?.[key]?.digest ?? null;
    return { module: key, before: left, after: right, status: left === null ? "added" : right === null ? "removed" : left === right ? "unchanged" : "changed" };
  });
}
function safeCapability(test) { try { return Boolean(test()); } catch { return false; } }
function getContext(doc, type) { try { return doc?.createElement("canvas")?.getContext(type) ?? null; } catch { return null; } }
export function collectEnvironment(nav = globalThis.navigator, win = globalThis.window) {
  const doc = win?.document;
  const features = {
    canvas2d: safeCapability(() => Boolean(getContext(doc, "2d"))), webgl: safeCapability(() => Boolean(getContext(doc, "webgl"))),
    webgl2: safeCapability(() => Boolean(getContext(doc, "webgl2"))),
    webAudio: typeof win?.OfflineAudioContext === "function" || typeof win?.webkitOfflineAudioContext === "function",
    localStorage: safeCapability(() => { void win.localStorage.getItem("__diagnostics_storage_probe__"); return true; }),
    workers: typeof win?.Worker === "function", serviceWorker: Boolean(nav?.serviceWorker), wasm: typeof win?.WebAssembly === "object"
  };
  return { userAgent: nav?.userAgent ?? "unavailable", platform: nav?.platform ?? "unavailable", language: nav?.language ?? "unavailable",
    languages: nav?.languages ? [...nav.languages] : [], hardwareConcurrency: nav?.hardwareConcurrency ?? null, deviceMemory: nav?.deviceMemory ?? null,
    maxTouchPoints: nav?.maxTouchPoints ?? null, cookieEnabled: nav?.cookieEnabled ?? null, features };
}
export function canvasProbe(doc = globalThis.document) {
  if (!doc?.createElement) return { available: false, digest: null, reason: "document unavailable" };
  const canvas = doc.createElement("canvas"); canvas.width = 320; canvas.height = 120;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { available: false, digest: null, reason: "2D canvas unavailable" };
  ctx.fillStyle = "#f4f4f4"; ctx.fillRect(0, 0, 320, 120); ctx.fillStyle = "#263b5a"; ctx.fillRect(12, 12, 90, 54);
  ctx.font = "17px sans-serif"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#d14b63"; ctx.fillText("Diagnostics Lab 012345", 18, 91);
  ctx.beginPath(); ctx.arc(235, 58, 31, 0, Math.PI * 2); ctx.fillStyle = "rgba(30,160,130,.72)"; ctx.fill();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return { available: true, width: canvas.width, height: canvas.height, digest: fnv1a(pixels), bytes: pixels.length };
}
export function webglProbe(doc = globalThis.document) {
  if (!doc?.createElement) return { available: false, version: null, renderer: null, vendor: null, limits: {}, reason: "document unavailable" };
  const canvas = doc.createElement("canvas"), gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return { available: false, version: null, renderer: null, vendor: null, limits: {}, reason: "WebGL unavailable or disabled" };
  const debug = gl.getExtension("WEBGL_debug_renderer_info"), safeGet = key => { try { return gl.getParameter(key); } catch { return null; } };
  return { available: true, version: safeGet(gl.VERSION), renderer: debug ? safeGet(debug.UNMASKED_RENDERER_WEBGL) : "restricted or unavailable",
    vendor: debug ? safeGet(debug.UNMASKED_VENDOR_WEBGL) : "restricted or unavailable",
    limits: { maxTextureSize: safeGet(gl.MAX_TEXTURE_SIZE), maxCubeMapSize: safeGet(gl.MAX_CUBE_MAP_TEXTURE_SIZE), maxRenderbufferSize: safeGet(gl.MAX_RENDERBUFFER_SIZE), maxVertexAttribs: safeGet(gl.MAX_VERTEX_ATTRIBS) } };
}
export async function audioProbe(win = globalThis.window) {
  const Offline = win?.OfflineAudioContext || win?.webkitOfflineAudioContext;
  if (!Offline) return { available: false, digest: null, summary: null, reason: "OfflineAudioContext unavailable" };
  try {
    const context = new Offline(1, 44100, 44100), oscillator = context.createOscillator(), compressor = context.createDynamicsCompressor();
    oscillator.type = "triangle"; oscillator.frequency.value = 10000; compressor.threshold.value = -50; compressor.knee.value = 40;
    compressor.ratio.value = 12; compressor.attack.value = 0; compressor.release.value = 0.25;
    oscillator.connect(compressor); compressor.connect(context.destination); oscillator.start(0);
    const rendered = await context.startRendering(), summary = summarizeArray(rendered.getChannelData(0).slice(0, 4096));
    return { available: true, digest: summary.digest, summary };
  } catch (error) { return { available: false, digest: null, summary: null, reason: error instanceof Error ? error.message : "Audio rendering failed" }; }
}
export async function runDiagnostics() {
  const environment = collectEnvironment(), canvas = canvasProbe(), webgl = webglProbe(), audio = await audioProbe();
  const results = { canvas: { digest: canvas.digest, available: canvas.available, reason: canvas.reason ?? null },
    webgl: { digest: fnv1a(stableStringify(webgl)), available: webgl.available, reason: webgl.reason ?? null },
    audio: { digest: audio.digest, available: audio.available, reason: audio.reason ?? null },
    environment: { digest: fnv1a(stableStringify(environment)), available: true } };
  return { schemaVersion: 1, id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), timestamp: new Date().toISOString(), environment, probes: { canvas, webgl, audio }, results };
}
