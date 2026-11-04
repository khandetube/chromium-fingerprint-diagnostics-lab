import { runDiagnostics, compareSnapshots, validateSnapshot } from "./diagnostics.js";
const $ = id => document.getElementById(id);
const STORAGE_KEY = "diagnostics-lab:snapshots:v1";
let latest = null, busy = false, volatileHistory = [];
function readHistory() {
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(parsed) ? parsed.filter(x => x && typeof x === "object" && x.results && x.probes) : []; }
  catch { return [...volatileHistory]; }
}
function writeHistory(items) {
  const safe = items.slice(0, 12); volatileHistory = safe;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); return true; } catch { return false; }
}
function setStatus(module, state) {
  const el = $(module + "-status"); el.textContent = state;
  el.className = "status-tag " + (state === "PASS" ? "success" : state === "UNAVAILABLE" ? "warning" : "");
}
function short(value, n = 16) {
  if (value == null || value === "") return "Unavailable";
  const s = String(value); return s.length > n ? s.slice(0, n) + "…" : s;
}
function make(tag, className, text) {
  const el = document.createElement(tag); if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text); return el;
}
function renderHistory() {
  const host = $("history-list"); host.replaceChildren(); const items = readHistory();
  if (!items.length) { host.append(make("p", "empty-state", "No saved snapshots yet.")); return; }
  items.forEach((item, index) => {
    const button = make("button", "history-item"); button.type = "button"; button.dataset.index = String(index);
    const left = make("span");
    const parsedTime = Date.parse(item.timestamp);
    left.append(make("strong", "", Number.isFinite(parsedTime) ? new Date(parsedTime).toLocaleString() : "Unknown timestamp"));
    left.append(make("small", "", String(item.id ?? "unknown").slice(0, 8) + " · " + Object.keys(item.results ?? {}).length + " modules"));
    button.append(left, make("span", "", "↗"));
    button.addEventListener("click", () => { const selected = readHistory()[index]; if (selected) showSnapshot(selected); });
    host.append(button);
  });
}
function addSummaryRow(host, label, value, code = false) {
  const row = make("div", "summary-row"); row.append(make("span", "", label), make(code ? "code" : "strong", "", value ?? "—")); host.append(row);
}
function renderComparison(comparison) {
  const host = $("comparison-results"); if (!host) return; host.replaceChildren();
  if (!comparison?.length) { host.append(make("p", "empty-state", "Run diagnostics again after a saved snapshot to compare results.")); return; }
  host.append(make("p", "comparison-title", "Compared with the previous saved run"));
  comparison.forEach(item => {
    const row = make("div", "comparison-row"); row.append(make("span", "", item.module));
    row.append(make("strong", "comparison-state " + item.status, item.status.toUpperCase())); host.append(row);
  });
}
function showSnapshot(snapshot) {
  latest = snapshot; const env = snapshot.environment ?? {}, probes = snapshot.probes ?? {}, results = snapshot.results ?? {};
  $("ua-summary").textContent = short(env.userAgent, 35);
  $("platform-summary").textContent = env.platform ?? "Unavailable";
  $("language-summary").textContent = env.language ?? "Unavailable";
  $("cores-summary").textContent = env.hardwareConcurrency ?? "Not exposed";
  const mapping = { gpuRendering: probes.gpuRendering ?? {}, compatibility: probes.compatibility ?? {}, contextLifecycle: probes.contextLifecycle ?? {}, canvas: probes.canvas ?? {}, webgl: probes.webgl ?? {}, audio: probes.audio ?? {}, environment: env, benchmark: probes.benchmark ?? {} };
  for (const [key, data] of Object.entries(mapping)) {
    const result = results[key] ?? { available: false, digest: null };
    setStatus(key, result.available ? "PASS" : "UNAVAILABLE");
    const display = result.digest ?? (result.available ? (key === "webgl" ? data.version : key === "environment" ? Object.values(env.features ?? {}).filter(Boolean).length + " features" : "Not available") : (result.reason ?? "Not available"));
    $(key + "-result").textContent = short(display);
  }
  const available = Object.values(results).filter(x => x?.available).length, summary = $("run-summary");
  $("overall-status").textContent = available + " / " + Object.keys(results).length + " modules available"; summary.replaceChildren();
  addSummaryRow(summary, "Run ID", snapshot.id, true);
  addSummaryRow(summary, "Timestamp", Number.isFinite(Date.parse(snapshot.timestamp)) ? new Date(snapshot.timestamp).toLocaleString() : "Unknown");
  addSummaryRow(summary, "Available probes", available + " of " + Object.keys(results).length);
  addSummaryRow(summary, "Canvas digest", results.canvas?.digest, true);
  addSummaryRow(summary, "WebGL API", short(probes.webgl?.api + " · " + probes.webgl?.version, 42), true);
  addSummaryRow(summary, "Context lifecycle", probes.contextLifecycle ? (probes.contextLifecycle.lostEvent ? "lost" : "no loss") + " / " + (probes.contextLifecycle.restoredEvent ? "restored" : "not restored") : "Not tested");
  addSummaryRow(summary, "API compatibility", probes.compatibility ? probes.compatibility.supported + " / " + probes.compatibility.total + " available" : "Not tested");
  addSummaryRow(summary, "GPU draw/readback", probes.gpuRendering?.drawReadback === undefined ? "Not tested" : String(probes.gpuRendering.drawReadback));
  addSummaryRow(summary, "Context lost", probes.gpuRendering?.contextLost === null || probes.gpuRendering?.contextLost === undefined ? "Unknown" : String(probes.gpuRendering.contextLost));
  addSummaryRow(summary, "GLSL", probes.webgl?.shadingLanguage ?? "Unavailable", true);
  addSummaryRow(summary, "Supported extensions", probes.webgl?.extensionCount ?? 0);
  addSummaryRow(summary, "GPU texture limit", probes.webgl?.limits?.maxTextureSize ?? "Unavailable");
  addSummaryRow(summary, "MSAA samples", probes.webgl?.limits?.maxSamples ?? "Not exposed");
  addSummaryRow(summary, "Antialiasing", probes.webgl?.contextAttributes?.antialias === undefined ? "Unavailable" : String(probes.webgl.contextAttributes.antialias));
  if (probes.benchmark?.workloads) {
    for (const [name, result] of Object.entries(probes.benchmark.workloads)) {
      addSummaryRow(summary, "Benchmark · " + name, result.available ? result.medianMs + " ms median · " + result.operationsPerSecond + " ops/s" : result.reason);
    }
  }
  if (snapshot.storageWarning) summary.append(make("p", "storage-warning", "Browser storage is unavailable; this snapshot may not persist after refresh."));
  renderComparison(snapshot.comparison); $("export-report").disabled = false; $("export-csv").disabled = false; $("export-html").disabled = false;
}
async function run() {
  if (busy) return; busy = true; $("run-all").disabled = true; $("overall-status").textContent = "Running diagnostics…";
  try {
    const snapshot = await runDiagnostics(), history = readHistory();
    if (history[0]) snapshot.comparison = compareSnapshots(history[0], snapshot);
    if (!writeHistory([snapshot, ...history.filter(item => item.id !== snapshot.id)])) snapshot.storageWarning = true;
    showSnapshot(snapshot); renderHistory();
  } catch (error) {
    $("overall-status").textContent = "Run failed";
    $("run-summary").textContent = "A diagnostic failed: " + (error instanceof Error ? error.message : String(error));
  } finally { busy = false; $("run-all").disabled = false; }
}
$("run-all").addEventListener("click", run);

$("import-report").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 1024 * 1024) {
    $("overall-status").textContent = "Import rejected: file exceeds 1 MB";
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    if (!validateSnapshot(parsed)) throw new Error("Unsupported or malformed diagnostics snapshot");
    const history = readHistory();
    if (history[0]) parsed.comparison = compareSnapshots(history[0], parsed);
    const deduplicated = history.filter(item => item.id !== parsed.id);
    if (!writeHistory([parsed, ...deduplicated])) parsed.storageWarning = true;
    showSnapshot(parsed);
    renderHistory();
    $("overall-status").textContent = "Imported snapshot successfully";
  } catch (error) {
    $("overall-status").textContent = "Import failed: " + (error instanceof Error ? error.message : String(error));
  }
});

$("export-report").addEventListener("click", () => {
  if (!latest) return;
  const blob = new Blob([JSON.stringify(latest, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "diagnostics-" + String(latest.id ?? "snapshot").slice(0, 8) + ".json"; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});


function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function buildHtmlReport(snapshot) {
  const env = snapshot.environment ?? {}, results = snapshot.results ?? {}, probes = snapshot.probes ?? {};
  const rows = Object.entries(results).map(([name, result]) => `<tr><td>${escapeHtml(name)}</td><td>${result?.available ? "Available" : "Unavailable"}</td><td><code>${escapeHtml(result?.digest ?? "—")}</code></td><td>${escapeHtml(result?.reason ?? probes[name]?.reason ?? "—")}</td></tr>`).join("");
  const section = (title, value) => `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(JSON.stringify(value ?? {}, null, 2))}</pre></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser Diagnostics Evidence</title><style>
  :root{color-scheme:light;font:14px/1.55 system-ui,sans-serif;color:#172033;background:#f4f7fb}body{max-width:1100px;margin:36px auto;padding:0 20px}header,section,.notice{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:20px;margin:14px 0}h1{margin:0 0 8px}h2{font-size:17px;margin:0 0 12px}p,.muted{color:#53627a}.notice{border-left:4px solid #3176bb}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5eaf1;vertical-align:top}th{background:#f0f4fa}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8fb;padding:14px;border-radius:8px;font-size:12px}code{overflow-wrap:anywhere}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.meta div{background:#f5f7fb;padding:12px;border-radius:8px}@media print{body{margin:0;background:white}header,section,.notice{break-inside:avoid;box-shadow:none}}</style></head><body>
  <header><p class="muted">BROWSER OBSERVABILITY WORKBENCH · OFFLINE EVIDENCE</p><h1>Diagnostics evidence report</h1><div class="meta"><div><b>Snapshot</b><br>${escapeHtml(snapshot.id)}</div><div><b>Timestamp</b><br>${escapeHtml(snapshot.timestamp)}</div><div><b>Browser</b><br>${escapeHtml(env.userAgent ?? "Unavailable")}</div><div><b>Platform</b><br>${escapeHtml(env.platform ?? "Unavailable")}</div></div></header>
  <div class="notice"><b>Interpretation:</b> This report records browser-exposed diagnostic results for one session. It is not a unique device identifier, cryptographic attestation, browser certification, or proof of tampering. FNV-1a digests are non-cryptographic comparison checksums.</div>
  <section><h2>Module results</h2><table><thead><tr><th>Module</th><th>Status</th><th>Digest</th><th>Reason / notes</th></tr></thead><tbody>${rows}</tbody></table></section>
  ${section("Environment", env)}${section("Probe details", probes)}${section("Result metadata", results)}${section("Comparison with previous snapshot", snapshot.comparison ?? [])}
  <p class="muted">Generated locally by Chromium Fingerprint Diagnostics Lab. No telemetry or remote upload is performed by this report generator.</p></body></html>`;
}
$("export-html").addEventListener("click", () => {
  if (!latest) return;
  const blob = new Blob([buildHtmlReport(latest)], { type: "text/html;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "diagnostics-" + String(latest.id ?? "snapshot").slice(0, 8) + ".html";
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function csvCell(value) {
  const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}
$("export-csv").addEventListener("click", () => {
  if (!latest) return;
  const rows = [["snapshot_id", "timestamp", "module", "available", "digest", "reason"]];
  for (const [module, result] of Object.entries(latest.results ?? {})) {
    const probe = latest.probes?.[module] ?? {};
    rows.push([latest.id, latest.timestamp, module, result?.available ?? false, result?.digest ?? "", result?.reason ?? probe.reason ?? ""]);
  }
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "diagnostics-" + String(latest.id ?? "snapshot").slice(0, 8) + ".csv";
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("clear-history").addEventListener("click", () => {
  volatileHistory = []; try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be blocked by browser policy. */ } renderHistory();
});
renderHistory();
