import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSources } from "../src/pipeline.js";
import { collectSourceFiles, parseGithubUrl, UserInputError } from "../src/github.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, "fixtures", "sample-repo");

async function fixtureCopy() {
  const dir = await mkdtemp(path.join(tmpdir(), "tdr-test-"));
  await cp(FIXTURE, dir, { recursive: true });
  // node_modules se crea aquí (no en el repo, que lo ignora en git)
  await mkdir(path.join(dir, "node_modules", "lib"), { recursive: true });
  await writeFile(path.join(dir, "node_modules", "lib", "index.js"), "function x(){ if (a) {} }");
  return dir;
}

test("parseGithubUrl acepta los formatos comunes", () => {
  for (const u of ["https://github.com/pallets/flask", "github.com/pallets/flask/", "pallets/flask", "https://github.com/pallets/flask.git", "git@github.com:pallets/flask.git", "http://www.github.com/pallets/flask?tab=readme"]) {
    const p = parseGithubUrl(u);
    assert.equal(p.slug, "pallets/flask", u);
    assert.equal(p.cloneUrl, "https://github.com/pallets/flask.git");
    assert.equal(p.branch, null);
  }
  assert.equal(parseGithubUrl("github.com/a/b/tree/dev").branch, "dev");
});

test("parseGithubUrl rechaza entradas inválidas o peligrosas", () => {
  for (const u of ["", "   ", "gitlab.com/a/b", "github.com/solo-usuario", "https://evil.com/github.com/a/b", "github.com/a/..", "github.com/-a/b", "github.com/a/b;rm -rf", "github.com/a/b/tree/x y", null, 42]) {
    assert.throws(() => parseGithubUrl(u), UserInputError, String(u));
  }
});

test("collectSourceFiles aplica exclusiones (node_modules, minificados, pruebas)", async () => {
  const dir = await fixtureCopy();
  try {
    const { files, skipped } = await collectSourceFiles(dir);
    assert.deepEqual(files.map((f) => f.path).sort(), ["app/customers.py", "app/orders.py", "web/cart.js", "web/util.ts"]);
    assert.ok(skipped.excluded >= 2); // node_modules + vendor.min.js
    assert.equal(skipped.tests, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pipeline completo sobre el repositorio de prueba (evaluador heurístico)", async () => {
  const dir = await fixtureCopy();
  try {
    const { files } = await collectSourceFiles(dir);
    const steps = [];
    const r = await analyzeSources({ slug: "prueba/sample", files, readme: "x" }, { topN: 10, onProgress: (s) => steps.push(s) });
    assert.deepEqual([...new Set(steps)], ["metricas", "llm", "priorizacion"]);
    assert.equal(r.summary.filesAnalyzed, 4);
    assert.equal(r.summary.filesWithErrors, 0);
    assert.equal(r.summary.provider, "heuristica");
    assert.ok(r.findings.length >= 3);
    // orders.py tiene la mayor complejidad, 2 SATD (incluye FIXME) y duplicación → primero
    assert.equal(r.findings[0].path, "app/orders.py");
    assert.deepEqual(r.findings.map((f) => f.rank), r.findings.map((_, i) => i + 1));
    for (let i = 1; i < r.findings.length; i++) assert.ok(r.findings[i - 1].score >= r.findings[i].score);
    for (const f of r.findings) {
      const recomputed = f.scoreParts.cc + f.scoreParts.satd + f.scoreParts.dup + f.scoreParts.llm;
      assert.ok(Math.abs(recomputed - f.score) < 0.06, `desglose consistente para ${f.path}`);
      assert.ok(f.llm.explicacion.length > 20);
      assert.ok(["ALTA", "MEDIA", "BAJA"].includes(f.level));
    }
    // util.ts no tiene señales (CC 5, sin SATD ni duplicación): no debe aparecer
    assert.ok(!r.findings.some((f) => f.path === "web/util.ts"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("si el LLM falla en un archivo, se usa el respaldo heurístico y se reporta el error", async () => {
  const dir = await fixtureCopy();
  try {
    const { files } = await collectSourceFiles(dir);
    let calls = 0;
    const flaky = {
      name: "anthropic",
      async assess({ file }) {
        calls++;
        if (file.path === "app/orders.py") throw new Error("timeout simulado");
        return { senales: ["s"], explicacion: "Explicación del modelo falso.", severidad: 2, sugerencia: "x", resumen: "r", provider: "anthropic", model: "falso", usage: null };
      },
    };
    const r = await analyzeSources({ slug: "prueba/sample", files }, { provider: flaky, topN: 10 });
    assert.equal(calls, r.findings.length);
    const orders = r.findings.find((f) => f.path === "app/orders.py");
    assert.equal(orders.llm.provider, "heuristica");
    assert.match(orders.llm.error, /timeout simulado/);
    assert.equal(r.summary.llmErrors, 1);
    assert.ok(r.findings.filter((f) => f.path !== "app/orders.py").every((f) => f.llm.provider === "anthropic"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("repositorio sin archivos soportados devuelve un resultado vacío sin fallar", async () => {
  const r = await analyzeSources({ slug: "x/y", files: [] });
  assert.equal(r.findings.length, 0);
  assert.equal(r.summary.filesAnalyzed, 0);
});
