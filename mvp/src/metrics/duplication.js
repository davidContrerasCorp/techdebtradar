/**
 * Detección de código duplicado entre archivos por hashing de bloques de líneas.
 *
 * 1. Cada archivo se normaliza: sin comentarios ni contenido de strings (lexer.js),
 *    espacios colapsados y se descartan las líneas triviales (solo llaves, paréntesis,
 *    `else:`, `pass`, imports, etc.).
 * 2. Se toman ventanas deslizantes de WINDOW líneas significativas consecutivas y se
 *    les calcula un hash.
 * 3. Una línea de un archivo está "duplicada" si pertenece a alguna ventana cuyo hash
 *    también aparece en OTRO archivo del repositorio.
 *
 * DUP(archivo) = líneas duplicadas / líneas significativas × 100
 */
import { createHash } from "node:crypto";

export const WINDOW = 6;

const TRIVIAL = /^([{}()[\];,]+|else:?|try:?|finally:?|pass|break|continue|return;?|\}\s*else\s*\{|\}\)?;?|end|default:)$/;
const IMPORT = /^(import\b|from\s+\S+\s+import\b|export\s+\*|export\s*\{|const\s+\w+\s*=\s*require\()/;

export function significantLines(code) {
  const result = [];
  code.split("\n").forEach((raw, idx) => {
    const norm = raw.trim().replace(/\s+/g, " ");
    if (norm.length < 4) return;
    if (TRIVIAL.test(norm) || IMPORT.test(norm)) return;
    result.push({ line: idx + 1, norm });
  });
  return result;
}

function hash(s) {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

/**
 * @param files [{ path, code }] código ya limpio por el lexer
 * @returns Map path -> { significant, duplicated, pct, partners: Set<path>, blocks: [{fromLine,toLine,other}] }
 */
export function computeDuplication(files) {
  const windowsByHash = new Map(); // hash -> Set(path)
  const perFile = new Map();

  for (const f of files) {
    const sig = significantLines(f.code);
    const wins = [];
    for (let k = 0; k + WINDOW <= sig.length; k++) {
      const h = hash(sig.slice(k, k + WINDOW).map((s) => s.norm).join("\n"));
      wins.push({ h, k });
      if (!windowsByHash.has(h)) windowsByHash.set(h, new Set());
      windowsByHash.get(h).add(f.path);
    }
    perFile.set(f.path, { sig, wins });
  }

  const result = new Map();
  for (const f of files) {
    const { sig, wins } = perFile.get(f.path);
    const dupIdx = new Set();
    const partners = new Set();
    const blocks = [];
    for (const w of wins) {
      const owners = windowsByHash.get(w.h);
      if (owners.size > 1) {
        for (let j = w.k; j < w.k + WINDOW; j++) dupIdx.add(j);
        const other = [...owners].find((p) => p !== f.path);
        partners.add(other);
        const last = blocks[blocks.length - 1];
        const fromLine = sig[w.k].line;
        const toLine = sig[w.k + WINDOW - 1].line;
        if (last && last.other === other && fromLine <= last.toLine + 1) last.toLine = Math.max(last.toLine, toLine);
        else blocks.push({ fromLine, toLine, other });
      }
    }
    const significant = sig.length;
    const duplicated = dupIdx.size;
    result.set(f.path, {
      significant,
      duplicated,
      pct: significant ? Math.round((duplicated / significant) * 1000) / 10 : 0,
      partners: [...partners],
      blocks: blocks.slice(0, 10),
    });
  }
  return result;
}
