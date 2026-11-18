#!/usr/bin/env node
/**
 * Uso: npm run analyze -- <url-github> [--top 10] [--json salida.json] [--llm anthropic|heuristica]
 * Analiza un repositorio desde la terminal e imprime la lista priorizada.
 */
import { writeFile } from "node:fs/promises";
import { analyzeRepository } from "../src/pipeline.js";
import { createProvider } from "../src/llm.js";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const url = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!url) {
  console.error("Uso: npm run analyze -- <url-github> [--top 10] [--json salida.json] [--llm anthropic|heuristica]");
  process.exit(1);
}

const provider = createProvider(opt("llm", process.env.TDR_LLM || "auto"));
let result;
try {
  result = await analyzeRepository(url, {
    provider,
    topN: Number(opt("top", 10)),
    onProgress: (step, msg) => console.error(`[${step}] ${msg}`),
  });
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(2);
}

const s = result.summary;
console.log(`\n${result.repo.slug} @ ${result.repo.branch} (${result.repo.commit})`);
console.log(`${s.filesAnalyzed} archivos · ${s.totalLoc} LOC · ${s.totalSatd} SATD · errores de métricas: ${s.filesWithErrors} · evaluador: ${s.providersUsed.join(", ")} · ${(s.durationMs / 1000).toFixed(1)} s\n`);
for (const f of result.findings) {
  const m = f.metrics;
  console.log(`${String(f.rank).padStart(2)}. ${f.score.toFixed(1).padStart(4)} ${f.level.padEnd(5)} sev=${f.severity} ${f.path}`);
  console.log(`      CCavg=${m.ccAvg} CCmax=${m.ccMax} SATD=${m.satd} DUP=${m.dupPct}% maxFn=${m.maxFunctionLength}L · ${f.llm.resumen}`);
  if (f.llm.error) console.log(`      (LLM falló, se usó heurística: ${f.llm.error})`);
}
const out = opt("json");
if (out) {
  const { sources, ...rest } = result;
  await writeFile(out, JSON.stringify(rest, null, 2));
  console.error(`\nResultado guardado en ${out}`);
}
