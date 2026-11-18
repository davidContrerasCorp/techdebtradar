import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicProvider, HeuristicProvider, buildUserPrompt, buildCodeExcerpt, normalizeOutput, createProvider, SYSTEM_PROMPT } from "../src/llm.js";

const file = {
  path: "app/orders.py",
  language: "python",
  norm: { cc: 10, satd: 10, dup: 3, size: 10 },
  metrics: { loc: 40, functions: 3, ccAvg: 4.3, ccMax: 22, satd: 2, dupPct: 18, maxNesting: 4, longFunctions: 1, maxFunctionLength: 120 },
  details: {
    topComplexFunctions: [{ name: "process_order", cc: 22, startLine: 10, endLine: 130, length: 120 }],
    topLongFunctions: [{ name: "process_order", cc: 22, startLine: 10, endLine: 130, length: 120 }],
    satd: [{ line: 8, marker: "FIXME", text: "el descuento falla" }, { line: 7, marker: "TODO", text: "mover" }],
    duplication: { partners: ["app/customers.py"], blocks: [{ fromLine: 40, toLine: 46, other: "app/customers.py" }] },
  },
};
const repo = { slug: "equipo/tienda", fileCount: 4, languages: ["python"], readme: "Tienda en línea" };

/** Cliente falso que imita client.beta.messages.parse del SDK. */
function fakeClient(response) {
  const calls = [];
  return {
    calls,
    beta: { messages: { parse: async (params) => { calls.push(params); return typeof response === "function" ? response(params) : response; } } },
  };
}

test("el prompt incluye métricas, código delimitado y advertencia de datos no confiables", () => {
  const p = buildUserPrompt({ repo, file, source: "def process_order():\n    pass\n" });
  assert.match(p, /equipo\/tienda/);
  assert.match(p, /<codigo>[\s\S]*process_order[\s\S]*<\/codigo>/);
  assert.match(p, /"complejidad_ciclomatica_maxima": 22/);
  assert.match(p, /FIXME/);
  assert.match(SYSTEM_PROMPT, /DATO no confiable/);
});

test("archivos grandes se envían como extracto con las regiones relevantes", () => {
  const big = Array.from({ length: 3000 }, (_, i) => `linea_${i + 1} = ${i}`).join("\n");
  const ex = buildCodeExcerpt(big, file.details);
  assert.equal(ex.partial, true);
  assert.ok(ex.text.length <= 15_000);
  assert.match(ex.text, /\s10\| linea_10 = 9/);
  assert.match(ex.text, /(líneas 4-130)/); // función L10-130 + contexto de los SATD (L7, L8) fusionados
  const small = buildCodeExcerpt("a = 1\nb = 2", file.details);
  assert.equal(small.partial, false);
});

test("AnthropicProvider envía la solicitud estructurada y normaliza la respuesta", async () => {
  const client = fakeClient({
    stop_reason: "end_turn",
    model: "claude-opus-5-5",
    usage: { input_tokens: 1200, output_tokens: 300 },
    parsed_output: { senales: ["CC 22"], explicacion: "Explica.", severidad: 4.6, sugerencia: "Dividir.", resumen: "Función enorme" },
  });
  const p = new AnthropicProvider({ client });
  const out = await p.assess({ repo, file, source: "x = 1" });
  assert.equal(out.severidad, 5);
  assert.equal(out.provider, "anthropic");
  assert.deepEqual(out.usage, { input: 1200, output: 300 });
  const req = client.calls[0];
  assert.equal(req.model, "claude-opus-5-5");
  assert.equal(req.output_config.format.type, "json_schema");
  assert.deepEqual(req.output_config.format.schema.required.sort(), ["explicacion", "resumen", "senales", "severidad", "sugerencia"]);
  assert.equal(req.fallbacks, "default");
  assert.equal(req.messages[0].role, "user");
});

test("AnthropicProvider falla explícitamente ante rechazo o salida inválida", async () => {
  await assert.rejects(new AnthropicProvider({ client: fakeClient({ stop_reason: "refusal", parsed_output: null }) }).assess({ repo, file, source: "" }), /rechazó/);
  await assert.rejects(new AnthropicProvider({ client: fakeClient({ stop_reason: "end_turn", parsed_output: null }) }).assess({ repo, file, source: "" }), /formato/);
  await assert.rejects(new AnthropicProvider({ client: fakeClient({ stop_reason: "max_tokens", parsed_output: null }) }).assess({ repo, file, source: "" }), /truncó/);
});

test("normalizeOutput acota la severidad a 1-5 entero", () => {
  assert.equal(normalizeOutput({ severidad: 0 }).severidad, 1);
  assert.equal(normalizeOutput({ severidad: 7 }).severidad, 5);
  assert.equal(normalizeOutput({ severidad: "3" }).severidad, 3);
  assert.equal(normalizeOutput({}).severidad, 1);
});

test("HeuristicProvider es determinista y usa las métricas", async () => {
  const h = new HeuristicProvider();
  const a = await h.assess({ repo, file, source: "" });
  const b = await h.assess({ repo, file, source: "" });
  assert.deepEqual(a, b);
  assert.equal(a.provider, "heuristica");
  assert.ok(a.severidad >= 4, "CC 22 + FIXME + anidamiento deben dar severidad alta");
  assert.match(a.explicacion, /process_order/);
  assert.match(a.explicacion, /sin LLM/);
  assert.match(a.sugerencia, /process_order/);

  const leve = await h.assess({ repo, file: { ...file, metrics: { ...file.metrics, ccMax: 3, satd: 1, dupPct: 0, maxNesting: 1, loc: 20 }, details: { ...file.details, topComplexFunctions: [], topLongFunctions: [], satd: [{ line: 1, marker: "TODO", text: "x" }] } }, source: "" });
  assert.ok(leve.severidad <= 2);
});

test("createProvider elige según TDR_LLM y las credenciales", () => {
  assert.equal(createProvider("heuristica").name, "heuristica");
  const saved = { k: process.env.ANTHROPIC_API_KEY, t: process.env.ANTHROPIC_AUTH_TOKEN };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  assert.equal(createProvider("auto").name, "heuristica");
  process.env.ANTHROPIC_API_KEY = "sk-ant-prueba-falsa";
  assert.equal(createProvider("auto").name, "anthropic");
  if (saved.k === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.k;
  if (saved.t !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = saved.t;
});
