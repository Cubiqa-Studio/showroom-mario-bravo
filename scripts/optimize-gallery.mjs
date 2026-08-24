// Optimiza los renders de la galería del menú (lightbox).
//
// Los originales que manda el cliente son JPG pesados (~1.5–2.5 MB c/u, ~14 MB el
// set). El lightbox abría TODOS de una para dibujar la tira de miniaturas → 14 MB
// de golpe. Este script genera, por cada original, DOS derivados WebP en
// `public/gallery/optimized/`:
//   - `<slug>.webp`        full optimizado (long-edge ≤ MAX_FULL, calidad ~80)
//   - `<slug>-thumb.webp`  miniatura (ancho THUMB_W) para la tira (~20 KB)
// y un manifiesto `src/data/gallery.json` que consume `site.ts` (orden + tamaños).
//
// Fuente: `_media-src/gallery/` (gitignored, fuera del deploy) si existe; si no,
// los originales sueltos en `public/gallery/` (ignora la subcarpeta optimized/).
// Sólo se commitean los derivados + el manifiesto → /public queda liviano.
//
// Uso:  npm run gallery:optimize
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MEDIA_SRC = join(ROOT, "_media-src", "gallery");
const PUBLIC_DIR = join(ROOT, "public", "gallery");
const OUT_DIR = join(PUBLIC_DIR, "optimized");
const MANIFEST = join(ROOT, "src", "data", "gallery.json");

const MAX_FULL = 2400; // long-edge del full (cubre full-screen retina sin engordar)
const FULL_Q = 80; // calidad WebP del full
const THUMB_W = 320; // ancho de la miniatura (display 96×64 → ok hasta 3×)
const THUMB_Q = 70; // calidad WebP de la miniatura

const IMG_RE = /\.(jpe?g|png|webp|tiff?)$/i;

// Slug legible y URL-safe a partir del nombre: "...View 03_b.jpg" → "view-03b".
// Si no matchea el patrón "View NN", cae a un slug del basename completo.
function slugFor(file) {
  const stem = basename(file, extname(file));
  // "View NN" + sufijo de UNA sola letra ("_b") — el (?![a-z]) evita capturar la
  // primera letra de palabras como "_con personas" (que daría "view-01c").
  const m = stem.match(/view\s*[_-]?\s*(\d+)\s*(?:[_-]\s*([a-z])(?![a-z]))?/i);
  if (m) return `view-${m[1].padStart(2, "0")}${m[2] ? m[2].toLowerCase() : ""}`;
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Carpeta fuente: _media-src/gallery si tiene imágenes, si no public/gallery.
function pickSourceDir() {
  if (existsSync(MEDIA_SRC) && readdirSync(MEDIA_SRC).some((f) => IMG_RE.test(f))) {
    return MEDIA_SRC;
  }
  return PUBLIC_DIR;
}

const srcDir = pickSourceDir();
const files = readdirSync(srcDir)
  .filter((f) => IMG_RE.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (files.length === 0) {
  console.error(`No se encontraron imágenes en ${srcDir}`);
  process.exit(1);
}

// Empezar limpio: borra derivados previos para no dejar huérfanos si cambian los
// nombres/slugs de los originales (idempotente).
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
console.log(`Fuente: ${srcDir}  (${files.length} imágenes)\n`);

const images = [];
const seen = new Set();

for (const file of files) {
  const input = join(srcDir, file);
  let slug = slugFor(file);
  // Evitar colisiones de slug (dos fuentes que mapean al mismo nombre). Avisar:
  // suele indicar dos originales con el mismo número de vista.
  if (seen.has(slug)) {
    let n = 2;
    const base = slug;
    while (seen.has(slug)) slug = `${base}-${n++}`;
    console.warn(`⚠ slug duplicado para "${file}" → usando "${slug}" (¿números de vista repetidos?)`);
  }
  seen.add(slug);

  const meta = await sharp(input).metadata();

  // Full optimizado: nunca agrandar (withoutEnlargement), long-edge ≤ MAX_FULL.
  const fullName = `${slug}.webp`;
  const fullInfo = await sharp(input)
    .resize({ width: MAX_FULL, height: MAX_FULL, fit: "inside", withoutEnlargement: true })
    .webp({ quality: FULL_Q })
    .toFile(join(OUT_DIR, fullName));

  // Miniatura.
  const thumbName = `${slug}-thumb.webp`;
  await sharp(input)
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: THUMB_Q })
    .toFile(join(OUT_DIR, thumbName));

  images.push({
    full: `/gallery/optimized/${fullName}`,
    thumb: `/gallery/optimized/${thumbName}`,
    width: fullInfo.width,
    height: fullInfo.height,
  });

  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(
    `${file.padEnd(42)} ${meta.width}×${meta.height} → ${fullName} ` +
      `(${fullInfo.width}×${fullInfo.height}, ${kb(fullInfo.size)})`,
  );
}

// Orden de exhibición por nombre final (01,02,03,03b,04,…). Numérico para que
// aguante 100+ vistas (view-100 después de view-99), consistente con el read inicial.
images.sort((a, b) => a.full.localeCompare(b.full, undefined, { numeric: true }));

writeFileSync(MANIFEST, JSON.stringify({ images }, null, 2) + "\n");
console.log(`\n✓ ${images.length} imágenes → ${OUT_DIR}`);
console.log(`✓ manifiesto → ${MANIFEST}`);
