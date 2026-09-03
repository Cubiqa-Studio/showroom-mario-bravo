// ─────────────────────────────────────────────────────────────────────────────
// Previsualiza `out/` COMO LO VA A SERVIR HOSTINGER, antes de subir nada.
//
//   npm run preview:static        → http://localhost:4321
//
// Implementa las mismas reglas que deploy/hostinger/.htaccess:
//   · DirectoryIndex index.html
//   · URL sin extensión → el .html horneado (/showroom → out/showroom.html)
//   · 404 → out/404.html con status 404
//   · Content-Type JSON para las plantas horneadas (out/api/plate/<piso>)
//   · el mismo Cache-Control por tipo de archivo
//
// Y hace de STAND-IN del proxy PHP (que en local no se puede correr) para
// /api/unidades y /api/avance: le pega a Airtable con el token de .env.local y
// devuelve EXACTAMENTE el mismo contrato que el PHP (`{ records: [...] }` crudos).
// Así se verifica de punta a punta que el sitio estático levanta la data en vivo.
//
// ⚠ Es una herramienta de DESARROLLO. No es el servidor de producción (en producción
// no hay Node: el HTML lo sirve Apache y los endpoints, PHP). /api/contact NO está
// implementado acá a propósito: mandar mails de prueba desde una previsualización
// es justo lo que no querés. Para probar el formulario, usá `next dev`.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Por defecto sirve out/. Se le puede pasar otra carpeta como argumento — útil para
// servir un DEPLOY.zip YA EXTRAÍDO y comprobar que lo que se sube está sano, que es
// donde apareció el bug de los separadores "\" en los nombres del zip.
//   node scripts/serve-static.mjs /ruta/al/zip-extraido
const RAIZ = process.argv[2]
  ? resolve(process.argv[2])
  : join(fileURLToPath(new URL("../", import.meta.url)), "out");
const PUERTO = Number(process.env.PORT ?? 4321);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};

const CACHE_LARGA = "public, max-age=86400, stale-while-revalidate=2592000";
const ASSETS = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".mp4", ".woff2"]);

function cacheControl(rutaUrl, ext) {
  if (rutaUrl.startsWith("/_next/static/")) return "public, max-age=31536000, immutable";
  if (ext === ".html" || ext === ".txt") return "public, max-age=0, must-revalidate";
  if (ASSETS.has(ext)) return CACHE_LARGA;
  return "public, max-age=3600";
}

async function esArchivo(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

// ── Stand-in del proxy PHP: Airtable con el token de .env.local ───────────────

async function leerEnvLocal() {
  const env = {};
  try {
    const crudo = await readFile(join(fileURLToPath(new URL("../", import.meta.url)), ".env.local"), "utf8");
    for (const linea of crudo.split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env.local → los endpoints devuelven records: [] */
  }
  return env;
}

const ENV = await leerEnvLocal();

async function airtableRecords(tabla) {
  const token = ENV.AIRTABLE_TOKEN;
  const baseId = ENV.AIRTABLE_BASE_ID;
  if (!token || !baseId || !tabla) return null;
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tabla)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn(`[preview] Airtable ${res.status} en "${tabla}"`);
      return null;
    }
    const data = await res.json();
    if (data.records) records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function json(res, datos, status = 200) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
    "Content-Length": Buffer.byteLength(cuerpo),
  });
  res.end(cuerpo);
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PUERTO}`);
  let rutaUrl = decodeURIComponent(url.pathname);

  // Endpoints que en producción atiende el PHP.
  if (rutaUrl === "/api/unidades" || rutaUrl === "/api/avance") {
    const tabla =
      rutaUrl === "/api/unidades" ? ENV.AIRTABLE_UNITS_TABLE_ID : ENV.AIRTABLE_AVANCE_TABLE_ID;
    const records = await airtableRecords(tabla);
    if (records === null) {
      console.log(`[preview] ${rutaUrl} → records: [] (sin token/tabla o Airtable caído)`);
      return json(res, { records: [] });
    }
    console.log(`[preview] ${rutaUrl} → ${records.length} registros de Airtable`);
    return json(res, { records, count: records.length });
  }
  if (rutaUrl === "/api/contact") {
    console.log("[preview] /api/contact NO está implementado en la previsualización.");
    return json(res, { error: "En la previsualización no se mandan mails. Usá `next dev`." }, 501);
  }

  // Evita escaparse de out/ con "..".
  if (normalize(rutaUrl).includes("..")) {
    res.writeHead(400).end("Bad request");
    return;
  }

  const candidatos = [];
  const sinBarra = rutaUrl.replace(/\/+$/, "");
  if (rutaUrl.endsWith("/") || rutaUrl === "") candidatos.push(join(RAIZ, rutaUrl, "index.html"));
  candidatos.push(join(RAIZ, rutaUrl));
  // La regla del .htaccess: si no existe el archivo, probar <path>.html
  if (sinBarra) candidatos.push(join(RAIZ, `${sinBarra}.html`));
  candidatos.push(join(RAIZ, rutaUrl, "index.html"));

  for (const p of candidatos) {
    if (!(await esArchivo(p))) continue;
    const ext = extname(p).toLowerCase();
    // Las plantas horneadas no tienen extensión → JSON explícito, igual que el
    // env=PLATE_JSON del .htaccess.
    const tipo = ext
      ? (TIPOS[ext] ?? "application/octet-stream")
      : rutaUrl.startsWith("/api/plate/")
        ? "application/json; charset=utf-8"
        : "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": tipo,
      "Cache-Control": cacheControl(rutaUrl, ext),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    createReadStream(p).pipe(res);
    return;
  }

  // ErrorDocument 404 /404.html
  const p404 = join(RAIZ, "404.html");
  if (await esArchivo(p404)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    createReadStream(p404).pipe(res);
    return;
  }
  res.writeHead(404).end("Not found");
});

if (!(await esArchivo(join(RAIZ, "index.html")))) {
  console.error(`No encuentro ${join(RAIZ, "index.html")}. Corré \`npm run build\` primero.`);
  process.exit(1);
}

servidor.listen(PUERTO, () => {
  console.log(`Previsualización del export estático en http://localhost:${PUERTO}`);
  console.log(`Sirviendo ${RAIZ} con las reglas de deploy/hostinger/.htaccess.`);
});
