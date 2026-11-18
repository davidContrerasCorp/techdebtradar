import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripPython, stripJavaScript, languageOf } from "../src/metrics/lexer.js";
import { pythonFunctions, javascriptFunctions } from "../src/metrics/complexity.js";
import { findSatd } from "../src/metrics/satd.js";
import { computeDuplication } from "../src/metrics/duplication.js";
import { analyzeSource, analyzeFiles } from "../src/metrics/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (rel) => readFileSync(path.join(here, "fixtures", "sample-repo", rel), "utf8");
const byName = (fns) => Object.fromEntries(fns.map((f) => [f.name, f]));

test("languageOf reconoce extensiones soportadas", () => {
  assert.equal(languageOf("a/b.py"), "python");
  for (const p of ["x.js", "x.mjs", "x.cjs", "x.ts", "x.tsx", "x.jsx"]) assert.equal(languageOf(p), "javascript");
  assert.equal(languageOf("x.java"), null);
});

test("lexer de Python separa comentarios y vacía strings preservando líneas", () => {
  const src = 'x = "if # no es comentario"  # TODO real\ny = """\nmulti if\n"""\nz = f\'{a}\'';
  const { code, comments } = stripPython(src);
  assert.equal(code.split("\n").length, src.split("\n").length);
  assert.deepEqual(comments, [{ line: 1, text: "TODO real" }]);
  assert.ok(!code.includes("if"));
});

test("lexer de JS maneja comentarios, template strings y regex", () => {
  const src = "const r = /a\\/b[/]c/g; // FIXME uno\nconst t = `x\n${y} if`; /* bloque\n * HACK dos */ a = b / c / d;";
  const { code, comments } = stripJavaScript(src);
  assert.equal(code.split("\n").length, src.split("\n").length);
  assert.deepEqual(comments.map((c) => [c.line, c.text]), [[1, "FIXME uno"], [3, "bloque"], [4, "HACK dos"]]);
  assert.ok(code.includes("b / c / d"), "la división no debe confundirse con una regex");
  assert.ok(!code.includes(" if"));
});

test("complejidad ciclomática de Python (McCabe) coincide con el conteo manual", () => {
  const { code } = stripPython(fixture("app/orders.py"));
  const f = byName(pythonFunctions(code));
  // if, for, if, and, if, or, elif, while, except → 9 decisiones + 1
  assert.equal(f.process_order.cc, 10);
  assert.equal(f.helper.cc, 1);
  assert.equal(f.shared_block.cc, 2);
  assert.equal(f.process_order.startLine, 10);
});

test("complejidad de Python ignora líneas de continuación y strings multilínea", () => {
  const src = 'def f(a):\n    x = g(\n1)\n    s = """\nif\n"""\n    if a:\n        return 1\n    return 2\n\ndef h():\n    return 0\n';
  const f = byName(pythonFunctions(stripPython(src).code));
  assert.equal(f.f.cc, 2);
  assert.equal(f.f.endLine, 9);
  assert.equal(f.h.cc, 1);
});

test("complejidad ciclomática de JavaScript coincide con el conteo manual", () => {
  const { code } = stripJavaScript(fixture("web/cart.js"));
  const f = byName(javascriptFunctions(code));
  // for, if, &&, if, ||, ?: → 6 + 1   (?. no cuenta)
  assert.equal(f.cartTotal.cc, 7);
  // case, case, ?? → 3 + 1           (switch y default no cuentan)
  assert.equal(f.applyCoupon.cc, 4);
});

test("complejidad de TypeScript: genéricos, parámetros opcionales y tipos de retorno", () => {
  const { code } = stripJavaScript(fixture("web/util.ts"));
  const f = byName(javascriptFunctions(code));
  assert.equal(f.clamp.cc, 5); // if, &&, if, &&  (min?: no es un ternario)
  assert.equal(f.identity.cc, 1);
});

test("métodos de clase y funciones anidadas se separan", () => {
  const src = "class A {\n  m(x) {\n    if (x) { return 1; }\n    const inner = () => { while (x) {} };\n    return 0;\n  }\n}\nif (a) { b(); }";
  const f = byName(javascriptFunctions(stripJavaScript(src).code));
  assert.equal(f.m.cc, 2);
  assert.equal(f.inner.cc, 2);
  assert.equal(Object.keys(f).length, 2, "el if/for de nivel superior no es una función");
});

test("SATD solo se detecta en comentarios", () => {
  const py = analyzeSource("app/orders.py", fixture("app/orders.py"));
  assert.deepEqual(py.details.satd.map((s) => s.marker), ["TODO", "FIXME"]);
  const js = analyzeSource("web/cart.js", fixture("web/cart.js"));
  assert.deepEqual(js.details.satd.map((s) => [s.marker, s.line]), [["HACK", 1]]);
  assert.equal(findSatd([{ line: 1, text: "todo: minúsculas con dos puntos" }]).length, 1);
  assert.equal(findSatd([{ line: 1, text: "nada pendiente aquí" }]).length, 0);
});

test("duplicación entre archivos por ventanas de líneas", () => {
  const files = ["app/orders.py", "app/customers.py"].map((p) => ({ path: p, code: stripPython(fixture(p)).code }));
  const dup = computeDuplication(files);
  const c = dup.get("app/customers.py");
  assert.equal(c.significant, 11);
  assert.equal(c.duplicated, 8);
  assert.equal(c.pct, 72.7);
  assert.deepEqual(c.partners, ["app/orders.py"]);
  assert.ok(dup.get("app/orders.py").pct > 0);
});

test("sin duplicación cuando los archivos son distintos o el bloque está en un solo archivo", () => {
  const dup = computeDuplication([
    { path: "a.py", code: "a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6\n" },
    { path: "b.py", code: "x = 1\ny = 2\n" },
  ]);
  assert.equal(dup.get("a.py").pct, 0);
  assert.equal(dup.get("b.py").pct, 0);
});

test("analyzeFiles calcula todas las métricas sin errores para el repositorio de prueba", () => {
  const paths = ["app/orders.py", "app/customers.py", "web/cart.js", "web/util.ts"];
  const { files, errors } = analyzeFiles(paths.map((p) => ({ path: p, source: fixture(p) })));
  assert.equal(errors.length, 0);
  assert.equal(files.length, 4);
  const orders = files.find((f) => f.path === "app/orders.py");
  assert.equal(orders.metrics.ccMax, 10);
  assert.equal(orders.metrics.satd, 2);
  assert.equal(orders.metrics.functions, 3);
  assert.ok(orders.metrics.dupPct > 0);
  assert.equal(orders.code, undefined, "el código limpio no se expone");
});

test("analyzeFiles reporta errores de lenguaje no soportado sin detenerse", () => {
  const { files, errors } = analyzeFiles([{ path: "x.java", source: "class X {}" }, { path: "y.py", source: "x = 1\n" }]);
  assert.equal(files.length, 1);
  assert.equal(errors.length, 1);
});
