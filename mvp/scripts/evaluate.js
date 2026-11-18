#!/usr/bin/env node
/**
 * Evaluación del Hito 3 sobre un conjunto fijo de repositorios públicos.
 *
 * Uso:  npm run evaluate                    (proveedor según credenciales: Claude o heurístico)
 *       npm run evaluate -- --llm heuristica
 *       npm run evaluate -- --repos pallets/flask,psf/requests
 *
 * Genera en eval/<proveedor>/:
 *   - <owner>__<repo>.json       resultado completo de cada análisis
 *   - summary.json / summary.md  métricas del objetivo 1 (cobertura sin errores) y tiempos
 *   - ratings-template.csv       20 hallazgos para calificar (objetivo 2, Likert 1-5, evaluación ciega)
 *   - ranking-template.csv       20 archivos de 3 repos para ordenar a mano (objetivo 3, Spearman)
 * Después de llenar las plantillas: npm run spearman -- eval/<proveedor>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRepository } from "../src/pipeline.js";
import { createProvider } from "../src/llm.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

export const EVAL_REPOS = [
  "pallets/flask", // Python, framework web
  "psf/requests", // Python, cliente HTTP
  "pallets/click", // Python, CLI
  "expressjs/express", // JavaScript, framework web
  "axios/axios", // JavaScript, cliente HTTP
  "sindresorhus/ky", // TypeScript, cliente HTTP
];
const RANKING_REPOS = ["psf/requests", "expressjs/express", "sindresorhus/ky"];

const repos = opt("repos") ? opt("repos").split(",") : EVAL_REPOS;
const provider = createProvider(opt("llm", process.env.TDR_LLM || "auto"));
const outDir = path.join(here, "..", "..", "eval", provider.name);
await mkdir(outDir, { recursive: true });

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const rows = [];
const all = [];

for (const slug of repos) {
  process.stderr.write(`\n== ${slug} (${provider.name})\n`);
  const t0 = Date.now();
  try {
    const r = await analyzeRepository(slug, { provider, topN: 10, onProgress: (s, m) => process.stderr.write(`  [${s}] ${m}\n`) });
    const { sources, ...rest } = r;
    await writeFile(path.join(outDir, `${slug.replace("/", "__")}.json`), JSON.stringify(rest, null, 2));
    const s = r.summary;
    const supported = s.filesAnalyzed + s.filesWithErrors;
    const tokens = r.findings.reduce((acc, f) => acc + (f.llm.usage?.input || 0) + (f.llm.usage?.output || 0), 0);
    rows.push({
      repo: slug, commit: r.repo.commit, ok: true, files: supported, analyzed: s.filesAnalyzed, metricErrors: s.filesWithErrors,
      coveragePct: supported ? +(100 * s.filesAnalyzed / supported).toFixed(1) : 100,
      loc: s.totalLoc, satd: s.totalSatd, findings: s.findings, byLevel: s.byLevel, llmErrors: s.llmErrors,
      seconds: +((Date.now() - t0) / 1000).toFixed(1), tokens,
      top3: r.findings.slice(0, 3).map((f) => `${f.path} (${f.score})`),
    });
    all.push(r);
  } catch (err) {
    rows.push({ repo: slug, ok: false, error: err.message, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
  }
}

const okRows = rows.filter((r) => r.ok);
const summary = {
  generatedAt: new Date().toISOString(),
  provider: provider.name,
  model: provider.model || null,
  repos: rows,
  objective1: {
    criterio: "Métricas sin error para el 100% de los archivos soportados de al menos 5 repositorios",
    reposAnalizados: okRows.length,
    archivosSoportados: okRows.reduce((s, r) => s + r.files, 0),
    archivosConError: okRows.reduce((s, r) => s + r.metricErrors, 0),
    cumple: okRows.length >= 5 && okRows.every((r) => r.metricErrors === 0),
  },
};
await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

const md = [
  `# Evaluación TechDebtRadar — ${provider.name}${provider.model ? ` (${provider.model})` : ""}`,
  "",
  `Generado: ${summary.generatedAt}`,
  "",
  "| Repositorio | Commit | Archivos | Errores de métricas | LOC | SATD | Hallazgos (A/M/B) | Fallos LLM | Tiempo (s) | Top 1 |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => r.ok
    ? `| ${r.repo} | ${r.commit} | ${r.files} | ${r.metricErrors} | ${r.loc} | ${r.satd} | ${r.findings} (${r.byLevel.ALTA}/${r.byLevel.MEDIA}/${r.byLevel.BAJA}) | ${r.llmErrors} | ${r.seconds} | ${r.top3[0] || "-"} |`
    : `| ${r.repo} | - | - | - | - | - | - | - | ${r.seconds} | ERROR: ${r.error} |`),
  "",
  `**Objetivo 1:** ${summary.objective1.archivosSoportados} archivos soportados en ${summary.objective1.reposAnalizados} repositorios, ${summary.objective1.archivosConError} con error → ${summary.objective1.cumple ? "CUMPLE" : "NO CUMPLE"}.`,
].join("\n");
await writeFile(path.join(outDir, "summary.md"), md + "\n");

// ---- Plantilla objetivo 2: 20 hallazgos (los 4 primeros de cada repo hasta completar 20), orden aleatorio fijo
const pool = all.flatMap((r) => r.findings.slice(0, 4).map((f) => ({ repo: r.repo.slug, commit: r.repo.commit, f })));
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const sample = pool.map((x) => [rand(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, 20);
const ratings = [
  ["id", "repo", "archivo", "enlace", "explicacion", "sugerencia", "claridad_eval1 (1-5)", "relevancia_eval1 (1-5)", "claridad_eval2 (1-5)", "relevancia_eval2 (1-5)", "comentarios"].map(csvCell).join(","),
  ...sample.map((x, i) => [i + 1, x.repo, x.f.path, `https://github.com/${x.repo}/blob/${x.commit}/${x.f.path}`, x.f.llm.explicacion, x.f.llm.sugerencia, "", "", "", "", ""].map(csvCell).join(",")),
];
await writeFile(path.join(outDir, "ratings-template.csv"), "﻿" + ratings.join("\n") + "\n");

// ---- Plantilla objetivo 3: archivos de 3 repos SIN mostrar el orden del sistema (evaluación ciega)
const rankRows = [["repo", "archivo", "enlace", "orden_manual (1 = más urgente, dentro del repo)", "orden_sistema (NO mirar antes de ordenar)"].map(csvCell).join(",")];
const perRepo = { "psf/requests": 7, "expressjs/express": 7, "sindresorhus/ky": 6 };
for (const r of all.filter((x) => RANKING_REPOS.includes(x.repo.slug))) {
  const items = r.findings.slice(0, perRepo[r.repo.slug]);
  const shuffled = items.map((f) => [rand(), f]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  for (const f of shuffled) rankRows.push([r.repo.slug, f.path, `https://github.com/${r.repo.slug}/blob/${r.repo.commit}/${f.path}`, "", f.rank].map(csvCell).join(","));
}
await writeFile(path.join(outDir, "ranking-template.csv"), "﻿" + rankRows.join("\n") + "\n");

console.log(md);
console.error(`\nResultados en ${path.relative(process.cwd(), outDir)}`);
