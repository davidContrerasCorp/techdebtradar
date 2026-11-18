#!/usr/bin/env node
/**
 * Validación de la métrica de complejidad ciclomática de TechDebtRadar contra una
 * herramienta de referencia: la regla `complexity` de ESLint (parser real de JS/TS, AST).
 *
 * Uso: node scripts/validate-cc.js [repo1 repo2 ...]   (por defecto: express, ky, axios)
 * Salida: tabla por repositorio + eval/cc-validation.json
 *
 * Emparejamiento: ESLint reporta la línea de la cabecera de la función; TechDebtRadar, la
 * línea de la llave que abre el cuerpo. Se empareja cada función con la cabecera de ESLint
 * más cercana que esté en la misma línea o hasta 6 líneas antes (firmas multilínea), 1 a 1. Las funciones flecha de una sola
 * expresión (sin llaves) no las separa TechDebtRadar (se acumulan en la función que las
 * contiene), por eso se reporta también la cobertura del emparejamiento.
 *
 * Diferencias conocidas por diseño: ESLint 9 también suma valores por defecto de
 * parámetros (`a = 1`), encadenamiento opcional (`a?.b`) y asignaciones lógicas (`||=`);
 * TechDebtRadar sigue la definición clásica de McCabe (como radon/lizard) y no los cuenta.
 */
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloneRepo, collectSourceFiles, parseGithubUrl } from "../src/github.js";
import { analyzeSource } from "../src/metrics/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repos = process.argv.slice(2).length ? process.argv.slice(2) : ["expressjs/express", "sindresorhus/ky", "axios/axios"];

const linter = new Linter({ configType: "flat" });
const baseRules = { complexity: ["warn", { max: 0, variant: "classic" }] };
const configFor = (file) => {
  const ts = /\.(ts|tsx|mts|cts)$/.test(file);
  return [{
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: /\.cjs$/.test(file) ? "commonjs" : "module",
      ...(ts ? { parser: tseslint.parser } : {}),
      parserOptions: { ecmaFeatures: { jsx: /x$/.test(file) } },
    },
    rules: baseRules,
  }];
};

function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  return pearson(rank(xs), rank(ys));
}
function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

const results = [];
for (const slug of repos) {
  const parsed = parseGithubUrl(slug);
  process.stderr.write(`Clonando ${parsed.slug}...\n`);
  const { dir, commit, cleanup } = await cloneRepo(parsed);
  try {
    const { files } = await collectSourceFiles(dir);
    const jsFiles = files.filter((f) => /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(f.path));
    const pairs = [];
    let eslintFns = 0, tdrFns = 0, parseErrors = 0;
    for (const f of jsFiles) {
      const msgs = linter.verify(f.source, configFor(f.path), { filename: f.path });
      if (msgs.some((m) => m.fatal)) { parseErrors++; continue; }
      const ref = msgs
        .filter((m) => m.ruleId === "complexity")
        .map((m) => ({ endLine: m.endLine, cc: Number(/complexity of (\d+)/.exec(m.message)?.[1]) }));
      eslintFns += ref.length;
      const ours = analyzeSource(f.path, f.source).details.functions;
      tdrFns += ours.length;
      for (const o of ours) {
        let best = null;
        for (const r of ref) {
          if (r.used || r.line > o.startLine || o.startLine - r.line > 6) continue;
          if (!best || r.line > best.line || (r.line === best.line && Math.abs(r.cc - o.cc) < Math.abs(best.cc - o.cc))) best = r;
        }
        if (!best) continue;
        best.used = true;
        pairs.push({ file: f.path, name: o.name, line: o.startLine, ours: o.cc, eslint: best.cc });
      }
    }
    const exact = pairs.filter((p) => p.ours === p.eslint).length;
    const within1 = pairs.filter((p) => Math.abs(p.ours - p.eslint) <= 1).length;
    const mae = pairs.reduce((s, p) => s + Math.abs(p.ours - p.eslint), 0) / (pairs.length || 1);
    const highOurs = new Set(pairs.filter((p) => p.ours > 10).map((p) => `${p.file}:${p.line}`));
    const highRef = new Set(pairs.filter((p) => p.eslint > 10).map((p) => `${p.file}:${p.line}`));
    const both = [...highOurs].filter((k) => highRef.has(k)).length;
    const r = {
      repo: parsed.slug,
      commit,
      files: jsFiles.length,
      parseErrors,
      functionsEslint: eslintFns,
      functionsTdr: tdrFns,
      matched: pairs.length,
      exactPct: +(100 * exact / (pairs.length || 1)).toFixed(1),
      within1Pct: +(100 * within1 / (pairs.length || 1)).toFixed(1),
      mae: +mae.toFixed(2),
      spearman: +spearman(pairs.map((p) => p.ours), pairs.map((p) => p.eslint)).toFixed(3),
      highCcAgreement: { tdr: highOurs.size, eslint: highRef.size, both },
      largestDiffs: [...pairs].sort((a, b) => Math.abs(b.ours - b.eslint) - Math.abs(a.ours - a.eslint)).slice(0, 5),
    };
    results.push(r);
    console.log(`${r.repo.padEnd(22)} archivos=${r.files} errParse=${r.parseErrors} fn(ESLint)=${r.functionsEslint} emparejadas=${r.matched} exactas=${r.exactPct}% ±1=${r.within1Pct}% MAE=${r.mae} Spearman=${r.spearman} CC>10: TDR=${r.highCcAgreement.tdr} ESLint=${r.highCcAgreement.eslint} ambos=${r.highCcAgreement.both}`);
  } finally {
    await cleanup();
  }
}

const outDir = path.join(here, "..", "..", "eval");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "cc-validation.json"), JSON.stringify({ generatedAt: new Date().toISOString(), reference: "ESLint 9 complexity (classic)", results }, null, 2));
console.error(`\nGuardado en ${path.relative(process.cwd(), path.join(outDir, "cc-validation.json"))}`);
