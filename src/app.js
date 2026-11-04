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
  const mapping = { canvas: probes.canvas ?? {}, webgl: probes.webgl ?? {}, audio: probes.audio ?? {}, environment: env, benchmark: probes.benchmark ?? {} };
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
  addSummaryRow(summary, "Available probes", available + " of 4");
  addSummaryRow(summary, "Canvas digest", results.canvas?.digest, true);
  addSummaryRow(summary, "WebGL API", short(probes.webgl?.version, 42), true);
  if (probes.benchmark?.workloads) {
    for (const [name, result] of Object.entries(probes.benchmark.workloads)) {
      addSummaryRow(summary, "Benchmark · " + name, result.available ? result.medianMs + " ms median · " + result.operationsPerSecond + " ops/s" : result.reason);
    }
  }
  if (snapshot.storageWarning) summary.append(make("p", "storage-warning", "Browser storage is unavailable; this snapshot may not persist after refresh."));
  renderComparison(snapshot.comparison); $("export-report").disabled = false;
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
$("clear-history").addEventListener("click", () => {
  volatileHistory = []; try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be blocked by browser policy. */ } renderHistory();
});
renderHistory();
