/**
 * Lexer ligero para Python y JavaScript/TypeScript.
 *
 * No construye un AST completo: separa el código de los comentarios y de los
 * literales de texto, preservando los saltos de línea para que los números de
 * línea sigan siendo válidos. Es el mismo enfoque "basado en tokens" que usa
 * la herramienta lizard (Yin, 2012-), suficiente para contar puntos de
 * decisión (complejidad ciclomática de McCabe) y extraer comentarios (SATD).
 *
 * Resultado: { code, comments }
 *   - code: el código fuente con strings reemplazados por "" / '' vacíos y
 *           comentarios reemplazados por espacios (mismo número de líneas).
 *   - comments: [{ line, text }] con la línea (1-indexada) donde inicia cada comentario.
 */

export function languageOf(filePath) {
  const p = filePath.toLowerCase();
  if (p.endsWith(".py")) return "python";
  if (/\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(p)) return "javascript";
  return null;
}

/** Reemplaza cada carácter que no sea salto de línea por un espacio. */
function blank(s) {
  return s.replace(/[^\n]/g, " ");
}

function countNewlines(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

// ---------------------------------------------------------------- Python
export function stripPython(src) {
  const out = [];
  const comments = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === "#") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      const text = src.slice(i, stop);
      comments.push({ line, text: text.slice(1).trim() });
      out.push(blank(text));
      i = stop;
      continue;
    }

    // Literales de texto con prefijos opcionales (r, b, f, u, rb, br, fr, rf)
    const prefix = /^[rRbBuUfF]{0,2}/.exec(src.slice(i, i + 2))[0];
    const q = src[i + prefix.length];
    const prevIsWord = i > 0 && /[A-Za-z0-9_]/.test(src[i - 1]);
    if ((q === '"' || q === "'") && !(prefix.length > 0 && prevIsWord)) {
      const triple = src.substr(i + prefix.length, 3) === q.repeat(3);
      const delim = triple ? q.repeat(3) : q;
      let j = i + prefix.length + delim.length;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (!triple && src[j] === "\n") break; // string sin cerrar: cortamos en la línea
        if (src.startsWith(delim, j)) { j += delim.length; break; }
        j++;
      }
      const lit = src.slice(i, j);
      const nl = countNewlines(lit);
      // Mantenemos un literal vacío y los saltos de línea
      out.push(prefix + q + q + "\n".repeat(nl));
      line += nl;
      i = j;
      continue;
    }

    if (c === "\n") line++;
    out.push(c);
    i++;
  }
  return { code: out.join(""), comments };
}

// ------------------------------------------------------- JavaScript / TS
const REGEX_PRECEDERS = new Set([
  "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^",
]);
const REGEX_KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

export function stripJavaScript(src) {
  const out = [];
  const comments = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  let lastSig = ""; // último carácter significativo de código
  let lastWord = "";

  const isRegexStart = () => {
    if (lastSig === "") return true;
    if (REGEX_PRECEDERS.has(lastSig)) return true;
    if (/[A-Za-z_$]/.test(lastSig) && REGEX_KEYWORDS.has(lastWord)) return true;
    return false;
  };

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    // Comentario de línea
    if (c === "/" && d === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      const text = src.slice(i, stop);
      comments.push({ line, text: text.slice(2).trim() });
      out.push(blank(text));
      i = stop;
      continue;
    }
    // Comentario de bloque
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      const text = src.slice(i, stop);
      const inner = text.replace(/^\/\*+/, "").replace(/\*+\/$/, "");
      // Un comentario de bloque puede tener varias líneas: registramos cada una
      inner.split("\n").forEach((ln, k) => {
        const t = ln.replace(/^\s*\*\s?/, "").trim();
        if (t) comments.push({ line: line + k, text: t });
      });
      out.push(blank(text));
      line += countNewlines(text);
      i = stop;
      continue;
    }
    // Strings
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        if (c !== "`" && src[j] === "\n") break;
        j++;
      }
      const lit = src.slice(i, j);
      const nl = countNewlines(lit);
      out.push(c + c + "\n".repeat(nl));
      line += nl;
      lastSig = c;
      lastWord = "";
      i = j;
      continue;
    }
    // Literal de expresión regular
    if (c === "/" && isRegexStart()) {
      let j = i + 1;
      let inClass = false;
      let ok = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) { ok = true; j++; break; }
        j++;
      }
      if (ok) {
        while (j < n && /[a-z]/i.test(src[j])) j++; // flags
        out.push('""');
        lastSig = '"';
        lastWord = "";
        i = j;
        continue;
      }
    }

    if (c === "\n") line++;
    if (!/\s/.test(c)) {
      if (/[A-Za-z0-9_$]/.test(c)) {
        const m = /^[A-Za-z0-9_$]+/.exec(src.slice(i, i + 64));
        lastWord = m[0];
        lastSig = lastWord[lastWord.length - 1];
        out.push(lastWord);
        i += lastWord.length;
        continue;
      }
      lastSig = c;
      lastWord = "";
    }
    out.push(c);
    i++;
  }
  return { code: out.join(""), comments };
}

export function strip(src, language) {
  return language === "python" ? stripPython(src) : stripJavaScript(src);
}
