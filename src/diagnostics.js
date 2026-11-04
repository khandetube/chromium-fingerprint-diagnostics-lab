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
  const unavailable = reason => ({ available:false, api:null, version:null, shadingLanguage:null, renderer:null, vendor:null, contextAttributes:null, limits:{}, extensions:[], extensionCount:0, precision:{}, digest:null, reason });
  if (!doc?.createElement) return unavailable("document unavailable");
  try {
    const canvas=doc.createElement("canvas");
    let gl=canvas.getContext("webgl2");
    let api="WebGL 2";
    if(!gl){gl=canvas.getContext("webgl")||canvas.getContext("experimental-webgl");api="WebGL 1";}
    if(!gl)return unavailable("WebGL unavailable or disabled");
    const get=(key)=>{try{return gl.getParameter(key)}catch{return null}};
    const debug=gl.getExtension("WEBGL_debug_renderer_info");
    const extensions=(()=>{try{return (gl.getSupportedExtensions()||[]).filter(x=>typeof x==="string").sort()}catch{return []}})();
    const limits={};
    for(const [name,key] of Object.entries({
      maxTextureSize:gl.MAX_TEXTURE_SIZE,maxCubeMapSize:gl.MAX_CUBE_MAP_TEXTURE_SIZE,
      maxRenderbufferSize:gl.MAX_RENDERBUFFER_SIZE,maxVertexAttribs:gl.MAX_VERTEX_ATTRIBS,
      maxVertexUniformVectors:gl.MAX_VERTEX_UNIFORM_VECTORS,maxFragmentUniformVectors:gl.MAX_FRAGMENT_UNIFORM_VECTORS,
      maxVaryingVectors:gl.MAX_VARYING_VECTORS,maxTextureImageUnits:gl.MAX_TEXTURE_IMAGE_UNITS,
      maxCombinedTextureImageUnits:gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
      maxViewportWidth:gl.MAX_VIEWPORT_DIMS
    })) limits[name]=key===undefined?null:get(key);
    if(api==="WebGL 2"){
      for(const [name,key] of Object.entries({max3DTextureSize:gl.MAX_3D_TEXTURE_SIZE,maxArrayTextureLayers:gl.MAX_ARRAY_TEXTURE_LAYERS,maxDrawBuffers:gl.MAX_DRAW_BUFFERS,maxColorAttachments:gl.MAX_COLOR_ATTACHMENTS,maxSamples:gl.MAX_SAMPLES})) limits[name]=get(key);
    }
    const precision={};
    for(const shaderType of ["VERTEX_SHADER","FRAGMENT_SHADER"]){
      const type=gl[shaderType];
      for(const precisionType of ["LOW_FLOAT","MEDIUM_FLOAT","HIGH_FLOAT"]){
        const key=shaderType.toLowerCase()+"_"+precisionType.toLowerCase();
        try{const p=gl.getShaderPrecisionFormat(type,gl[precisionType]);precision[key]=p?{rangeMin:p.rangeMin,rangeMax:p.rangeMax,precision:p.precision}:null}catch{precision[key]=null}
      }
    }
    const attributes=(()=>{try{return gl.getContextAttributes()}catch{return null}})();
    const contextAttributes=attributes?{alpha:attributes.alpha,antialias:attributes.antialias,depth:attributes.depth,stencil:attributes.stencil,premultipliedAlpha:attributes.premultipliedAlpha,preserveDrawingBuffer:attributes.preserveDrawingBuffer,powerPreference:attributes.powerPreference}:null;
    const data={available:true,api,version:get(gl.VERSION),shadingLanguage:get(gl.SHADING_LANGUAGE_VERSION),
      renderer:debug?get(debug.UNMASKED_RENDERER_WEBGL):"restricted or unavailable",
      vendor:debug?get(debug.UNMASKED_VENDOR_WEBGL):"restricted or unavailable",
      limits,extensions,extensionCount:extensions.length,precision,contextAttributes};
    data.digest=fnv1a(stableStringify(data));
    return data;
  }catch(error){return unavailable(error instanceof Error?error.message:"WebGL capability probe failed")}
}

/**
 * Executes a minimal WebGL draw/readback validation. It does not force context loss
 * or alter browser settings; it checks the context lifecycle state exposed by the API.
 */
export function webglRenderingProbe(doc = globalThis.document) {
  const unavailable = reason => ({ available:false, shaderCompile:false, programLink:false, framebufferComplete:null, drawReadback:false, contextLost:null, reason });
  if (!doc?.createElement) return unavailable("document unavailable");
  let gl, program, vertex, fragment, buffer, texture, framebuffer;
  try {
    const canvas=doc.createElement("canvas"); canvas.width=16; canvas.height=16;
    gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    if(!gl)return unavailable("WebGL context unavailable");
    const contextLost=()=>{try{return gl.isContextLost()}catch{return null}};
    if(contextLost())return {...unavailable("WebGL context is already lost"),contextLost:true};
    const shader=(type,source)=>{
      const item=gl.createShader(type); if(!item)throw new Error("Unable to allocate shader");
      gl.shaderSource(item,source); gl.compileShader(item);
      if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(item)||"Shader compilation failed";gl.deleteShader(item);throw new Error(log)}
      return item;
    };
    const webgl2=typeof gl.createVertexArray==="function";
    const vertexSource=webgl2?"#version 300 es\nin vec2 position;\nvoid main(){gl_Position=vec4(position,0.0,1.0);}":"attribute vec2 position;\nvoid main(){gl_Position=vec4(position,0.0,1.0);}";
    const fragmentSource=webgl2?"#version 300 es\nprecision mediump float;\nout vec4 color;\nvoid main(){color=vec4(0.2,0.7,0.4,1.0);}":"precision mediump float;\nvoid main(){gl_FragColor=vec4(0.2,0.7,0.4,1.0);}";
    vertex=shader(gl.VERTEX_SHADER,vertexSource); fragment=shader(gl.FRAGMENT_SHADER,fragmentSource);
    program=gl.createProgram(); if(!program)throw new Error("Unable to allocate program");
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.bindAttribLocation(program,0,"position");gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"Program link failed");
    buffer=gl.createBuffer();if(!buffer)throw new Error("Unable to allocate vertex buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.viewport(0,0,16,16);gl.useProgram(program);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
    const pixel=new Uint8Array(4);gl.readPixels(8,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    const error=gl.getError();
    const drawReadback=error===gl.NO_ERROR && pixel[1]>0;
    const lost=contextLost();
    // Query the browser-managed default framebuffer only when the API supports it.
    let framebufferComplete=null;
    if (typeof gl.checkFramebufferStatus==="function" && gl.FRAMEBUFFER!==undefined && gl.FRAMEBUFFER_COMPLETE!==undefined) {
      try { framebufferComplete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE; }
      catch { framebufferComplete=null; }
    }
    return {available:!lost&&drawReadback&&framebufferComplete!==false,shaderCompile:true,programLink:true,framebufferComplete,drawReadback,centerPixel:Array.from(pixel),glError:error,contextLost:lost,reason:lost?"Context lost during rendering":drawReadback?null:"Draw/readback validation failed"};
  }catch(error){return {...unavailable(error instanceof Error?error.message:"WebGL rendering validation failed"),contextLost:gl?(()=>{try{return gl.isContextLost()}catch{return null}})():null}}
  finally{try{if(gl&&buffer)gl.deleteBuffer(buffer);if(gl&&texture)gl.deleteTexture(texture);if(gl&&framebuffer)gl.deleteFramebuffer(framebuffer);if(gl&&program)gl.deleteProgram(program);if(gl&&vertex)gl.deleteShader(vertex);if(gl&&fragment)gl.deleteShader(fragment)}catch{/* Context may have been lost during cleanup. */}}
}


/** Binary API support matrix; intentionally avoids high-entropy identifiers. */
export function compatibilityProbe(nav=globalThis.navigator, win=globalThis.window, doc=globalThis.document) {
  const check=fn=>{try{return Boolean(fn())}catch{return false}};
  const matrix={
    canvas2d:check(()=>!!doc?.createElement("canvas").getContext("2d")),
    webgl1:check(()=>!!doc?.createElement("canvas").getContext("webgl")),
    webgl2:check(()=>!!doc?.createElement("canvas").getContext("webgl2")),
    webgpu:check(()=>!!nav?.gpu),
    offscreenCanvas:typeof win?.OffscreenCanvas==="function",
    webAssembly:typeof win?.WebAssembly==="object",
    webWorkers:typeof win?.Worker==="function",
    sharedArrayBuffer:typeof win?.SharedArrayBuffer==="function",
    resizeObserver:typeof win?.ResizeObserver==="function",
    intersectionObserver:typeof win?.IntersectionObserver==="function",
    audioContext:typeof win?.AudioContext==="function"||typeof win?.webkitAudioContext==="function",
    serviceWorker:!!nav?.serviceWorker
  };
  return {matrix,supported:Object.values(matrix).filter(Boolean).length,total:Object.keys(matrix).length,digest:fnv1a(stableStringify(matrix)),note:"Feature availability only; no cross-browser test has been run."};
}
/**
 * Exercises context loss/restoration only on a disposable canvas created for this
 * test. The primary diagnostics canvas is never affected. Each wait is bounded.
 */
export async function contextLifecycleProbe(doc=globalThis.document, timeoutMs=1200) {
  if(!doc?.createElement)return {available:false,extensionSupported:false,lostEvent:false,restoredEvent:false,reason:"document unavailable"};
  let gl;
  try{
    const canvas=doc.createElement("canvas");
    gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    if(!gl)return {available:false,extensionSupported:false,lostEvent:false,restoredEvent:false,reason:"WebGL unavailable"};
    const extension=gl.getExtension("WEBGL_lose_context");
    if(!extension)return {available:false,extensionSupported:false,lostEvent:false,restoredEvent:false,reason:"WEBGL_lose_context extension unavailable"};
    const waitFor=(eventName)=>new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;canvas.removeEventListener(eventName,onEvent);clearTimeout(timer);resolve(value)};
      const onEvent=event=>{if(eventName==="webglcontextlost")event.preventDefault?.();finish(true)};
      const timer=setTimeout(()=>finish(false),Math.max(100,Math.min(2000,timeoutMs)));
      canvas.addEventListener(eventName,onEvent,{once:true});
    });
    const lost=waitFor("webglcontextlost");
    extension.loseContext();
    const lostEvent=await lost;
    if(!lostEvent)return {available:false,extensionSupported:true,lostEvent:false,restoredEvent:false,reason:"Context-lost event timed out"};
    const restored=waitFor("webglcontextrestored");
    extension.restoreContext();
    const restoredEvent=await restored;
    return {available:lostEvent&&restoredEvent,extensionSupported:true,lostEvent,restoredEvent,contextLostAfterRestore:gl.isContextLost(),reason:restoredEvent?null:"Context-restored event timed out"};
  }catch(error){return {available:false,extensionSupported:Boolean(gl),lostEvent:false,restoredEvent:false,reason:error instanceof Error?error.message:"Context lifecycle test failed"}}
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
  const environment = collectEnvironment(), canvas = canvasProbe(), webgl = webglProbe(), gpuRendering = webglRenderingProbe(), audio = await audioProbe(), benchmark = benchmarkProbe(), compatibility = compatibilityProbe(), contextLifecycle = await contextLifecycleProbe();
  const results = { canvas: { digest: canvas.digest, available: canvas.available, reason: canvas.reason ?? null }, webgl: { digest: fnv1a(stableStringify(webgl)), available: webgl.available, reason: webgl.reason ?? null },
    audio: { digest: audio.digest, available: audio.available, reason: audio.reason ?? null }, environment: { digest: fnv1a(stableStringify(environment)), available: true }, benchmark: { digest: benchmark.digest, available: benchmark.available }, gpuRendering: { digest: fnv1a(stableStringify(gpuRendering)), available: gpuRendering.available, reason: gpuRendering.reason ?? null }, compatibility: { digest: compatibility.digest, available: true }, contextLifecycle: { digest: fnv1a(stableStringify(contextLifecycle)), available: contextLifecycle.available, reason: contextLifecycle.reason ?? null } };
  return { schemaVersion: 3, id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), timestamp: new Date().toISOString(), environment, probes: { canvas, webgl, audio, benchmark, gpuRendering, compatibility, contextLifecycle }, results };
}


/** Structural validation for imported snapshots; not an authenticity check. */
export function validateSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3) return false;
  if (typeof value.id !== "string" || value.id.length < 1 || value.id.length > 128) return false;
  if (typeof value.timestamp !== "string" || !Number.isFinite(Date.parse(value.timestamp))) return false;
  if (!value.environment || typeof value.environment !== "object" || Array.isArray(value.environment)) return false;
  if (!value.probes || typeof value.probes !== "object" || Array.isArray(value.probes)) return false;
  if (!value.results || typeof value.results !== "object" || Array.isArray(value.results)) return false;
  const allowed = new Set(value.schemaVersion === 1 ? ["canvas", "webgl", "audio", "environment"] : value.schemaVersion === 2 ? ["canvas", "webgl", "audio", "environment", "benchmark"] : ["canvas", "webgl", "audio", "environment", "benchmark", "gpuRendering", "compatibility", "contextLifecycle"]);
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
