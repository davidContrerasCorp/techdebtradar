import { test } from "node:test";
import assert from "node:assert/strict";
import { minMax, rescaleSeverity, finalScore, levelOf, rankFindings, selectTopN, normalizeRepo, DEFAULT_WEIGHTS } from "../src/prioritization.js";

test("los pesos suman 1 y coinciden con el documento", () => {
  assert.deepEqual({ ...DEFAULT_WEIGHTS }, { cc: 0.25, satd: 0.15, dup: 0.2, llm: 0.4 });
  const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("normalización min-max a [0,10]", () => {
  assert.deepEqual(minMax([2, 4, 6]), [0, 5, 10]);
  assert.deepEqual(minMax([3, 3, 3]), [0, 0, 0]);
  assert.deepEqual(minMax([7]), [0]);
});

test("severidad 1-5 se reescala linealmente a [0,10] y se acota", () => {
  assert.equal(rescaleSeverity(1), 0);
  assert.equal(rescaleSeverity(3), 5);
  assert.equal(rescaleSeverity(5), 10);
  assert.equal(rescaleSeverity(9), 10);
  assert.equal(rescaleSeverity(0), 0);
});

test("fórmula de score con valores conocidos", () => {
  // 0.25*8 + 0.15*10 + 0.20*5 + 0.40*7.5 = 2 + 1.5 + 1 + 3 = 7.5
  const { score, parts } = finalScore({ cc: 8, satd: 10, dup: 5 }, 4);
  assert.equal(score, 7.5);
  assert.deepEqual(parts, { cc: 2, satd: 1.5, dup: 1, llm: 3 });
  assert.equal(finalScore({ cc: 10, satd: 10, dup: 10 }, 5).score, 10);
  assert.equal(finalScore({ cc: 0, satd: 0, dup: 0 }, 1).score, 0);
});

test("niveles ALTA / MEDIA / BAJA", () => {
  assert.equal(levelOf(9.2), "ALTA");
  assert.equal(levelOf(6.5), "ALTA");
  assert.equal(levelOf(5), "MEDIA");
  assert.equal(levelOf(3.9), "BAJA");
});

test("ranking ordena por score y desempata por severidad y ruta", () => {
  const r = rankFindings([
    { path: "b", score: 5, severity: 3 },
    { path: "a", score: 5, severity: 3 },
    { path: "c", score: 5, severity: 4 },
    { path: "d", score: 9, severity: 1 },
  ]);
  assert.deepEqual(r.map((f) => f.path), ["d", "c", "a", "b"]);
  assert.deepEqual(r.map((f) => f.rank), [1, 2, 3, 4]);
});

test("selección top-N descarta archivos sin señales y respeta N", () => {
  const mk = (path, ccMax, ccAvg, satd, dupPct, longFunctions = 0, maxFunctionLength = 10) =>
    ({ path, metrics: { ccMax, ccAvg, satd, dupPct, longFunctions, maxFunctionLength } });
  const files = normalizeRepo([
    mk("limpio.py", 2, 1.5, 0, 0),
    mk("complejo.py", 25, 9, 0, 0, 1, 120),
    mk("todos.py", 3, 2, 6, 0),
    mk("dup.py", 3, 2, 0, 40),
  ]);
  const top = selectTopN(files, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].path, "complejo.py");
  assert.ok(!selectTopN(files, 10).some((f) => f.path === "limpio.py"));
});
