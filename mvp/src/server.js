/**
 * Servidor HTTP del MVP (sin frameworks, solo node:http).
 *
 *   GET  /api/health                         estado y proveedor de LLM activo
 *   POST /api/analyses        {url, force?}  inicia un análisis (asíncrono) → {id}
 *   GET  /api/analyses                       análisis recientes
 *   GET  /api/analyses/:id                   estado / resultado completo
 *   GET  /api/analyses/:id/source?path=...   código fuente de un archivo priorizado
 *   POST /api/analyses/:id/findings/:fid/status  {status: pendiente|resuelto|ignorado}
 *   GET  /*                                  interfaz web (carpeta public/)
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRepository } from "./pipeline.js";
import { createProvider } from "./llm.js";
import { parseGithubUrl, UserInputError } from "./github.js";
import { AnalysisStore } from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "..", "public");
const REUSE_MS = 60 * 60 * 1000; // reusar un análisis del mismo repo hecho hace < 1 h
const MAX_CONCURRENT = 2;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    "Content-Type": isJson ? MIME[".json"] : headers["Content-Type"] || "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readJson(req, limit = 10_000) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > limit) throw new UserInputError("Cuerpo de la solicitud demasiado grande.");
  }
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    throw new UserInputError("JSON inválido.");
  }
}

/** Vista pública de un análisis (sin las fuentes completas). */
function publicView(rec) {
  const { sources, ...rest } = rec;
  return rest;
}

function listView(rec) {
  return {
    id: rec.id,
    createdAt: rec.createdAt,
    status: rec.status,
    repo: rec.repo,
    level: rec.summary?.level || null,
    findings: rec.summary?.findings ?? null,
    provider: rec.summary?.provider || null,
    error: rec.error || null,
  };
}

export function createApp({ store, providerFactory = createProvider, analyze = analyzeRepository } = {}) {
  let running = 0;

  async function startAnalysis(url, force) {
    const parsed = parseGithubUrl(url); // valida antes de crear el registro
    if (!force) {
      const recent = await store.findRecent(parsed.slug, REUSE_MS);
      if (recent) return { id: recent.id, reused: true };
    }
    if (running >= MAX_CONCURRENT) throw new UserInputError("El servidor está ocupado con otros análisis. Intenta de nuevo en un minuto.");
    const id = store.newId();
    const rec = {
      id,
      createdAt: new Date().toISOString(),
      status: "en_progreso",
      progress: { step: "en_cola", message: "En cola" },
      repo: { slug: parsed.slug, url: `https://github.com/${parsed.slug}` },
    };
    await store.save(rec);
    running++;
    const provider = providerFactory();
    analyze(url, {
      provider,
      onProgress: (step, message) => {
        rec.progress = { step, message };
      },
    })
      .then(async (result) => {
        Object.assign(rec, result, { status: "listo", progress: { step: "listo", message: "Análisis completo" }, finishedAt: new Date().toISOString() });
        await store.save(rec);
      })
      .catch(async (err) => {
        rec.status = "error";
        rec.error = err instanceof UserInputError ? err.message : `Error interno: ${err.message}`;
        if (!(err instanceof UserInputError)) console.error(err);
        await store.save(rec);
      })
      .finally(() => {
        running--;
      });
    return { id, reused: false };
  }

  async function handleApi(req, res, url) {
    const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
    const method = req.method;

    if (parts[1] === "health" && method === "GET") {
      const p = providerFactory();
      return send(res, 200, { ok: true, provider: p.name, model: p.model || null });
    }
    if (parts[1] !== "analyses") return send(res, 404, { error: "No encontrado" });

    if (parts.length === 2 && method === "POST") {
      const body = await readJson(req);
      const out = await startAnalysis(body.url, Boolean(body.force));
      return send(res, out.reused ? 200 : 202, out);
    }
    if (parts.length === 2 && method === "GET") {
      const recs = await store.list(20);
      return send(res, 200, recs.map(listView));
    }

    const id = parts[2];
    if (!/^[a-f0-9-]{36}$/.test(id || "")) return send(res, 404, { error: "Análisis no encontrado" });
    const rec = await store.get(id);
    if (!rec) return send(res, 404, { error: "Análisis no encontrado" });

    if (parts.length === 3 && method === "GET") return send(res, 200, publicView(rec));

    if (parts[3] === "source" && method === "GET") {
      const p = url.searchParams.get("path");
      const src = rec.sources?.[p];
      if (src === undefined) return send(res, 404, { error: "Archivo no disponible" });
      return send(res, 200, { path: p, source: src });
    }

    if (parts[3] === "findings" && parts[5] === "status" && method === "POST") {
      const body = await readJson(req);
      const allowed = ["pendiente", "resuelto", "ignorado"];
      if (!allowed.includes(body.status)) throw new UserInputError(`Estado inválido. Usa: ${allowed.join(", ")}.`);
      const f = rec.findings?.find((x) => String(x.id) === parts[4]);
      if (!f) return send(res, 404, { error: "Hallazgo no encontrado" });
      f.status = body.status;
      await store.save(rec);
      return send(res, 200, { id: f.id, status: f.status });
    }
    return send(res, 405, { error: "Método no permitido" });
  }

  async function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const abs = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!abs.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Prohibido");
    try {
      const body = await readFile(abs);
      return send(res, 200, body, { "Content-Type": MIME[path.extname(abs)] || "application/octet-stream", "Cache-Control": "no-cache" });
    } catch {
      return send(res, 404, "No encontrado");
    }
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método no permitido");
      return await serveStatic(req, res, url);
    } catch (err) {
      if (err instanceof UserInputError) return send(res, 400, { error: err.message });
      console.error(err);
      return send(res, 500, { error: "Error interno del servidor" });
    }
  });
}

// Ejecución directa: node src/server.js
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const store = new AnalysisStore(process.env.TDR_DATA_DIR || path.join(here, "..", "data", "analyses"));
  // Análisis que quedaron "en progreso" porque el servidor se detuvo: se marcan como interrumpidos
  for (const rec of await store.list(1000)) {
    if (rec.status === "en_progreso") {
      rec.status = "error";
      rec.error = "El análisis se interrumpió porque el servidor se reinició. Vuelve a intentarlo.";
      await store.save(rec);
    }
  }
  const server = createApp({ store });
  server.listen(port, () => {
    const p = createProvider();
    console.log(`TechDebtRadar escuchando en http://localhost:${port}`);
    console.log(p.name === "anthropic"
      ? `Componente LLM: Claude (${p.model})`
      : "Componente LLM: evaluador heurístico (sin LLM). Define ANTHROPIC_API_KEY para usar Claude.");
  });
}
