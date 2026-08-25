// Genera las variantes de logo que consume la app, desde el SVG maestro de la marca.
//
// El cliente entrega el wordmark en dos colores planos (negro y blanco). La app
// necesita TRES, porque los usa sobre fondos distintos:
//   - `logo.png`         oro  → superficies CLARAS (nav de la ficha, modal de
//                               contacto, plano, 404). Es el look de la marca.
//   - `logo_b_n.png`     ink  → donde se pide explícitamente monocromo (ContactSection).
//   - `logo_blanco.png`  blanco → sobre los renders del showroom, que son oscuros.
//     Un oro a 3.7:1 se pierde contra un cielo claro; el blanco con drop-shadow lee
//     en cualquier frame del flyby.
//
// Se rasteriza del SVG (vector) a alta densidad y se recorta al bounding box real:
// el archivo del cliente trae ~40% de margen vacío que, sin recortar, se come la
// altura útil en la nav (el logo se ve chico y descentrado).
//
// Uso:  node scripts/make-brand-assets.mjs      (o `npm run brand:logos`)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC_SVG = join(ROOT, "_media-src", "logos", "tier-negro.svg");
const OUT_DIR = join(ROOT, "public");

/** Ancho del PNG servido. La nav lo muestra a 52px de alto → 4× sobra para retina. */
const WIDTH = 900;

/** Variantes: nombre de salida → color del wordmark. Espejan los tokens de la paleta. */
const VARIANTS = [
  ["logo.png", "#A07F46"], // --gold
  ["logo_b_n.png", "#0F0F11"], // --ink
  ["logo_blanco.png", "#FFFFFF"],
];

if (!existsSync(SRC_SVG)) {
  console.error(`Falta el SVG maestro: ${SRC_SVG}`);
  process.exit(1);
}

const master = readFileSync(SRC_SVG, "utf8");

/** Reescribe el fill del SVG. El archivo del cliente lo declara en una clase CSS
 *  (`.cls-1{fill:#1d1d1b;}`), así que se pisa ahí — no hay atributos `fill` sueltos. */
function recolor(svg, color) {
  const out = svg.replace(/fill\s*:\s*#[0-9a-f]{3,8}/gi, `fill:${color}`);
  if (out === svg) {
    console.error("No se pudo recolorear el SVG: no se encontró ninguna declaración `fill:`.");
    process.exit(1);
  }
  return out;
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

for (const [name, color] of VARIANTS) {
  const svg = Buffer.from(recolor(master, color));
  // `trim` sobre el rasterizado recorta el margen transparente del artboard. El
  // umbral bajo evita comerse el antialias del borde de las letras.
  const png = await sharp(svg, { density: 600 })
    .resize({ width: WIDTH })
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(png).metadata();
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`public/${name.padEnd(18)} ${meta.width}×${meta.height}  ${color}  ${kb(png.length)}`);
}

console.log("\n✓ variantes de logo generadas.");
console.log("  Después de esto corré `npm run og:generate` (el OG compone logo.png).");
