/**
 * Complejidad ciclomática (McCabe, 1976) por función.
 *
 * CC(función) = 1 + número de puntos de decisión dentro de la función.
 * Puntos de decisión contados (misma convención que radon/lizard):
 *   Python:      if, elif, for, while, except, and, or, case, (comprensiones: for/if)
 *   JavaScript:  if, for, while, case, catch, &&, ||, ??, operador ternario ?:
 * `else`, `try`, `finally` y `default` no agregan caminos independientes.
 *
 * Trabaja sobre el código ya "limpio" (sin strings ni comentarios) que entrega lexer.js.
 */

// ---------------------------------------------------------------- Python
const PY_DECISION = /\b(if|elif|for|while|except|and|or|case)\b/g;

function indentOf(line) {
  const m = /^[ \t]*/.exec(line)[0];
  return m.replace(/\t/g, "    ").length;
}

export function pythonFunctions(code) {
  const lines = code.split("\n");
  const funcs = [];
  const stack = []; // funciones abiertas: { indent, func }

  let depth = 0; // profundidad de paréntesis/corchetes/llaves abiertos
  let backslash = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const trimmed = raw.trim();
    const continuation = depth > 0 || backslash;
    for (const ch of raw) {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if ((ch === ")" || ch === "]" || ch === "}") && depth > 0) depth--;
    }
    backslash = trimmed.endsWith("\\");
    if (!trimmed) continue;

    if (continuation) {
      // Línea de continuación de una sentencia: no cambia el bloque actual
      if (stack.length) {
        const top = stack[stack.length - 1];
        for (const s of stack) s.func.endLine = idx + 1;
        top.func.cc += (trimmed.match(PY_DECISION) || []).length;
      }
      continue;
    }
    const ind = indentOf(raw);

    // Cerrar funciones cuyo cuerpo terminó (indentación <= la del `def`)
    while (stack.length && ind <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const def = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (def) {
      const f = { name: def[1], startLine: idx + 1, endLine: idx + 1, cc: 1, nesting: 0 };
      funcs.push(f);
      stack.push({ indent: ind, func: f, bodyIndent: null });
      // La firma puede contener valores por defecto con `if` (raro): se ignoran
      continue;
    }

    if (stack.length) {
      const top = stack[stack.length - 1];
      // Extender el rango de la función actual y de las contenedoras
      for (const s of stack) s.func.endLine = idx + 1;
      if (top.bodyIndent === null) top.bodyIndent = ind;
      const decisions = (trimmed.match(PY_DECISION) || []).length;
      top.func.cc += decisions;
      const depth = Math.max(0, Math.round((ind - top.bodyIndent) / 4));
      if (depth > top.func.nesting) top.func.nesting = depth;
    }
  }
  return funcs;
}

// ------------------------------------------------------- JavaScript / TS
const JS_CONTROL = new Set(["if", "for", "while", "switch", "catch", "with", "return", "typeof", "await", "new", "yield", "delete", "void", "throw", "in", "of", "instanceof"]);
const JS_DECISION_WORDS = new Set(["if", "for", "while", "case", "catch"]);
// Tokens que pueden aparecer entre `)` y `{` en una firma TypeScript (tipo de retorno)
const TS_TYPE_TOKENS = /^(:|<|>|\[|\]|\||&|\.|,|\?|=>|[A-Za-z_$][A-Za-z0-9_$]*)$/;

function tokenizeJs(code) {
  const tokens = [];
  const re = /[A-Za-z_$][A-Za-z0-9_$]*|\d[\d_.xXa-fA-FnobOB]*|\?\?=?|\?\.|=>|&&=?|\|\|=?|===?|!==?|[<>]=?|\.\.\.|\n|\S/g;
  let line = 1;
  let m;
  while ((m = re.exec(code))) {
    if (m[0] === "\n") { line++; continue; }
    tokens.push({ t: m[0], line });
  }
  return tokens;
}

/** Busca un nombre para una función anónima asignada:  const x = ...  /  x: ... / x = function */
const ASSIGNED_NAME = /(?:\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=|([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\b|function\b|\(|<|[A-Za-z_$][\w$]*\s*=>))/g;
function guessName(codeLines, line) {
  for (let l = line; l >= 1 && l > line - 6; l--) {
    const text = codeLines[l - 1] || "";
    let m;
    let last = null;
    ASSIGNED_NAME.lastIndex = 0;
    while ((m = ASSIGNED_NAME.exec(text))) last = m[1] || m[2];
    if (last && !JS_CONTROL.has(last)) return last;
    // Si la línea anterior cierra una sentencia, no seguimos subiendo
    if (l < line && /[;}]\s*$/.test(text)) break;
  }
  return "(anónima)";
}

export function javascriptFunctions(code) {
  const codeLines = code.split("\n");
  const tokens = tokenizeJs(code);
  const funcs = [];
  const braceStack = []; // { isFn, func }
  const parenStack = []; // índice del token anterior a "("
  let pendingFn = null; // nombre si el próximo "{" abre un cuerpo de función
  let pendingSince = -1;

  const currentFn = () => {
    for (let k = braceStack.length - 1; k >= 0; k--) if (braceStack[k].isFn) return braceStack[k].func;
    return null;
  };
  const blockDepthInFn = () => {
    let d = 0;
    for (let k = braceStack.length - 1; k >= 0; k--) {
      if (braceStack[k].isFn) return d;
      d++;
    }
    return d;
  };

  const nameBefore = (idx) => {
    // idx: índice del token justo antes de "(" o de "=>"
    const t = tokens[idx]?.t;
    if (t && /^[A-Za-z_$]/.test(t) && !JS_CONTROL.has(t) && t !== "function") return t;
    // function nombre(  |  nombre = function(  |  nombre = (...) =>
    if (t === "function") {
      const prev = tokens[idx - 1]?.t;
      const prev2 = tokens[idx - 2]?.t;
      if ((prev === "=" || prev === ":") && prev2 && /^[A-Za-z_$]/.test(prev2)) return prev2;
      return "(anónima)";
    }
    return "(anónima)";
  };

  for (let i = 0; i < tokens.length; i++) {
    const { t, line } = tokens[i];

    if (t === "(") {
      parenStack.push(i - 1);
      continue;
    }
    if (t === ")") {
      let before = parenStack.pop();
      // Genéricos de TypeScript:  nombre<T>(...)  /  = <T>(...) =>  → saltar el <...>
      if (tokens[before]?.t === ">") {
        let depth = 0;
        for (let k = before; k >= 0 && k > before - 60; k--) {
          if (tokens[k].t === ">") depth++;
          else if (tokens[k].t === "<") {
            depth--;
            if (depth === 0) { before = k - 1; break; }
          }
        }
      }
      const bt = tokens[before]?.t;
      const bbt = tokens[before - 1]?.t;
      let callable = false;
      let name = "(anónima)";
      if (bt === "function" || bbt === "function" || (bt === "*" && tokens[before - 1]?.t === "function")) {
        callable = true;
        name = bt === "function" ? nameBefore(before) : (bt && /^[A-Za-z_$]/.test(bt) ? bt : "(anónima)");
      } else if (bt && bt !== "async" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(bt) && !JS_CONTROL.has(bt)) {
        // método:  nombre(args) {   — o llamada normal nombre(args);  (se decide al ver "{")
        callable = true;
        name = bt;
      } else if (bt === undefined || bt === "=" || bt === "(" || bt === "," || bt === ":" || bt === "async" || bt === "return" || bt === "?" || bt === "[" || bt === "&&" || bt === "||" || bt === "??") {
        // posible arrow function: (args) => ...
        callable = true;
        const prevName = tokens[before - 1]?.t;
        name = bt === "=" && prevName && /^[A-Za-z_$]/.test(prevName) ? prevName : "(anónima)";
        if (bt === "async") {
          const p = tokens[before - 1]?.t;
          const pn = tokens[before - 2]?.t;
          name = p === "=" && pn && /^[A-Za-z_$]/.test(pn) ? pn : "(anónima)";
        }
      }
      if (callable) { pendingFn = name; pendingSince = i; }
      else pendingFn = null;
      continue;
    }
    if (t === "=>") {
      // x => {   |  (a, b) => {
      if (pendingFn === null) {
        const prev = tokens[i - 1]?.t;
        const p2 = tokens[i - 2]?.t;
        const p3 = tokens[i - 3]?.t;
        if (prev && /^[A-Za-z_$]/.test(prev)) {
          pendingFn = p2 === "=" && p3 && /^[A-Za-z_$]/.test(p3) ? p3 : "(anónima)";
        } else pendingFn = "(anónima)";
      }
      pendingSince = i;
      // Arrow sin llaves: cuerpo de expresión. Sus decisiones se cuentan para la función contenedora.
      if (tokens[i + 1]?.t !== "{") pendingFn = null;
      continue;
    }
    if (t === "{") {
      let isFn = false;
      if (pendingFn !== null) {
        // ¿Todo lo que hay entre el ")" o "=>" y este "{" es parte de una anotación de tipo?
        isFn = true;
        for (let k = pendingSince + 1; k < i; k++) {
          if (!TS_TYPE_TOKENS.test(tokens[k].t)) { isFn = false; break; }
        }
      }
      if (isFn) {
        const name = pendingFn === "(anónima)" ? guessName(codeLines, line) : pendingFn;
        const f = { name, startLine: line, endLine: line, cc: 1, nesting: 0 };
        funcs.push(f);
        braceStack.push({ isFn: true, func: f });
      } else {
        braceStack.push({ isFn: false });
        const fn = currentFn();
        if (fn) {
          const d = blockDepthInFn();
          if (d > fn.nesting) fn.nesting = d;
        }
      }
      pendingFn = null;
      continue;
    }
    if (t === "}") {
      const top = braceStack.pop();
      if (top && top.isFn) top.func.endLine = line;
      continue;
    }
    if (t === ";") { pendingFn = null; }

    // Puntos de decisión
    let decision = 0;
    if (JS_DECISION_WORDS.has(t)) {
      // `for` y `while` de un do..while cuentan una sola vez (while)
      decision = 1;
    } else if (t === "&&" || t === "||" || t === "??") {
      decision = 1;
    } else if (t === "?") {
      // Ternario (no `?.` ni `??`, ya tokenizados aparte). Excluimos parámetros
      // opcionales de TypeScript:  nombre?: tipo   y   nombre?) / nombre?,
      const next = tokens[i + 1]?.t;
      if (next !== ":" && next !== ")" && next !== "," && next !== "=") decision = 1;
    }
    if (decision) {
      const fn = currentFn();
      if (fn) fn.cc += decision;
    }
  }
  return funcs;
}

export function functionsOf(code, language) {
  return language === "python" ? pythonFunctions(code) : javascriptFunctions(code);
}
