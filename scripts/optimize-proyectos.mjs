// Fachadas de los TRES desarrollos de TIER (Bravo, Avenue, Sinclair).
//
// POR QUÉ TIENE SU PROPIO SCRIPT. `gallery:optimize` sirve a la galería de ESTE
// edificio (el lightbox del menú) y reescribe `src/data/gallery.json`; meter acá las
// fachadas de los otros dos proyectos las mandaría a esa galería, donde no pintan
// nada. `unidades:optimize` es el hero de las unidades. Estas tres son otra cosa: el
// portfolio de la MARCA, y se consumen en tres lugares distintos del sitio.
//
// DÓNDE SE USAN (por eso las tres variantes):
//   `<id>.webp`        → panel de la PORTADA ("/"). Es full-bleed y a pantalla
//                        completa en escritorio, así que es la que manda el tamaño.
//   `<id>-mid.webp`    → tarjeta del portfolio en "El Equipo" (sidebar de la ficha).
//   `<id>-thumb.webp`  → miniatura del popup del MAPA de Ubicación.
//
// EL `<id>` ES LA KEY: coincide con el `id` de cada proyecto en src/data/proyectos.ts
// (bravo · avenue · sinclair). Así el componente arma la ruta sola y sumar un cuarto
// desarrollo es dejar el master acá y agregarlo a ese archivo.
//
// ⚠ Los masters son VERTICALES (Avenue 3500×5000, Sinclair 2800×4000) y el de Bravo
// HORIZONTAL (4000×2250). Se emiten SIN recortar: el encuadre lo hace el CSS con
// `object-fit: cover`, que es lo que ya usan la portada y el resto del sitio. Si
// alguna queda mal encuadrada en un lugar puntual, se ajusta con `object-position`
// ahí, no rehaciendo el derivado.
//
// Uso:  npm run proyectos:optimize
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC_DIR = join(ROOT, "_media-src", "proyectos");
const OUT_DIR = join(ROOT, "public", "proyectos");

// La portada muestra los TRES paneles a la vez y es lo PRIMERO que carga el visitante,
// así que acá el peso se paga en el momento más caro. Los números salen de medir los
// tres masters, no de tantear:
//   2000/q78 → 524+520+334 = 1378 KB     1600/q74 → 305+306+202 = 813 KB  (−41%)
// Un panel de escritorio mide ~640×1080 CSS, así que 1120×1600 lo cubre a ~1,75x de
// densidad — de sobra para una fachada, que es cielo y superficies planas. Bajar más
// (1400/q72 → 634 KB) ya se empieza a notar en los degradés del cielo.
const MAX_FULL = 1600;
const FULL_Q = 74;
// Doble uso: la tarjeta de "El Equipo" (se ve a ~360px) y la fuente del `srcset` de
// la portada en CELULAR, donde el panel es una franja de 1/3 de pantalla y bajar la
// variante grande sería tirar los datos del visitante.
const MID_W = 720;
const MID_Q = 76;
// El popup del mapa es chico y puede haber tres a la vez.
const THUMB_W = 240;
const THUMB_Q = 70;

const IMG_RE = /\.(jpe?g|png|webp|tiff?)$/i;

if (!existsSync(SRC_DIR)) {
  console.error(
    `No existe ${SRC_DIR} — dejá ahí las fachadas, nombradas con el id del proyecto ` +
      `(bravo.jpg, avenue.jpg, sinclair.jpg).`,
  );
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
console.log(`Fuente: ${SRC_DIR}  (${files.length} fachadas)\n`);

let total = 0;
for (const file of files) {
  const input = join(SRC_DIR, file);
  const slug = basename(file, extname(file));
  const meta = await sharp(input).metadata();

  const full = await sharp(input)
    .resize({ width: MAX_FULL, height: MAX_FULL, fit: "inside", withoutEnlargement: true })
    .webp({ quality: FULL_Q })
    .toFile(join(OUT_DIR, `${slug}.webp`));

  const mid = await sharp(input)
    .resize({ width: MID_W, withoutEnlargement: true })
    .webp({ quality: MID_Q })
    .toFile(join(OUT_DIR, `${slug}-mid.webp`));

  const thumb = await sharp(input)
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: THUMB_Q })
    .toFile(join(OUT_DIR, `${slug}-thumb.webp`));

  total += full.size + mid.size + thumb.size;
  console.log(
    `${file.padEnd(16)} ${meta.width}×${meta.height} → ` +
      `${slug}.webp (${full.width}×${full.height}, ${kb(full.size)}) · ` +
      `-mid (${kb(mid.size)}) · -thumb (${kb(thumb.size)})`,
  );
}

console.log(`\n✓ ${files.length} fachadas → ${OUT_DIR}  ·  ${kb(total)} en total`);
console.log("· la portada y 'El Equipo' las toman de `poster` en src/data/proyectos.ts");
console.log("· el mapa de Ubicación usa la variante -thumb en el popup de cada proyecto");
