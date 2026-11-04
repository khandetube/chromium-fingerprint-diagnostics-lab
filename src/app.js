import { runDiagnostics, compareSnapshots } from "./diagnostics.js";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "diagnostics-lab:snapshots:v1";
let latest = null;
let busy = false;

function readHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function writeHistory(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 12))); }
function setStatus(module, state) {
  const el = $(module + "-status");
  el.textContent = state;
  el.className = "status-tag " + (state === "PASS" ? "success" : state === "UNAVAILABLE" ? "warning" : "");
}
function short(value, n = 16) {
  if (value == null) return "Unavailable";
  const text = String(value);
  return text.length > n ? text.slice(0, n) + "…" : text;
}
function renderHistory() {
  const items = readHistory();
  $("history-list").innerHTML = items.length ? items.map((item, i) =>
    '<button class="history-item" data-index="' + i + '"><span><strong>' + new Date(item.timestamp).toLocaleString() + '</strong><small>' + item.id.slice(0, 8) + ' · ' + Object.keys(item.results).length + ' modules</small></span><span>↗</span></button>'
  ).join("") : '<p class="empty-state">No saved snapshots yet.</p>';
  document.querySelectorAll(".history-item").forEach(button => button.addEventListener("click", () => {
    const item = readHistory()[Number(button.dataset.index)];
    if (item) showSnapshot(item);
  }));
}
function showSnapshot(snapshot) {
  latest = snapshot;
  $("ua-summary").textContent = short(snapshot.environment.userAgent, 35);
  $("platform-summary").textContent = snapshot.environment.platform;
  $("language-summary").textContent = snapshot.environment.language;
  $("cores-summary").textContent = snapshot.environment.hardwareConcurrency ?? "Not exposed";
  const mapping = { canvas: snapshot.probes.canvas, webgl: snapshot.probes.webgl, audio: snapshot.probes.audio, environment: snapshot.environment };
  for (const [key, data] of Object.entries(mapping)) {
    const result = snapshot.results[key];
    setStatus(key, result.available ? "PASS" : "UNAVAILABLE");
    $(key + "-result").textContent = short(result.digest ?? (key === "webgl" ? data.version : "Not available"));
  }
  const available = Object.values(snapshot.results).filter(x => x.available).length;
  $("overall-status").textContent = available + " / 4 modules available";
  $("run-summary").innerHTML = '<div class="summary-row"><span>Run ID</span><code>' + snapshot.id + '</code></div><div class="summary-row"><span>Timestamp</span><strong>' + new Date(snapshot.timestamp).toLocaleString() + '</strong></div><div class="summary-row"><span>Available probes</span><strong>' + available + ' of 4</strong></div><div class="summary-row"><span>Canvas digest</span><code>' + (snapshot.results.canvas.digest ?? "—") + '</code></div><div class="summary-row"><span>WebGL API</span><code>' + short(snapshot.probes.webgl.version ?? "Unavailable", 42) + '</code></div>';
  $("export-report").disabled = false;
}
async function run() {
  if (busy) return;
  busy = true;
  $("run-all").disabled = true;
  $("overall-status").textContent = "Running diagnostics…";
  try {
    const snapshot = await runDiagnostics();
    const history = readHistory();
    const previous = history[0];
    if (previous) snapshot.comparison = compareSnapshots(previous, snapshot);
    writeHistory([snapshot, ...history]);
    showSnapshot(snapshot);
    renderHistory();
  } catch (error) {
    $("overall-status").textContent = "Run failed";
    $("run-summary").textContent = "A diagnostic failed: " + error.message;
  } finally {
    busy = false;
    $("run-all").disabled = false;
  }
}
$("run-all").addEventListener("click", run);
$("export-report").addEventListener("click", () => {
  if (!latest) return;
  const blob = new Blob([JSON.stringify(latest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "diagnostics-" + latest.id.slice(0, 8) + ".json"; a.click();
  URL.revokeObjectURL(url);
});
$("clear-history").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY); renderHistory();
});
renderHistory();
