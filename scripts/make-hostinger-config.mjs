// ─────────────────────────────────────────────────────────────────────────────
// Genera `showroom-config.php` (los secretos del proxy) a partir de .env.local.
//
//   npm run deploy:config
//
// Se escribe en la raíz del repo, gitignoreado, y SIN BOM — que es la razón por la
// que existe este script en vez de copiar el ejemplo a mano: `Set-Content -Encoding
// utf8` de PowerShell y el Notepad le meten un BOM que rompe todos los endpoints
// (ver la nota en deploy/hostinger/api/_lib.php).
//
// ⚠ El archivo generado tiene SECRETOS. Va FUERA del doc root en el server (al lado
// de public_html, no adentro) y no se commitea.
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const DESTINO = join(RAIZ, "showroom-config.php");

const env = {};
try {
  const crudo = await readFile(join(RAIZ, ".env.local"), "utf8");
  for (const linea of crudo.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("No pude leer .env.local. Copiá .env.example y completalo primero.");
  process.exit(1);
}

/** Escapa para un string PHP entre comillas simples. */
const php = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const faltan = [];
const pedir = (clave, obligatoria = true) => {
  const v = env[clave] ?? "";
  if (!v && obligatoria) faltan.push(clave);
  return v;
};

const cfg = {
  airtable_token: pedir("AIRTABLE_TOKEN"),
  airtable_base_id: pedir("AIRTABLE_BASE_ID"),
  airtable_units_table: pedir("AIRTABLE_UNITS_TABLE_ID"),
  airtable_avance_table: pedir("AIRTABLE_AVANCE_TABLE_ID", false),
  resend_api_key: pedir("RESEND_API_KEY", false),
  email_to: pedir("EMAIL_TO", false),
  email_to_inmobiliaria: pedir("EMAIL_TO_INMOBILIARIA", false),
  email_from: pedir("EMAIL_FROM", false),
};

const contenido = `<?php
// GENERADO por \`npm run deploy:config\` desde .env.local — NO commitear.
// Va FUERA del doc root: ~/domains/<dominio>/showroom-config.php
// (al lado de public_html, NO adentro). Ver deploy/README-hostinger.md.

return [
    // ── Airtable — data EN VIVO (estado, precio, ambientes, superficies) ──────
    'airtable_token'        => '${php(cfg.airtable_token)}',
    'airtable_base_id'      => '${php(cfg.airtable_base_id)}',
    'airtable_units_table'  => '${php(cfg.airtable_units_table)}',
    'airtable_avance_table' => '${php(cfg.airtable_avance_table)}',

    // ── Resend — emails de los formularios de contacto ───────────────────────
    // Sin resend_api_key + email_to, /api/contact responde 500 y NO entran leads.
    'resend_api_key'        => '${php(cfg.resend_api_key)}',
    'email_to'              => '${php(cfg.email_to)}',
    'email_to_inmobiliaria' => '${php(cfg.email_to_inmobiliaria)}',
    'email_from'            => '${php(cfg.email_from)}',

    // Vacío = el sitio y el PHP viven en el mismo dominio (el caso normal).
    'allowed_origins'       => [],
];
`;

// utf8 sin BOM: writeFile no agrega BOM nunca.
await writeFile(DESTINO, contenido, "utf8");

const bytes = Buffer.from(contenido, "utf8");
const conBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

console.log(`showroom-config.php escrito en la raíz del repo (sin BOM: ${!conBom}).`);
console.log(`  ${DESTINO}`);
console.log(`\nSubilo UN NIVEL ARRIBA de public_html. No va dentro del zip ni en git.`);

if (faltan.length) {
  console.error(`\n✖ Faltan en .env.local: ${faltan.join(", ")} — sin esto no hay data en vivo.`);
  process.exit(1);
}
if (!cfg.resend_api_key || !cfg.email_to) {
  const cuales = [!cfg.resend_api_key && "RESEND_API_KEY", !cfg.email_to && "EMAIL_TO"]
    .filter(Boolean)
    .join(" y ");
  console.warn(
    `\n⚠ Sin ${cuales}: el formulario de contacto va a devolver error y NO se reciben\n` +
      `  leads. El resto del sitio funciona igual. Completalo en .env.local y volvé a\n` +
      `  correr este script (no hace falta rebuildear: el config es del PHP, no del build).`,
  );
}
