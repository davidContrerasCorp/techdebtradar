/**
 * Calcula las métricas estáticas de un archivo y de un repositorio completo.
 */
import { strip, languageOf } from "./lexer.js";
import { functionsOf } from "./complexity.js";
import { findSatd } from "./satd.js";
import { computeDuplication } from "./duplication.js";

/** Umbrales usados para reportar señales (no afectan la fórmula de score). */
export const THRESHOLDS = {
  ccHighFunction: 10, // McCabe: > 10 = complejo, difícil de probar
  longFunctionLines: 50, // función "larga"
  longFileLines: 500, // archivo "largo"
};

function round1(x) {
  return Math.round(x * 10) / 10;
}

/** Métricas de un solo archivo (sin duplicación, que es inter-archivo). */
export function analyzeSource(path, source) {
  const language = languageOf(path);
  if (!language) throw new Error(`Lenguaje no soportado: ${path}`);
  const { code, comments } = strip(source, language);
  const lines = source.split("\n");
  const loc = lines.filter((l) => l.trim().length > 0).length;
  // Longitud de función = líneas de código no vacías (NLOC), sin comentarios ni docstrings
  const codeLines = code.split("\n");
  const nloc = (from, to) => {
    let n = 0;
    for (let i = from; i <= to && i <= codeLines.length; i++) if (codeLines[i - 1].trim()) n++;
    return n;
  };
  const functions = functionsOf(code, language).map((f) => ({
    ...f,
    length: nloc(f.startLine, f.endLine),
  }));
  const satd = findSatd(comments);

  const ccValues = functions.map((f) => f.cc);
  const ccAvg = ccValues.length ? ccValues.reduce((a, b) => a + b, 0) / ccValues.length : 1;
  const ccMax = ccValues.length ? Math.max(...ccValues) : 1;
  const longFunctions = functions
    .filter((f) => f.length > THRESHOLDS.longFunctionLines)
    .sort((a, b) => b.length - a.length);
  const complexFunctions = functions
    .filter((f) => f.cc > THRESHOLDS.ccHighFunction)
    .sort((a, b) => b.cc - a.cc);

  return {
    path,
    language,
    code, // código limpio (para duplicación); no se expone por la API
    metrics: {
      loc,
      totalLines: lines.length,
      functions: functions.length,
      ccAvg: round1(ccAvg),
      ccMax,
      satd: satd.length,
      longFunctions: longFunctions.length,
      maxFunctionLength: functions.length ? Math.max(...functions.map((f) => f.length)) : 0,
      maxNesting: functions.length ? Math.max(...functions.map((f) => f.nesting)) : 0,
      dupPct: 0,
    },
    details: {
      satd,
      topComplexFunctions: complexFunctions.slice(0, 5).map(pickFn),
      topLongFunctions: longFunctions.slice(0, 5).map(pickFn),
      functions: functions.map(pickFn),
      duplication: null,
    },
  };
}

function pickFn(f) {
  return { name: f.name, startLine: f.startLine, endLine: f.endLine, length: f.length, cc: f.cc, nesting: f.nesting };
}

/** Analiza una lista de { path, source } y agrega la duplicación entre archivos. */
export function analyzeFiles(files) {
  const analyzed = [];
  const errors = [];
  for (const f of files) {
    try {
      analyzed.push(analyzeSource(f.path, f.source));
    } catch (err) {
      errors.push({ path: f.path, error: String(err.message || err) });
    }
  }
  const dup = computeDuplication(analyzed.map((a) => ({ path: a.path, code: a.code })));
  for (const a of analyzed) {
    const d = dup.get(a.path);
    a.metrics.dupPct = d.pct;
    a.details.duplication = { duplicatedLines: d.duplicated, significantLines: d.significant, partners: d.partners.slice(0, 5), blocks: d.blocks };
    delete a.code;
  }
  return { files: analyzed, errors };
}
