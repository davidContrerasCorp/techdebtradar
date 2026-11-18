/*
 * TechDebtRadar — interfaz del MVP (Hito 3).
 * Las 3 pantallas del prototipo del Hito 2, ahora conectadas al backend real
 * (src/server.js). Todo el contenido proviene de la API: no hay datos simulados.
 */

const STEPS = [
  ["clonando", "Clonar repositorio"],
  ["leyendo", "Leer archivos"],
  ["metricas", "Métricas estáticas"],
  ["llm", "Evaluación (LLM)"],
  ["priorizacion", "Priorizar"],
];

// Al volver con el botón "atrás", recargar para mostrar estados actualizados (resuelto/ignorado)
window.addEventListener("pageshow", (e) => { if (e.persisted) window.location.reload(); });

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function badgeHtml(nivel) {
  return `<span class="badge badge-${esc(nivel)}">Deuda ${esc(nivel)}</span>`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* sin cuerpo JSON */ }
  if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
  return body;
}

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "Hace unos segundos";
  if (s < 3600) return `Hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `Hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "Hace 1 día" : `Hace ${d} días`;
}

function providerLabel(provider, model) {
  if (provider === "anthropic") return `LLM: Claude${model ? ` (${model})` : ""}`;
  if (provider === "heuristica") return "Evaluador heurístico (sin LLM)";
  return provider || "";
}

async function initBanner() {
  const el = document.getElementById("mode-banner");
  if (!el) return null;
  if (location.protocol === "file:") {
    el.className = "mode-banner warn";
    el.innerHTML = "Abre la app desde el servidor: ejecuta <code>npm start</code> en la carpeta <code>mvp/</code> y entra a <code>http://localhost:3000</code>.";
    return null;
  }
  try {
    const h = await api("/api/health");
    if (h.provider === "anthropic") {
      el.className = "mode-banner ok";
      el.textContent = `MVP conectado · Componente LLM activo: Claude (${h.model}).`;
    } else {
      el.className = "mode-banner warn";
      el.innerHTML = "MVP conectado · <strong>Sin credenciales de LLM</strong>: las explicaciones las genera un evaluador heurístico basado en reglas. Define <code>ANTHROPIC_API_KEY</code> y reinicia para usar Claude.";
    }
    return h;
  } catch {
    el.className = "mode-banner warn";
    el.textContent = "No se pudo contactar el servidor del MVP.";
    return null;
  }
}

// ---------- Pantalla 1: index.html ----------
function showHomeAlert(message) {
  const box = document.getElementById("home-alert");
  box.textContent = message;
  box.classList.add("show");
}

async function loadRecent() {
  const list = document.getElementById("recent-list");
  let items = [];
  try { items = await api("/api/analyses"); } catch { return; }
  document.getElementById("recent-empty").hidden = items.length > 0;
  list.innerHTML = items.map((r) => {
    const right = r.status === "listo" ? badgeHtml(r.level)
      : r.status === "error" ? `<span class="badge badge-ERROR">Error</span>`
      : `<span class="badge badge-PROGRESO">En progreso</span>`;
    const meta = [timeAgo(r.createdAt), r.status === "listo" ? `${r.findings} hallazgos` : null, r.provider ? providerLabel(r.provider) : null].filter(Boolean).join(" · ");
    return `<li class="recent-item" data-id="${esc(r.id)}">
        <div><div class="repo-name">${esc(r.repo.slug)}</div><div class="repo-meta">${esc(meta)}</div></div>
        <div class="repo-right">${right}</div>
      </li>`;
  }).join("");
  list.querySelectorAll(".recent-item").forEach((el) => {
    el.addEventListener("click", () => { window.location.href = `resultados.html?id=${encodeURIComponent(el.dataset.id)}`; });
  });
}

function initHomeScreen() {
  initBanner();
  loadRecent();

  document.querySelectorAll("[data-example]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("repo-url").value = a.dataset.example;
    document.getElementById("home-alert").classList.remove("show");
  }));
  document.getElementById("help-link").addEventListener("click", (e) => {
    e.preventDefault();
    showHomeAlert("Pega la URL de un repositorio público de GitHub y presiona Analizar. TechDebtRadar calcula complejidad, " +
      "comentarios TODO/FIXME y duplicación, pide a un LLM que explique los archivos más sospechosos, y te muestra una lista " +
      "ordenada por prioridad de refactorización.");
  });

  document.getElementById("analyze-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("repo-url").value.trim();
    if (!url) return showHomeAlert("Pega una URL de GitHub antes de presionar Analizar.");
    const btn = document.getElementById("analyze-btn");
    btn.disabled = true;
    btn.textContent = "Iniciando…";
    try {
      const out = await api("/api/analyses", { method: "POST", body: JSON.stringify({ url, force: document.getElementById("force").checked }) });
      window.location.href = `resultados.html?id=${encodeURIComponent(out.id)}${out.reused ? "&reused=1" : ""}`;
    } catch (err) {
      showHomeAlert(err.message);
      btn.disabled = false;
      btn.textContent = "Analizar";
    }
  });
}

// ---------- Pantalla 2: resultados.html ----------
function renderProgress(rec) {
  document.getElementById("progress-repo").textContent = rec.repo?.slug || "";
  const current = rec.progress?.step;
  const idx = STEPS.findIndex(([k]) => k === current);
  document.getElementById("progress-steps").innerHTML = STEPS.map(([k, label], i) => {
    const cls = i < idx ? "done" : i === idx ? "active" : "";
    return `<div class="step ${cls}"><span class="dot"></span>${esc(label)}</div>`;
  }).join("");
  document.getElementById("progress-message").textContent = rec.progress?.message || "";
}

function renderResults(rec) {
  document.getElementById("progress-panel").hidden = true;
  document.getElementById("results-panel").hidden = false;
  const s = rec.summary;
  const reused = qs("reused") ? ` · <a href="#" id="reanalyze">volver a analizar</a>` : "";
  document.getElementById("summary-row").innerHTML = `
    <div class="summary-item"><strong>${s.filesAnalyzed}</strong> archivos analizados</div>
    <div class="summary-item"><strong>${s.totalLoc.toLocaleString("es")}</strong> líneas de código</div>
    <div class="summary-item"><strong>${s.totalSatd}</strong> comentarios SATD</div>
    <div class="summary-item">${badgeHtml(s.level)}</div>
    <div class="summary-meta">${esc(rec.repo.slug)} @ ${esc(rec.repo.branch || "")} <code>${esc(rec.repo.commit || "")}</code> ·
      ${esc(providerLabel(s.provider, s.model))} · ${timeAgo(rec.createdAt).toLowerCase()}${reused}
      ${s.llmErrors ? `<br><span class="warn-text">${s.llmErrors} archivo(s) usaron el evaluador heurístico porque la llamada al LLM falló.</span>` : ""}
    </div>`;
  const again = document.getElementById("reanalyze");
  if (again) again.addEventListener("click", async (e) => {
    e.preventDefault();
    const out = await api("/api/analyses", { method: "POST", body: JSON.stringify({ url: rec.repo.url, force: true }) });
    window.location.href = `resultados.html?id=${encodeURIComponent(out.id)}`;
  });

  document.getElementById("results-empty").hidden = rec.findings.length > 0;
  const list = document.getElementById("finding-list");
  list.innerHTML = rec.findings.map((f) => `
    <li class="finding-item status-${esc(f.status)}" data-id="${f.id}">
      <div class="finding-rank">${f.rank}</div>
      <div class="finding-body">
        <div class="finding-file">${esc(f.path)} ${f.status !== "pendiente" ? `<span class="status-pill">${esc(f.status)}</span>` : ""}</div>
        <div class="finding-reason">${esc(f.llm.resumen)}</div>
      </div>
      <div class="finding-level">${badgeHtml(f.level)}</div>
      <div class="finding-score">
        <div class="score-value">${f.score.toFixed(1)}</div>
        <div class="score-label">Score</div>
      </div>
    </li>`).join("");
  list.querySelectorAll(".finding-item").forEach((el) => {
    el.addEventListener("click", () => { window.location.href = `detalle.html?id=${encodeURIComponent(rec.id)}&f=${el.dataset.id}`; });
  });
}

function renderError(rec) {
  document.getElementById("progress-panel").hidden = true;
  document.getElementById("error-panel").hidden = false;
  document.getElementById("error-message").textContent = rec.error || "Error desconocido";
}

async function initResultsScreen() {
  initBanner();
  const id = qs("id");
  if (!id) { window.location.href = "index.html"; return; }
  const poll = async () => {
    let rec;
    try { rec = await api(`/api/analyses/${encodeURIComponent(id)}`); } catch (err) {
      return renderError({ error: err.message });
    }
    document.getElementById("repo-breadcrumb-name").textContent = rec.repo?.slug || "";
    if (rec.status === "listo") return renderResults(rec);
    if (rec.status === "error") return renderError(rec);
    renderProgress(rec);
    setTimeout(poll, 1000);
  };
  poll();
}

// ---------- Pantalla 3: detalle.html ----------
async function initDetailScreen() {
  initBanner();
  const id = qs("id");
  const fid = qs("f");
  document.getElementById("back-link").href = `resultados.html?id=${encodeURIComponent(id || "")}`;
  let rec;
  try { rec = await api(`/api/analyses/${encodeURIComponent(id)}`); } catch (err) {
    document.getElementById("detail-error").hidden = false;
    document.getElementById("detail-error-msg").textContent = err.message;
    return;
  }
  const f = rec.findings?.find((x) => String(x.id) === String(fid));
  if (!f) {
    document.getElementById("detail-error").hidden = false;
    document.getElementById("detail-error-msg").textContent = "Hallazgo no encontrado.";
    return;
  }
  document.getElementById("detail-panel").hidden = false;
  const m = f.metrics;
  const d = f.details;
  document.getElementById("detail-file").textContent = f.path;
  document.getElementById("detail-score").innerHTML = `#${f.rank} · Score ${f.score.toFixed(1)} ${badgeHtml(f.level)}`;
  const setStatus = (st) => {
    document.getElementById("detail-status").innerHTML = `Estado: <strong>${esc(st)}</strong> · Severidad del evaluador: <strong>${f.severity}/5</strong>`;
  };
  setStatus(f.status);
  document.getElementById("metric-cc").textContent = `${m.ccAvg} / ${m.ccMax}`;
  document.getElementById("metric-satd").textContent = m.satd;
  document.getElementById("metric-dup").textContent = `${m.dupPct}%`;
  document.getElementById("metric-len").textContent = `${m.maxFunctionLength} líneas`;

  document.getElementById("explanation-source").textContent = `(${providerLabel(f.llm.provider, f.llm.model)})`;
  document.getElementById("detail-explanation").textContent = f.llm.explicacion;
  document.getElementById("detail-signals").innerHTML = f.llm.senales.map((s) => `<li>${esc(s)}</li>`).join("");
  document.getElementById("detail-suggestion").textContent = f.llm.sugerencia;
  if (f.llm.error) {
    document.getElementById("detail-explanation").insertAdjacentHTML("afterend",
      `<p class="warn-text">La llamada al LLM falló (${esc(f.llm.error)}); se usó el evaluador heurístico.</p>`);
  }

  const p = f.scoreParts;
  const n = f.norm;
  document.getElementById("detail-breakdown").innerHTML = `
    <table class="breakdown-table">
      <tr><th>Señal</th><th>Valor</th><th>Normalizado [0-10]</th><th>Peso</th><th>Aporte</th></tr>
      <tr><td>Complejidad (CC promedio)</td><td>${m.ccAvg}</td><td>${n.cc.toFixed(1)}</td><td>0.25</td><td>${p.cc.toFixed(2)}</td></tr>
      <tr><td>SATD</td><td>${m.satd}</td><td>${n.satd.toFixed(1)}</td><td>0.15</td><td>${p.satd.toFixed(2)}</td></tr>
      <tr><td>Duplicación</td><td>${m.dupPct}%</td><td>${n.dup.toFixed(1)}</td><td>0.20</td><td>${p.dup.toFixed(2)}</td></tr>
      <tr><td>Severidad del evaluador</td><td>${f.severity}/5</td><td>${(((f.severity - 1) / 4) * 10).toFixed(1)}</td><td>0.40</td><td>${p.llm.toFixed(2)}</td></tr>
      <tr class="total"><td colspan="4">Score</td><td>${f.score.toFixed(1)}</td></tr>
    </table>`;

  const ghBase = `${rec.repo.url}/blob/${rec.repo.commit || rec.repo.branch || "HEAD"}/${f.path}`;
  const ev = [];
  for (const fn of d.topComplexFunctions) ev.push(`<li>Función <a href="${esc(ghBase)}#L${fn.startLine}-L${fn.endLine}" target="_blank" rel="noopener"><code>${esc(fn.name)}</code></a>: CC=${fn.cc}, ${fn.length} líneas (L${fn.startLine}-${fn.endLine})</li>`);
  for (const fn of d.topLongFunctions.filter((x) => !d.topComplexFunctions.some((y) => y.startLine === x.startLine))) ev.push(`<li>Función larga <a href="${esc(ghBase)}#L${fn.startLine}-L${fn.endLine}" target="_blank" rel="noopener"><code>${esc(fn.name)}</code></a>: ${fn.length} líneas</li>`);
  for (const s of d.satd.slice(0, 8)) ev.push(`<li><a href="${esc(ghBase)}#L${s.line}" target="_blank" rel="noopener">L${s.line}</a> <strong>${esc(s.marker)}</strong>: ${esc(s.text)}</li>`);
  for (const b of (d.duplication?.blocks || []).slice(0, 5)) ev.push(`<li>Bloque duplicado L${b.fromLine}-${b.toLine} también presente en <code>${esc(b.other)}</code></li>`);
  document.getElementById("detail-evidence").innerHTML = ev.length ? `<ul>${ev.join("")}</ul>` : "<p class='hint'>Sin evidencia puntual adicional.</p>";

  document.getElementById("btn-github").href = ghBase;

  const updateStatus = async (status, msg) => {
    try {
      await api(`/api/analyses/${encodeURIComponent(rec.id)}/findings/${f.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      f.status = status;
      setStatus(status);
      showActionFeedback(msg);
    } catch (err) {
      showActionFeedback(`No se pudo guardar: ${err.message}`);
    }
  };
  document.getElementById("btn-resolved").addEventListener("click", () => updateStatus("resuelto", "Hallazgo marcado como resuelto (guardado en el servidor)."));
  document.getElementById("btn-ignore").addEventListener("click", () => updateStatus("ignorado", "Hallazgo marcado como ignorado (guardado en el servidor)."));

  let loaded = false;
  document.getElementById("btn-code").addEventListener("click", async () => {
    const box = document.getElementById("code-box");
    if (!loaded) {
      try {
        const out = await api(`/api/analyses/${encodeURIComponent(rec.id)}/source?path=${encodeURIComponent(f.path)}`);
        box.textContent = out.source.replace(/\r/g, "").split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n");
        loaded = true;
      } catch (err) {
        box.textContent = err.message;
      }
    }
    box.classList.toggle("show");
  });
}

function showActionFeedback(message) {
  const box = document.getElementById("action-feedback");
  box.textContent = message;
  box.classList.add("show");
}
