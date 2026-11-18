/**
 * Orquestación del flujo completo (Imagen "flujo de datos" del documento):
 *   URL → validación → clonación → recorrido de archivos → métricas estáticas
 *   → normalización → selección top-N → LLM → priorización → resultado.
 */
import { parseGithubUrl, cloneRepo, collectSourceFiles, readReadme } from "./github.js";
import { analyzeFiles } from "./metrics/index.js";
import { normalizeRepo, selectTopN, finalScore, levelOf, rankFindings, DEFAULT_WEIGHTS } from "./prioritization.js";
import { HeuristicProvider } from "./llm.js";

export const DEFAULT_TOP_N = Number(process.env.TDR_TOP_N || 10);
const LLM_CONCURRENCY = 4;

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Analiza un conjunto de archivos ya leídos (sin red). Lo usan el pipeline completo y las pruebas.
 * @param {{slug:string, files:{path:string,source:string}[], readme?:string}} repoInput
 */
export async function analyzeSources(repoInput, { provider, topN = DEFAULT_TOP_N, weights = DEFAULT_WEIGHTS, onProgress = () => {} } = {}) {
  provider = provider || new HeuristicProvider();
  const fallback = new HeuristicProvider();
  const sourceByPath = new Map(repoInput.files.map((f) => [f.path, f.source]));

  onProgress("metricas", `Calculando métricas de ${repoInput.files.length} archivos`);
  const { files, errors } = analyzeFiles(repoInput.files);
  if (!files.length) {
    return { summary: buildSummary(repoInput, files, errors, [], provider), findings: [], fileMetrics: [] };
  }
  const normalized = normalizeRepo(files);
  const selected = selectTopN(normalized, topN);
  const languages = [...new Set(files.map((f) => f.language))];
  const repoCtx = { slug: repoInput.slug, fileCount: files.length, languages, readme: repoInput.readme || "" };

  onProgress("llm", `Consultando al ${provider.name === "anthropic" ? "LLM" : "evaluador heurístico"} para ${selected.length} archivos`);
  let done = 0;
  const assessments = await mapLimit(selected, provider.name === "anthropic" ? LLM_CONCURRENCY : 16, async (file) => {
    const input = { repo: repoCtx, file, source: sourceByPath.get(file.path) };
    let a;
    try {
      a = await provider.assess(input);
    } catch (err) {
      a = await fallback.assess(input);
      a.error = String(err?.message || err);
    }
    done++;
    onProgress("llm", `Evaluados ${done}/${selected.length} archivos`);
    return a;
  });

  onProgress("priorizacion", "Calculando score de prioridad");
  const findings = rankFindings(
    selected.map((file, i) => {
      const a = assessments[i];
      const { score, parts } = finalScore(file.norm, a.severidad, weights);
      return {
        id: i + 1,
        path: file.path,
        language: file.language,
        score,
        level: levelOf(score),
        severity: a.severidad,
        scoreParts: parts,
        norm: roundAll(file.norm),
        metrics: file.metrics,
        details: file.details,
        llm: {
          provider: a.provider,
          model: a.model,
          senales: a.senales,
          explicacion: a.explicacion,
          sugerencia: a.sugerencia,
          resumen: a.resumen,
          usage: a.usage,
          error: a.error || null,
        },
        status: "pendiente",
      };
    }),
  );

  const fileMetrics = normalized
    .map((f) => ({ path: f.path, language: f.language, metrics: f.metrics, norm: roundAll(f.norm) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return { summary: buildSummary(repoInput, files, errors, findings, provider, weights), findings, fileMetrics };
}

function roundAll(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

function buildSummary(repoInput, files, errors, findings, provider, weights = DEFAULT_WEIGHTS) {
  const byLevel = { ALTA: 0, MEDIA: 0, BAJA: 0 };
  for (const f of findings) byLevel[f.level]++;
  const providers = [...new Set(findings.map((f) => f.llm.provider))];
  return {
    filesAnalyzed: files.length,
    filesWithErrors: errors.length,
    errors: errors.slice(0, 20),
    languages: [...new Set(files.map((f) => f.language))],
    totalLoc: files.reduce((s, f) => s + f.metrics.loc, 0),
    totalSatd: files.reduce((s, f) => s + f.metrics.satd, 0),
    findings: findings.length,
    byLevel,
    level: findings[0] ? findings[0].level : "BAJA",
    provider: provider.name,
    providersUsed: providers,
    llmErrors: findings.filter((f) => f.llm.error).length,
    model: findings.find((f) => f.llm.model)?.llm.model || null,
    weights,
  };
}

/** Pipeline completo a partir de una URL de GitHub. */
export async function analyzeRepository(url, { provider, topN, onProgress = () => {} } = {}) {
  const parsed = parseGithubUrl(url);
  onProgress("clonando", `Clonando ${parsed.slug}`);
  const started = Date.now();
  const { dir, commit, branch, cleanup } = await cloneRepo(parsed);
  try {
    onProgress("leyendo", "Leyendo archivos .py / .js / .ts");
    const { files, skipped } = await collectSourceFiles(dir);
    const readme = await readReadme(dir);
    const result = await analyzeSources({ slug: parsed.slug, files, readme }, { provider, topN, onProgress });
    // Guardamos las fuentes de los archivos priorizados para "Ver código fuente"
    const wanted = new Set(result.findings.map((f) => f.path));
    const sources = Object.fromEntries(files.filter((f) => wanted.has(f.path)).map((f) => [f.path, f.source]));
    return {
      repo: { slug: parsed.slug, url: `https://github.com/${parsed.slug}`, branch, commit },
      ...result,
      summary: { ...result.summary, skipped, durationMs: Date.now() - started },
      sources,
    };
  } finally {
    await cleanup();
  }
}
