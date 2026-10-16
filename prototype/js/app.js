/*
 * TechDebtRadar — lógica de navegación del prototipo (Hito 2)
 * Toda la interacción es del lado del cliente (HTML/CSS/JS estático,
 * sin backend). No hay ninguna llamada de red real: analizar un
 * repositorio, calcular métricas o invocar un LLM NO está implementado
 * en este hito; aquí solo se simula el flujo de navegación y se muestra
 * contenido de ejemplo escrito a mano (ver js/data.js).
 */

function badgeHtml(nivel) {
  return `<span class="badge badge-${nivel}">Deuda ${nivel}</span>`;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ---------- Pantalla 1: index.html ----------
function initHomeScreen() {
  const list = document.getElementById("recent-list");
  if (list) {
    list.innerHTML = RECENT_ANALYSES.map((r) => `
      <li class="recent-item" data-key="${r.key}" data-disponible="${r.disponible}">
        <div>
          <div class="repo-name">${r.nombre}</div>
          <div class="repo-meta">${r.hace}</div>
        </div>
        <div class="repo-right">${badgeHtml(r.nivel)}</div>
      </li>`).join("");

    list.querySelectorAll(".recent-item").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.dataset.disponible === "true") {
          window.location.href = `resultados.html?repo=${encodeURIComponent(el.dataset.key)}`;
        } else {
          showHomeAlert(
            `"${el.dataset.key}" es un ejemplo del historial, pero este prototipo solo tiene ` +
            `datos de demostración completos para "mi-proyecto". Pega la URL de ejemplo de ` +
            `abajo y presiona Analizar para ver el flujo completo.`
          );
        }
      });
    });
  }

  const form = document.getElementById("analyze-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("repo-url").value.trim().replace(/\/+$/, "");
      const normalized = input.replace(/^https?:\/\//, "");
      if (normalized === DEMO_REPO_URL) {
        window.location.href = `resultados.html?repo=${DEMO_REPO_KEY}`;
      } else if (input.length === 0) {
        showHomeAlert("Pega una URL de GitHub antes de presionar Analizar.");
      } else {
        showHomeAlert(
          "Este prototipo del Hito 2 todavía no analiza repositorios reales (eso está " +
          "diseñado para el Hito 3, ver Sección 6 del documento). Para recorrer el flujo " +
          `completo con datos de ejemplo, usa la URL de demostración: "${DEMO_REPO_URL}".`
        );
      }
    });
  }
}

function showHomeAlert(message) {
  const alertBox = document.getElementById("home-alert");
  alertBox.textContent = message;
  alertBox.classList.add("show");
}

function fillDemoUrl() {
  document.getElementById("repo-url").value = DEMO_REPO_URL;
  document.getElementById("home-alert").classList.remove("show");
}

// ---------- Pantalla 2: resultados.html ----------
function initResultsScreen() {
  const repo = qs("repo") || DEMO_REPO_KEY;
  document.getElementById("repo-breadcrumb-name").textContent = repo;

  const list = document.getElementById("finding-list");
  list.innerHTML = FINDINGS.map((f, idx) => `
    <li class="finding-item" data-id="${f.id}">
      <div class="finding-rank">${idx + 1}</div>
      <div class="finding-body">
        <div class="finding-file">${f.archivo}</div>
        <div class="finding-reason">${f.resumen}</div>
      </div>
      <div class="finding-score">
        <div class="score-value">${f.score.toFixed(1)}</div>
        <div class="score-label">Score</div>
      </div>
    </li>`).join("");

  list.querySelectorAll(".finding-item").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = `detalle.html?id=${el.dataset.id}&repo=${encodeURIComponent(repo)}`;
    });
  });
}

// ---------- Pantalla 3: detalle.html ----------
function initDetailScreen() {
  const id = qs("id");
  const repo = qs("repo") || DEMO_REPO_KEY;
  const finding = getFindingById(id) || FINDINGS[0];

  document.getElementById("back-link").href = `resultados.html?repo=${encodeURIComponent(repo)}`;
  document.getElementById("detail-file").textContent = finding.archivo;
  document.getElementById("detail-score").innerHTML =
    `Score ${finding.score.toFixed(1)} ${badgeHtml(finding.nivel)}`;
  document.getElementById("detail-explanation").textContent = finding.explicacion;
  document.getElementById("detail-suggestion").textContent = finding.sugerencia;

  document.getElementById("metric-cc").textContent = finding.metricas.cc;
  document.getElementById("metric-satd").textContent = finding.metricas.satd;
  document.getElementById("metric-dup").textContent = finding.metricas.dup;

  document.getElementById("btn-resolved").addEventListener("click", () => {
    showActionFeedback(
      "Marcado como “resuelto” (solo en esta sesión del navegador). En el Hito 3, " +
      "esta acción actualizará el estado real del hallazgo en el backend."
    );
  });
  document.getElementById("btn-ignore").addEventListener("click", () => {
    showActionFeedback(
      "Marcado como “ignorado” (solo en esta sesión del navegador). Interacción " +
      "simulada, igual que “Marcar resuelto”."
    );
  });
  document.getElementById("btn-code").addEventListener("click", () => {
    const box = document.getElementById("code-box");
    box.textContent = finding.codigo;
    box.classList.toggle("show");
  });
}

function showActionFeedback(message) {
  const box = document.getElementById("action-feedback");
  box.textContent = message;
  box.classList.add("show");
}
