#!/usr/bin/env node
/**
 * Calcula los objetivos 2 y 3 a partir de las plantillas YA LLENADAS por el equipo.
 *
 * Uso: npm run spearman -- ../eval/anthropic
 *   - ratings-template.csv: Likert 1-5 de claridad y relevancia por dos evaluadores.
 *       Objetivo 2: % de hallazgos "claros y relevantes" (promedio >= 4) y promedio general.
 *   - ranking-template.csv: columna orden_manual llena (1 = más urgente) por repositorio.
 *       Objetivo 3: correlación de rangos de Spearman (por repo y promedio) y % de pares
 *       concordantes entre el orden manual y el del sistema.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: npm run spearman -- <carpeta de evaluación, p. ej. ../eval/anthropic>");
  process.exit(1);
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
export function spearman(a, b) {
  const ra = ranks(a), rb = ranks(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
export function concordantPairs(a, b) {
  let c = 0, t = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    t++;
    if (Math.sign(a[i] - a[j]) === Math.sign(b[i] - b[j])) c++;
  }
  return t ? c / t : 0;
}

const report = { dir, objective2: null, objective3: null };

try {
  const rows = parseCsv(await readFile(path.join(dir, "ratings-template.csv"), "utf8"));
  const data = rows.slice(1).map((r) => r.slice(6, 10).map(Number)).filter((v) => v.every((x) => x >= 1 && x <= 5));
  if (data.length) {
    const perFinding = data.map((v) => v.reduce((s, x) => s + x, 0) / 4);
    const good = perFinding.filter((x) => x >= 4).length;
    const mean = perFinding.reduce((s, x) => s + x, 0) / perFinding.length;
    // Acuerdo entre evaluadores: correlación de Spearman entre sus promedios por hallazgo
    const e1 = data.map((v) => (v[0] + v[1]) / 2), e2 = data.map((v) => (v[2] + v[3]) / 2);
    report.objective2 = {
      hallazgosCalificados: data.length,
      pctClarosYRelevantes: +(100 * good / data.length).toFixed(1),
      promedioLikert: +mean.toFixed(2),
      acuerdoEntreEvaluadoresSpearman: +spearman(e1, e2).toFixed(3),
      cumple: data.length >= 20 && good / data.length >= 0.7 && mean >= 4,
    };
  } else report.objective2 = "ratings-template.csv todavía no tiene calificaciones (columnas 7-10 con valores 1-5).";
} catch (err) {
  report.objective2 = `No se pudo leer ratings-template.csv: ${err.message}`;
}

try {
  const rows = parseCsv(await readFile(path.join(dir, "ranking-template.csv"), "utf8")).slice(1);
  const byRepo = new Map();
  for (const r of rows) {
    const manual = Number(r[3]), system = Number(r[4]);
    if (!manual || !system) continue;
    if (!byRepo.has(r[0])) byRepo.set(r[0], []);
    byRepo.get(r[0]).push([manual, system]);
  }
  if (byRepo.size) {
    const perRepo = [...byRepo].map(([repo, pairs]) => ({
      repo,
      n: pairs.length,
      spearman: +spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])).toFixed(3),
      paresConcordantesPct: +(100 * concordantPairs(pairs.map((p) => p[0]), pairs.map((p) => p[1]))).toFixed(1),
    }));
    const n = perRepo.reduce((s, r) => s + r.n, 0);
    const avgRho = perRepo.reduce((s, r) => s + r.spearman * r.n, 0) / n;
    const avgConc = perRepo.reduce((s, r) => s + r.paresConcordantesPct * r.n, 0) / n;
    report.objective3 = {
      archivos: n,
      porRepositorio: perRepo,
      spearmanPromedioPonderado: +avgRho.toFixed(3),
      paresConcordantesPct: +avgConc.toFixed(1),
      cumple: n >= 20 && avgRho >= 0.7,
    };
  } else report.objective3 = "ranking-template.csv todavía no tiene la columna orden_manual llena.";
} catch (err) {
  report.objective3 = `No se pudo leer ranking-template.csv: ${err.message}`;
}

await writeFile(path.join(dir, "human-eval.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
