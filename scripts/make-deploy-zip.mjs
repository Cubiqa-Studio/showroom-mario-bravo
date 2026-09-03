// ─────────────────────────────────────────────────────────────────────────────
// Arma DEPLOY.zip: lo que se sube a public_html de Hostinger, en un solo archivo.
//
//   npm run build
//   npm run deploy:zip            → deploy de PRODUCCIÓN (indexable)
//   npm run deploy:zip -- --test  → deploy de PRUEBA (agrega noindex)
//
// Contenido del zip = el CONTENIDO de out/ + los .php del proxy + el .htaccess.
// Se extrae DENTRO de public_html (los archivos quedan en la raíz del doc root).
//
// ⚠ El `showroom-config.php` con los secretos NO va en el zip a propósito: tiene
// que quedar FUERA del doc root. Se sube aparte, un nivel arriba de public_html.
//
// El default es PRODUCCIÓN (sin noindex) a propósito, aunque lo más común mientras
// se prueba sea `--test`. La asimetría manda: olvidarse el `--test` en una prueba
// hace que Google indexe el subdominio de prueba (molesto, se arregla); olvidarse
// un `--prod` en producción dejaría el sitio real con noindex y sin tráfico, en
// silencio y por tiempo indefinido. Mejor que el olvido caiga del lado barato.
// ─────────────────────────────────────────────────────────────────────────────

import { cp, mkdir, rm, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(RAIZ, "out");
const HOSTINGER = join(RAIZ, "deploy", "hostinger");
const STAGING = join(RAIZ, ".deploy-staging");
const ZIP = join(RAIZ, "DEPLOY.zip");

const ES_PRUEBA = process.argv.includes("--test");

// Bloque que se le agrega al .htaccess SÓLO en los deploys de prueba. Sin esto,
// Google puede indexar el subdominio de prueba y competir con el sitio real por
// las mismas queries (contenido duplicado, señales divididas).
const NOINDEX = `

# ── DEPLOY DE PRUEBA — QUITAR ESTE BLOQUE EN PRODUCCIÓN ───────────────────────
# Lo agrega \`npm run deploy:zip -- --test\`. Bloquea la indexación del subdominio
# de prueba, para que no compita con el sitio real por las mismas queries.
# El X-Robots-Tag pesa igual que un <meta robots noindex> y cubre TODO (incluido
# el sitemap.xml y los .txt), así que no hace falta tocar robots.ts.
<IfModule mod_headers.c>
  Header set X-Robots-Tag "noindex, nofollow, noarchive"
</IfModule>
`;

async function existe(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function contar(dir) {
  let archivos = 0;
  let bytes = 0;
  for (const entrada of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entrada.isFile()) {
      archivos++;
      bytes += (await stat(join(entrada.parentPath ?? entrada.path, entrada.name))).size;
    }
  }
  return { archivos, bytes };
}

if (!(await existe(join(OUT, "index.html")))) {
  console.error(`No encuentro ${join(OUT, "index.html")}. Corré \`npm run build\` primero.`);
  process.exit(1);
}

console.log(`Armando DEPLOY.zip — modo ${ES_PRUEBA ? "PRUEBA (con noindex)" : "PRODUCCIÓN (indexable)"}`);

await rm(STAGING, { recursive: true, force: true });
await mkdir(STAGING, { recursive: true });

// 1. Todo el export estático.
await cp(OUT, STAGING, { recursive: true });

// 2. Los .php del proxy. Van DESPUÉS de out/ porque out/ ya trae un api/ (con las
//    plantas horneadas) y no queremos que uno pise al otro: se fusionan.
await cp(join(HOSTINGER, "api"), join(STAGING, "api"), { recursive: true });

// 3. El .htaccess (+ noindex si es prueba).
let htaccess = await readFile(join(HOSTINGER, ".htaccess"), "utf8");
if (ES_PRUEBA) htaccess += NOINDEX;
await writeFile(join(STAGING, ".htaccess"), htaccess, "utf8");

// 4. El _headers de Netlify no hace nada en Apache y sólo confunde.
await rm(join(STAGING, "_headers"), { force: true });

// 5. Instrucciones, para que el zip se explique solo dentro de seis meses.
await writeFile(
  join(STAGING, "LEEME-DEPLOY.txt"),
  `Showroom TIER Bravo — contenido para public_html
${"=".repeat(60)}

Modo de este paquete: ${ES_PRUEBA ? "PRUEBA (lleva X-Robots-Tag noindex)" : "PRODUCCIÓN (indexable)"}
Generado desde: npm run build && npm run deploy:zip${ES_PRUEBA ? " -- --test" : ""}

COMO SE SUBE
------------
1. En el File Manager de Hostinger, entrá a public_html/ y subí DEPLOY.zip ahí
   adentro. Extraelo: los archivos tienen que quedar en la RAIZ de public_html
   (que se vea public_html/index.html, no public_html/DEPLOY/index.html).
2. Borrá el DEPLOY.zip del server cuando termines.
3. Subí showroom-config.php UN NIVEL ARRIBA de public_html (queda al lado, NO
   adentro). Ese archivo NO viene en este zip a proposito: tiene los secretos y
   dentro del doc root seria alcanzable por URL si PHP alguna vez falla.

   ~/domains/<dominio>/
   |- public_html/          <- este zip, extraido aca
   \\- showroom-config.php   <- el de secretos, aca

QUE VERIFICAR DESPUES
---------------------
  /                     -> carga la portada
  /showroom             -> carga el recorrido (prueba el rewrite del .htaccess)
  /residencia/101       -> carga la ficha
  /residencia/9999      -> 404 con la pagina 404 del sitio
  /api/unidades         -> {"records":[...]}  (esto prueba el PHP + Airtable)
  /api/plate/5          -> {"plate":{...}}    (archivo estatico horneado)

  En el navegador: click en una unidad -> abre la ficha encima con zoom y la URL
  pasa a /residencia/<id> sin recargar. El back cierra con zoom-out.

  Y manda una consulta desde "Hablemos" para probar Resend.

El detalle completo esta en deploy/README-hostinger.md del repo.
${
  ES_PRUEBA
    ? `
ATENCION - ESTE PAQUETE ES DE PRUEBA
------------------------------------
El .htaccess incluye "X-Robots-Tag: noindex, nofollow" al final, asi que Google
NO va a indexar este subdominio. Para el deploy real, regenera el zip sin la
bandera --test (o borra ese bloque del .htaccess a mano).
`
    : ""
}`,
  "utf8",
);

const { archivos, bytes } = await contar(STAGING);

// 6. Comprimir. Compress-Archive en Windows, zip en el resto.
await rm(ZIP, { force: true });
if (process.platform === "win32") {
  await ejecutar(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${STAGING}\\*' -DestinationPath '${ZIP}' -CompressionLevel Optimal -Force`,
    ],
    { maxBuffer: 1024 * 1024 * 64 },
  );
} else {
  await ejecutar("zip", ["-qr", ZIP, "."], { cwd: STAGING, maxBuffer: 1024 * 1024 * 64 });
}

await rm(STAGING, { recursive: true, force: true });

const zipBytes = (await stat(ZIP)).size;
const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`\nDEPLOY.zip listo: ${mb(zipBytes)} MB (${archivos} archivos, ${mb(bytes)} MB sin comprimir)`);
console.log(`  ${ZIP}`);
console.log(`\nSe extrae DENTRO de public_html. El showroom-config.php va aparte, un nivel arriba.`);
if (ES_PRUEBA) console.log(`\n⚠ Lleva noindex: Google NO va a indexar este deploy.`);
