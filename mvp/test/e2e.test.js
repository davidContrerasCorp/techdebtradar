/**
 * Prueba de extremo a extremo con red: clona un repositorio público real.
 * Se ejecuta solo con TDR_E2E=1 (requiere git y acceso a github.com):
 *   PowerShell:  $env:TDR_E2E="1"; npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepository } from "../src/pipeline.js";
import { HeuristicProvider } from "../src/llm.js";

const enabled = process.env.TDR_E2E === "1";

test("analiza un repositorio público real de Python (pallets/itsdangerous)", { skip: !enabled && "define TDR_E2E=1", timeout: 180_000 }, async () => {
  const r = await analyzeRepository("https://github.com/pallets/itsdangerous", { provider: new HeuristicProvider(), topN: 5 });
  assert.equal(r.repo.slug, "pallets/itsdangerous");
  assert.match(r.repo.commit, /^[0-9a-f]{7,}$/);
  assert.ok(r.summary.filesAnalyzed > 3);
  assert.equal(r.summary.filesWithErrors, 0);
  assert.ok(r.findings.length > 0 && r.findings.length <= 5);
  assert.ok(r.findings.every((f) => r.sources[f.path]));
});

test("analiza un repositorio público real de JavaScript (expressjs/express)", { skip: !enabled && "define TDR_E2E=1", timeout: 180_000 }, async () => {
  const r = await analyzeRepository("github.com/expressjs/express", { provider: new HeuristicProvider(), topN: 5 });
  assert.ok(r.summary.languages.includes("javascript"));
  assert.equal(r.summary.filesWithErrors, 0);
  assert.ok(r.findings.length > 0);
});

test("repositorio inexistente produce un error claro", { skip: !enabled && "define TDR_E2E=1", timeout: 60_000 }, async () => {
  await assert.rejects(analyzeRepository("github.com/esto-no-existe-tdr/nada-12345"), /No se encontró/);
});
