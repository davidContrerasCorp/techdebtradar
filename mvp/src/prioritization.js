/**
 * Selección de fragmentos y motor de priorización (Sección 6 del documento).
 *
 * Score(archivo) = w1·norm(CC) + w2·norm(SATD) + w3·norm(DUP) + w4·Sev_LLM
 *   - norm(): min-max a [0,10] DENTRO del repositorio analizado
 *   - Sev_LLM: severidad 1-5 del LLM reescalada linealmente a [0,10]
 *   - w = (0.25, 0.15, 0.20, 0.40)
 *
 * El cálculo es determinista y auditable: cada hallazgo guarda el desglose de
 * cuánto aportó cada término.
 */

export const DEFAULT_WEIGHTS = Object.freeze({ cc: 0.25, satd: 0.15, dup: 0.2, llm: 0.4 });

/** Normalización min-max a [0, 10]. Si todos los valores son iguales devuelve 0 para todos. */
export function minMax(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!isFinite(min) || max === min) return values.map(() => 0);
  return values.map((v) => ((v - min) / (max - min)) * 10);
}

/** Severidad 1-5 → [0,10]. */
export function rescaleSeverity(sev) {
  const s = Math.min(5, Math.max(1, Number(sev) || 1));
  return ((s - 1) / 4) * 10;
}

/** Calcula los valores normalizados de cada archivo del repositorio. */
export function normalizeRepo(files) {
  const cc = minMax(files.map((f) => f.metrics.ccAvg));
  const satd = minMax(files.map((f) => f.metrics.satd));
  const dup = minMax(files.map((f) => f.metrics.dupPct));
  const size = minMax(files.map((f) => f.metrics.maxFunctionLength));
  return files.map((f, i) => ({ ...f, norm: { cc: cc[i], satd: satd[i], dup: dup[i], size: size[i] } }));
}

/**
 * Pre-score SIN LLM, usado solo para elegir el top-N que se envía al modelo
 * (control de costo). Usa los mismos pesos estáticos re-escalados para que sumen 1,
 * más una señal de tamaño (funciones largas) que la fórmula final delega en el LLM.
 */
export function preScore(n, weights = DEFAULT_WEIGHTS) {
  const staticSum = weights.cc + weights.satd + weights.dup;
  const base = (weights.cc * n.cc + weights.satd * n.satd + weights.dup * n.dup) / staticSum;
  return 0.8 * base + 0.2 * n.size;
}

/** Archivos sin ninguna señal de deuda no se envían al LLM. */
export function hasAnySignal(f) {
  const m = f.metrics;
  return m.ccMax > 5 || m.satd > 0 || m.dupPct > 0 || m.longFunctions > 0;
}

export function selectTopN(normalizedFiles, n = 10) {
  return normalizedFiles
    .filter(hasAnySignal)
    .map((f) => ({ ...f, preScore: preScore(f.norm) }))
    .sort((a, b) => b.preScore - a.preScore || a.path.localeCompare(b.path))
    .slice(0, n);
}

export function finalScore(norm, severity, weights = DEFAULT_WEIGHTS) {
  const parts = {
    cc: weights.cc * norm.cc,
    satd: weights.satd * norm.satd,
    dup: weights.dup * norm.dup,
    llm: weights.llm * rescaleSeverity(severity),
  };
  const score = parts.cc + parts.satd + parts.dup + parts.llm;
  return { score: Math.round(score * 10) / 10, parts: mapValues(parts, (v) => Math.round(v * 100) / 100) };
}

export function levelOf(score) {
  if (score >= 6.5) return "ALTA";
  if (score >= 4) return "MEDIA";
  return "BAJA";
}

/** Ordena los hallazgos por score (desc). Empates: más severidad, luego ruta. */
export function rankFindings(findings) {
  return [...findings]
    .sort((a, b) => b.score - a.score || b.severity - a.severity || a.path.localeCompare(b.path))
    .map((f, i) => ({ ...f, rank: i + 1 }));
}

function mapValues(obj, fn) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}
