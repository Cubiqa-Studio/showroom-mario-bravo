// Renders del HERO de las unidades SIN recorrido 360° (las 13 del 6° y el 7°).
//
// POR QUÉ NO VAN POR `gallery:optimize`. Ese script sirve a la galería del PROYECTO
// (el lightbox del menú lateral): lee `_media-src/gallery/`, BORRA `public/gallery/
// optimized/` entero en cada corrida y reescribe `src/data/gallery.json`, que es el
// orden que ve el visitante. Estos cuatro renders son de la MISMA escena (el living
// del 7° con su terraza) y meterlos ahí dejaría cuatro cuadros casi iguales en la
// galería del edificio. Van a su propia carpeta y no tocan ese manifiesto.
//
// Emite las mismas tres variantes que la galería, porque el hero las usa igual:
//   `<slug>.webp`        full (long-edge ≤ MAX_FULL) → imagen grande y lightbox
//   `<slug>-mid.webp`    800px  → los tres mosaicos del hero (se ven a ≤340px)
//   `<slug>-thumb.webp`  320px  → la tira de miniaturas del lightbox
//
// El ORDEN es el del nombre: el `01-` es la imagen grande del hero y los `02-04`
// los tres mosaicos (ver DEFAULT_HERO_VIEWS en src/lib/residencia.ts).
//
// Uso:  npm run unidades:optimize
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC_DIR = join(ROOT, "_media-src", "unidades");
const OUT_DIR = join(ROOT, "public", "unidades");

const MAX_FULL = 2400;
const FULL_Q = 80;
const MID_W = 800;
const MID_Q = 78;
const THUMB_W = 320;
const THUMB_Q = 70;

const IMG_RE = /\.(jpe?g|png|webp|tiff?)$/i;

if (!existsSync(SRC_DIR)) {
  console.error(`No existe ${SRC_DIR} — dejá ahí los renders de unidad del cliente.`);
  process.exit(1);
}

const files = readdirSync(SRC_DIR)
  .filter((f) => IMG_RE.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (files.length === 0) {
  console.error(`No se encontraron imágenes en ${SRC_DIR}`);
  process.exit(1);
}

// Empezar limpio: si cambian los nombres, no quedan derivados huérfanos.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`Fuente: ${SRC_DIR}  (${files.length} imágenes)\n`);

for (const file of files) {
  const input = join(SRC_DIR, file);
  const slug = basename(file, extname(file));
  const meta = await sharp(input).metadata();

  const full = await sharp(input)
    .resize({ width: MAX_FULL, height: MAX_FULL, fit: "inside", withoutEnlargement: true })
    .webp({ quality: FULL_Q })
    .toFile(join(OUT_DIR, `${slug}.webp`));

  await sharp(input)
    .resize({ width: MID_W, withoutEnlargement: true })
    .webp({ quality: MID_Q })
    .toFile(join(OUT_DIR, `${slug}-mid.webp`));

  await sharp(input)
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: THUMB_Q })
    .toFile(join(OUT_DIR, `${slug}-thumb.webp`));

  console.log(
    `${file.padEnd(34)} ${meta.width}×${meta.height} → ${slug}.webp ` +
      `(${full.width}×${full.height}, ${kb(full.size)}) + -mid + -thumb`,
  );
}

console.log(`\n✓ ${files.length} renders → ${OUT_DIR}`);
console.log("· el hero de las unidades sin 360° los toma desde DEFAULT_HERO_VIEWS (src/lib/residencia.ts)");
