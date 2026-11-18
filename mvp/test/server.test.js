import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/server.js";
import { AnalysisStore } from "../src/store.js";
import { HeuristicProvider } from "../src/llm.js";
import { analyzeSources } from "../src/pipeline.js";
import { UserInputError } from "../src/github.js";

let server, base, dataDir;

// Análisis falso: no clona nada, usa archivos en memoria (las pruebas de red están en e2e.test.js)
async function fakeAnalyze(url, { provider, onProgress }) {
  if (url.includes("no-existe")) throw new UserInputError("No se encontró el repositorio o no es público.");
  onProgress("clonando", "Clonando");
  await new Promise((r) => setTimeout(r, 50));
  const files = [
    { path: "a.py", source: "# TODO: x\ndef f(a):\n    if a and a > 1:\n        return 1\n    for i in a:\n        if i or a:\n            pass\n    return 0\n" },
    { path: "b.js", source: "function g(x) { return x ? 1 : 2; }\n" },
  ];
  const r = await analyzeSources({ slug: "demo/repo", files }, { provider, onProgress });
  return { repo: { slug: "demo/repo", url: "https://github.com/demo/repo", branch: "main", commit: "abc1234" }, ...r, sources: { "a.py": files[0].source } };
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "tdr-srv-"));
  server = createApp({ store: new AnalysisStore(dataDir), providerFactory: () => new HeuristicProvider(), analyze: fakeAnalyze });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dataDir, { recursive: true, force: true });
});

const post = (p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function waitDone(id) {
  for (let i = 0; i < 100; i++) {
    const rec = await (await fetch(`${base}/api/analyses/${id}`)).json();
    if (rec.status !== "en_progreso") return rec;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout");
}

test("health informa el proveedor activo", async () => {
  const h = await (await fetch(`${base}/api/health`)).json();
  assert.deepEqual(h, { ok: true, provider: "heuristica", model: null });
});

test("URL inválida → 400 con mensaje en español", async () => {
  const res = await post("/api/analyses", { url: "gitlab.com/x/y" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /github\.com/);
  assert.equal((await post("/api/analyses", {})).status, 400);
  const bad = await fetch(`${base}/api/analyses`, { method: "POST", body: "{no json" });
  assert.equal(bad.status, 400);
});

test("flujo completo: crear análisis → progreso → resultado → detalle → estado", async () => {
  const res = await post("/api/analyses", { url: "github.com/demo/repo" });
  assert.equal(res.status, 202);
  const { id } = await res.json();
  const rec = await waitDone(id);
  assert.equal(rec.status, "listo");
  assert.equal(rec.sources, undefined, "las fuentes no viajan en la vista general");
  assert.ok(rec.findings.length >= 1);
  assert.equal(rec.findings[0].path, "a.py");

  const src = await (await fetch(`${base}/api/analyses/${id}/source?path=a.py`)).json();
  assert.match(src.source, /def f/);
  assert.equal((await fetch(`${base}/api/analyses/${id}/source?path=../../etc/passwd`)).status, 404);

  const st = await post(`/api/analyses/${id}/findings/${rec.findings[0].id}/status`, { status: "resuelto" });
  assert.equal(st.status, 200);
  const again = await (await fetch(`${base}/api/analyses/${id}`)).json();
  assert.equal(again.findings[0].status, "resuelto");
  assert.equal((await post(`/api/analyses/${id}/findings/${rec.findings[0].id}/status`, { status: "borrado" })).status, 400);
  assert.equal((await post(`/api/analyses/${id}/findings/999/status`, { status: "ignorado" })).status, 404);

  // Un segundo análisis del mismo repo se reutiliza (200), salvo que se fuerce (202)
  const reuse = await post("/api/analyses", { url: "https://github.com/demo/repo" });
  assert.equal(reuse.status, 200);
  assert.deepEqual(await reuse.json(), { id, reused: true });
  const forced = await post("/api/analyses", { url: "demo/repo", force: true });
  assert.equal(forced.status, 202);
  await waitDone((await forced.json()).id);

  const list = await (await fetch(`${base}/api/analyses`)).json();
  assert.ok(list.length >= 2);
  assert.ok(list.every((r) => r.repo.slug === "demo/repo"));
});

test("repositorio inexistente → análisis en estado error con mensaje claro", async () => {
  const { id } = await (await post("/api/analyses", { url: "github.com/demo/no-existe" })).json();
  const rec = await waitDone(id);
  assert.equal(rec.status, "error");
  assert.match(rec.error, /No se encontró/);
});

test("ids inválidos y rutas desconocidas", async () => {
  assert.equal((await fetch(`${base}/api/analyses/../../x`)).status, 404);
  assert.equal((await fetch(`${base}/api/analyses/00000000-0000-0000-0000-000000000000`)).status, 404);
  assert.equal((await fetch(`${base}/api/nada`)).status, 404);
});

test("sirve la interfaz web y bloquea path traversal", async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(await home.text(), /TechDebtRadar/);
  for (const p of ["/resultados.html", "/detalle.html", "/js/app.js", "/css/styles.css"]) {
    assert.equal((await fetch(base + p)).status, 200, p);
  }
  assert.notEqual((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 200);
  assert.equal((await fetch(`${base}/no-existe.html`)).status, 404);
});
