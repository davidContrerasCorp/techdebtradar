/**
 * Persistencia simple de análisis en disco (un JSON por análisis en data/analyses/).
 * Suficiente para el MVP: historial de "Análisis recientes" y estado de cada hallazgo
 * (pendiente / resuelto / ignorado) que sobrevive a reinicios del servidor.
 */
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class AnalysisStore {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
    this.ready = mkdir(dir, { recursive: true });
  }

  file(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("id inválido");
    return path.join(this.dir, `${id}.json`);
  }

  newId() {
    return randomUUID();
  }

  /**
   * Guarda el registro. Las escrituras de un mismo id se serializan (cola por id) y cada
   * una usa un archivo temporal único + rename atómico, para que dos guardados
   * concurrentes (p. ej. fin del análisis y "marcar resuelto") no se pisen.
   */
  async save(record) {
    await this.ready;
    this.cache.set(record.id, record);
    const target = this.file(record.id);
    const prev = this.writes?.get(record.id) || Promise.resolve();
    const job = prev.catch(() => {}).then(async () => {
      const tmp = `${target}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(record));
      await rename(tmp, target);
    });
    if (!this.writes) this.writes = new Map();
    this.writes.set(record.id, job);
    try {
      await job;
    } finally {
      if (this.writes.get(record.id) === job) this.writes.delete(record.id);
    }
    return record;
  }

  async get(id) {
    await this.ready;
    if (this.cache.has(id)) return this.cache.get(id);
    try {
      const rec = JSON.parse(await readFile(this.file(id), "utf8"));
      this.cache.set(id, rec);
      return rec;
    } catch {
      return null;
    }
  }

  async list(limit = 20) {
    await this.ready;
    const names = (await readdir(this.dir)).filter((n) => n.endsWith(".json"));
    const recs = [];
    for (const n of names) {
      const rec = await this.get(n.replace(/\.json$/, ""));
      if (rec) recs.push(rec);
    }
    return recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  /** Último análisis terminado del mismo repositorio (para reusar resultados recientes). */
  async findRecent(slug, maxAgeMs) {
    const all = await this.list(200);
    const now = Date.now();
    return all.find((r) => r.status === "listo" && r.repo?.slug?.toLowerCase() === slug.toLowerCase() && now - Date.parse(r.createdAt) < maxAgeMs) || null;
  }
}
