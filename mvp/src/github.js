/**
 * Obtención del código: validación de la URL, clonación superficial del repositorio
 * público y recorrido de los archivos soportados, con las medidas de control del
 * diseño (Sección 6): límites de tamaño, timeout y exclusión de carpetas generadas.
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, readdir, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { languageOf } from "./metrics/lexer.js";

export const LIMITS = {
  cloneTimeoutMs: Number(process.env.TDR_CLONE_TIMEOUT_MS || 120_000),
  maxFiles: Number(process.env.TDR_MAX_FILES || 1500),
  maxFileBytes: 400_000, // archivos más grandes suelen ser generados o minificados
  maxTotalBytes: 40_000_000,
};

const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", "coverage", "vendor", "vendors", "third_party",
  "__pycache__", ".venv", "venv", "env", ".tox", ".mypy_cache", ".pytest_cache", "site-packages",
  ".next", ".nuxt", "bower_components", "public/build", "static/dist", ".eggs", "migrations",
]);
// La deuda en el código de pruebas está fuera del alcance (Sección 5): se excluyen por defecto.
const INCLUDE_TESTS = process.env.TDR_INCLUDE_TESTS === "1";
const TEST_DIRS = new Set(["test", "tests", "__tests__", "spec", "specs", "testing", "e2e", "test-d"]);
const TEST_FILES = /(^test_.*.py$|_test.py$|.(test|spec).[cm]?[jt]sx?$|^conftest.py$)/i;
const EXCLUDED_FILES = /(\.min\.(js|mjs|cjs)$|\.bundle\.js$|\.d\.ts$|-lock\.|\.map$|^bundle\.js$)/i;

export class UserInputError extends Error {}

/**
 * Normaliza una URL de GitHub. Acepta:
 *   https://github.com/owner/repo, github.com/owner/repo, owner/repo,
 *   con o sin .git, /tree/<rama>, barra final.
 */
export function parseGithubUrl(input) {
  if (typeof input !== "string") throw new UserInputError("Debes enviar la URL del repositorio.");
  let s = input.trim();
  if (!s) throw new UserInputError("Pega la URL de un repositorio público de GitHub.");
  s = s.replace(/^git@github\.com:/i, "github.com/");
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (!/^github\.com\//i.test(s)) {
    if (/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\/?$/.test(s)) s = "github.com/" + s;
    else throw new UserInputError("Solo se admiten repositorios de github.com (por ejemplo github.com/pallets/flask).");
  }
  const parts = s.replace(/^github\.com\//i, "").split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) throw new UserInputError("La URL debe tener la forma github.com/<usuario>/<repositorio>.");
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo) || repo === "." || repo === "..") {
    throw new UserInputError("El nombre de usuario o de repositorio no es válido.");
  }
  let branch = null;
  if (parts[2] === "tree" && parts[3]) branch = parts.slice(3).join("/");
  if (branch && !/^[A-Za-z0-9._\/-]{1,200}$/.test(branch)) throw new UserInputError("Nombre de rama no válido.");
  return { owner, repo, branch, slug: `${owner}/${repo}`, cloneUrl: `https://github.com/${owner}/${repo}.git` };
}

function run(cmd, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new UserInputError(`La clonación superó el tiempo límite (${Math.round(timeoutMs / 1000)} s). Prueba con un repositorio más pequeño.`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err.code === "ENOENT" ? new Error("No se encontró `git` instalado en el servidor.") : err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`git terminó con código ${code}`), { stderr }));
    });
  });
}

/** Clona (depth 1) el repositorio en un directorio temporal. Devuelve { dir, commit, branch, cleanup }. */
export async function cloneRepo(parsed) {
  const dir = await mkdtemp(path.join(tmpdir(), "tdr-"));
  const cleanup = () => rm(dir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  const args = ["-c", "credential.helper=", "clone", "--depth", "1", "--single-branch", "--no-tags"];
  if (parsed.branch) args.push("--branch", parsed.branch);
  args.push(parsed.cloneUrl, dir);
  try {
    await run("git", args, { timeoutMs: LIMITS.cloneTimeoutMs });
  } catch (err) {
    await cleanup();
    if (err instanceof UserInputError) throw err;
    const msg = String(err.stderr || err.message);
    if (/not found|could not read Username|Authentication failed|terminal prompts disabled|Repository not found/i.test(msg)) {
      throw new UserInputError(`No se encontró el repositorio ${parsed.slug} o no es público.`);
    }
    if (/Remote branch .* not found/i.test(msg)) throw new UserInputError(`La rama "${parsed.branch}" no existe en ${parsed.slug}.`);
    throw new Error(`No se pudo clonar ${parsed.slug}: ${msg.trim().split("\n").pop()}`);
  }
  let commit = null;
  let branch = parsed.branch;
  try {
    commit = (await run("git", ["rev-parse", "--short", "HEAD"], { cwd: dir, timeoutMs: 10_000 })).stdout.trim();
    if (!branch) branch = (await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir, timeoutMs: 10_000 })).stdout.trim();
  } catch { /* no crítico */ }
  return { dir, commit, branch, cleanup };
}

/** Recorre el directorio y lee los archivos .py/.js/.ts soportados, aplicando los límites. */
export async function collectSourceFiles(root) {
  const files = [];
  const skipped = { tooLarge: 0, excluded: 0, overLimit: 0, tests: 0 };
  let totalBytes = 0;

  async function walk(rel) {
    const abs = path.join(root, rel);
    let entries;
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue; // no seguimos enlaces simbólicos (entrada no confiable)
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name) || EXCLUDED_DIRS.has(relPath) || e.name.startsWith(".")) { skipped.excluded++; continue; }
        if (!INCLUDE_TESTS && TEST_DIRS.has(e.name.toLowerCase())) { skipped.tests++; continue; }
        await walk(relPath);
      } else if (e.isFile()) {
        if (!languageOf(e.name)) continue;
        if (EXCLUDED_FILES.test(e.name)) { skipped.excluded++; continue; }
        if (!INCLUDE_TESTS && TEST_FILES.test(e.name)) { skipped.tests++; continue; }
        if (files.length >= LIMITS.maxFiles) { skipped.overLimit++; continue; }
        const st = await stat(path.join(root, relPath));
        if (st.size > LIMITS.maxFileBytes) { skipped.tooLarge++; continue; }
        if (totalBytes + st.size > LIMITS.maxTotalBytes) { skipped.overLimit++; continue; }
        const source = await readFile(path.join(root, relPath), "utf8");
        // Heurística de archivo minificado/generado: líneas extremadamente largas
        const lines = source.split("\n");
        const avg = source.length / Math.max(1, lines.length);
        if (avg > 300) { skipped.excluded++; continue; }
        totalBytes += st.size;
        files.push({ path: relPath, source });
      }
    }
  }
  await walk("");
  return { files, skipped };
}

/** Lee el README (si existe) para dar contexto al LLM. */
export async function readReadme(root) {
  for (const name of ["README.md", "README.rst", "README.txt", "README", "readme.md"]) {
    try {
      const txt = await readFile(path.join(root, name), "utf8");
      return txt.slice(0, 1500);
    } catch { /* siguiente */ }
  }
  return "";
}
