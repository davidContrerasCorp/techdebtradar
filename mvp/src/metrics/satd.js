/**
 * Deuda técnica auto-admitida (SATD, Potdar y Shihab, 2014).
 *
 * Detecta comentarios que contienen los marcadores léxicos clásicos
 * TODO, FIXME, HACK, XXX (y BUG / KLUDGE / WORKAROUND como variantes comunes).
 * Solo se buscan dentro de comentarios, nunca en código ni en strings.
 */

export const SATD_PATTERN = /\b(TODO|FIXME|HACK|XXX|BUG|KLUDGE|WORKAROUND)\b/;

export function findSatd(comments) {
  const hits = [];
  for (const c of comments) {
    const m = SATD_PATTERN.exec(c.text);
    // Exigimos mayúsculas para TODO/FIXME/etc. (convención) excepto "todo:" seguido de dos puntos
    const lower = /\b(todo|fixme|hack)\s*:/i.exec(c.text);
    if (m || lower) {
      hits.push({ line: c.line, marker: (m ? m[1] : lower[1]).toUpperCase(), text: c.text.slice(0, 200) });
    }
  }
  return hits;
}
