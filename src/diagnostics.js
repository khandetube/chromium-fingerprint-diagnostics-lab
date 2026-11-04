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
  const normalized = Array.from(values, n => { const v = Number(n); if (!Number.isFinite(v)) return null; min = Math.min(min, v); max = Math.max(max, v); sum += v; validCount++; return Number(v.toFixed(precision)); });
  return { length: values.length, min: validCount ? min : null, max: validCount ? max : null, mean: validCount ? Number((sum / validCount).toFixed(precision)) : null, validCount, invalidCount: values.length - validCount, digest: fnv1a(stableStringify(normalized)) };
}
export function compareSnapshots(a, b) {
  const keys = new Set([...Object.keys(a?.results ?? {}), ...Object.keys(b?.results ?? {})]);
  return [...keys].sort().map(key => { const left = a?.results?.[key]?.digest ?? null, right = b?.results?.[key]?.digest ?? null; return { module: key, before: left, after: right, status: left === null ? "added" : right === null ? "removed" : left === right ? "unchanged" : "changed" }; });
}
function safeCapability(test) { try { return Boolean(test()); } catch { return false; } }
function getContext(doc, type, options) { try { return doc?.createElement("canvas")?.getContext(type, options) ?? null; } catch { return null; } }
export function collectEnvironment(nav = globalThis.navigator, win = globalThis.window) {
  const doc = win?.document;
  const features = {
    canvas2d: safeCapability(() => Boolean(getContext(doc, "2d"))), webgl: safeCapability(() => Boolean(getContext(doc, "webgl"))), webgl2: safeCapability(() => Boolean(getContext(doc, "webgl2"))),
    webAudio: typeof win?.OfflineAudioContext === "function" || typeof win?.webkitOfflineAudioContext === "function",
    localStorage: safeCapability(() => { void win.localStorage.getItem("__diagnostics_storage_probe__"); return true; }),
    workers: typeof win?.Worker === "function", serviceWorker: Boolean(nav?.serviceWorker), wasm: typeof win?.WebAssembly === "object"
  };
  return { userAgent: nav?.userAgent ?? "unavailable", platform: nav?.platform ?? "unavailable", language: nav?.language ?? "unavailable", languages: nav?.languages ? [...nav.languages] : [],
    hardwareConcurrency: nav?.hardwareConcurrency ?? null, deviceMemory: nav?.deviceMemory ?? null, maxTouchPoints: nav?.maxTouchPoints ?? null, cookieEnabled: nav?.cookieEnabled ?? null, features };
}
export function canvasProbe(doc = globalThis.document) {
  if (!doc?.createElement) return { available: false, digest: null, reason: "document unavailable" };
  try {
    const canvas = doc.createElement("canvas"); canvas.width = 320; canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { available: false, digest: null, reason: "2D canvas unavailable" };
    ctx.fillStyle = "#f4f4f4"; ctx.fillRect(0, 0, 320, 120); ctx.fillStyle = "#263b5a"; ctx.fillRect(12, 12, 90, 54);
    ctx.font = "17px sans-serif"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#d14b63"; ctx.fillText("Diagnostics Lab 012345", 18, 91);
    ctx.beginPath(); ctx.arc(235, 58, 31, 0, Math.PI * 2); ctx.fillStyle = "rgba(30,160,130,.72)"; ctx.fill();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return { available: true, width: canvas.width, height: canvas.height, digest: fnv1a(pixels), bytes: pixels.length };
  } catch (error) { return { available: false, digest: null, reason: error instanceof Error ? error.message : "Canvas probe failed" }; }
}
export function webglProbe(doc = globalThis.document) {
  if (!doc?.createElement) return { available: false, version: null, renderer: null, vendor: null, limits: {}, reason: "document unavailable" };
  try {
    const canvas = doc.createElement("canvas"), gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { available: false, version: null, renderer: null, vendor: null, limits: {}, reason: "WebGL unavailable or disabled" };
    const debug = gl.getExtension("WEBGL_debug_renderer_info"), safeGet = key => { try { return gl.getParameter(key); } catch { return null; } };
    return { available: true, version: safeGet(gl.VERSION), renderer: debug ? safeGet(debug.UNMASKED_RENDERER_WEBGL) : "restricted or unavailable", vendor: debug ? safeGet(debug.UNMASKED_VENDOR_WEBGL) : "restricted or unavailable",
      limits: { maxTextureSize: safeGet(gl.MAX_TEXTURE_SIZE), maxCubeMapSize: safeGet(gl.MAX_CUBE_MAP_TEXTURE_SIZE), maxRenderbufferSize: safeGet(gl.MAX_RENDERBUFFER_SIZE), maxVertexAttribs: safeGet(gl.MAX_VERTEX_ATTRIBS) } };
  } catch (error) { return { available: false, version: null, renderer: null, vendor: null, limits: {}, reason: error instanceof Error ? error.message : "WebGL probe failed" }; }
}
export async function audioProbe(win = globalThis.window) {
  const Offline = win?.OfflineAudioContext || win?.webkitOfflineAudioContext;
  if (!Offline) return { available: false, digest: null, summary: null, reason: "OfflineAudioContext unavailable" };
  try {
    const context = new Offline(1, 44100, 44100), oscillator = context.createOscillator(), compressor = context.createDynamicsCompressor();
    oscillator.type = "triangle"; oscillator.frequency.value = 10000; compressor.threshold.value = -50; compressor.knee.value = 40; compressor.ratio.value = 12; compressor.attack.value = 0; compressor.release.value = 0.25;
    oscillator.connect(compressor); compressor.connect(context.destination); oscillator.start(0);
    const rendered = await context.startRendering(), summary = summarizeArray(rendered.getChannelData(0).slice(0, 4096));
    return { available: true, digest: summary.digest, summary };
  } catch (error) { return { available: false, digest: null, summary: null, reason: error instanceof Error ? error.message : "Audio rendering failed" }; }
}
export async function runDiagnostics() {
  const environment = collectEnvironment(), canvas = canvasProbe(), webgl = webglProbe(), audio = await audioProbe(), benchmark = benchmarkProbe();
  const results = { canvas: { digest: canvas.digest, available: canvas.available, reason: canvas.reason ?? null }, webgl: { digest: fnv1a(stableStringify(webgl)), available: webgl.available, reason: webgl.reason ?? null },
    audio: { digest: audio.digest, available: audio.available, reason: audio.reason ?? null }, environment: { digest: fnv1a(stableStringify(environment)), available: true }, benchmark: { digest: benchmark.digest, available: benchmark.available } };
  return { schemaVersion: 2, id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), timestamp: new Date().toISOString(), environment, probes: { canvas, webgl, audio, benchmark }, results };
}


/** Structural validation for imported snapshots; not an authenticity check. */
export function validateSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) return false;
  if (typeof value.id !== "string" || value.id.length < 1 || value.id.length > 128) return false;
  if (typeof value.timestamp !== "string" || !Number.isFinite(Date.parse(value.timestamp))) return false;
  if (!value.environment || typeof value.environment !== "object" || Array.isArray(value.environment)) return false;
  if (!value.probes || typeof value.probes !== "object" || Array.isArray(value.probes)) return false;
  if (!value.results || typeof value.results !== "object" || Array.isArray(value.results)) return false;
  const allowed = new Set(value.schemaVersion === 1 ? ["canvas", "webgl", "audio", "environment"] : ["canvas", "webgl", "audio", "environment", "benchmark"]);
  const keys = Object.keys(value.results);
  if (keys.length !== allowed.size || keys.some(key => !allowed.has(key))) return false;
  return keys.every(key => {
    const result = value.results[key];
    return result && typeof result === "object" && typeof result.available === "boolean" &&
      (result.digest === null || (typeof result.digest === "string" && result.digest.length <= 128));
  });
}


/**
 * Small repeatable JavaScript runtime benchmark.
 * It measures local execution cost only; results are not device identifiers.
 */
export function benchmarkProbe(options = {}) {
  const iterations = Math.min(9, Math.max(3, Number.isInteger(options.iterations) ? options.iterations : 5));
  const operations = Math.min(20000, Math.max(500, Number.isInteger(options.operations) ? options.operations : 3000));
  const now = typeof options.now === "function" ? options.now : () => globalThis.performance?.now?.() ?? Date.now();
  const workloads = {
    numeric: () => {
      let value = 0;
      for (let i = 0; i < operations; i++) value = (value + Math.sqrt(i + 1) * 1.000001) % 1000003;
      return value;
    },
    array: () => {
      const values = Array.from({ length: operations }, (_, i) => i);
      return values.map(value => (value * 31 + 7) % 65521).reduce((sum, value) => sum + value, 0);
    },
    serialization: () => {
      const payload = Array.from({ length: Math.min(operations, 5000) }, (_, i) => ({ id: i, value: (i * 17) % 997, active: i % 2 === 0 }));
      return JSON.stringify(payload).length;
    }
  };
  const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
  const results = {};
  for (const [name, workload] of Object.entries(workloads)) {
    try {
      workload(); // warm-up, excluded from measurements
      const durations = [];
      let checksum = 0;
      for (let run = 0; run < iterations; run++) {
        const start = now();
        checksum += Number(workload()) || 0;
        const elapsed = Math.max(0.001, now() - start);
        durations.push(elapsed);
      }
      durations.sort((a, b) => a - b);
      const medianMs = durations[Math.floor(durations.length / 2)];
      results[name] = {
        available: true, iterations, operations,
        medianMs: Number(medianMs.toFixed(3)),
        p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
        operationsPerSecond: Number((operations / (medianMs / 1000)).toFixed(1)),
        checksum
      };
    } catch (error) {
      results[name] = { available: false, reason: error instanceof Error ? error.message : "Benchmark failed" };
    }
  }
  const available = Object.values(results).filter(item => item.available).length;
  return { available: available > 0, iterations, operations, workloads: results,
    digest: fnv1a(stableStringify(results)), note: "Relative local benchmark only; compare under similar device load and power conditions." };
}
