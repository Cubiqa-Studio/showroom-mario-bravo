// Genera los stills servidos de cada stop del flyby, desde los masters del cliente.
//
// Por qué existe: la conversión de stills a WebP era ad-hoc (sharp a mano en una
// terminal) — el único paso de la cadena sin script commiteado, y el que hizo
// driftar las resoluciones entre stops en el proyecto anterior (4991×2808 vs
// 5000×2813 vs 5000×2812). Acá queda determinista y reproducible.
//
// Por cada `_media-src/stops/stop-<n>-src.<ext>` emite en `public/stops/`:
//   - `stop-<n>.jpg`   NATIVO, calidad alta → poster/fallback y fuente de `og:generate`
//                      (make-og.mjs LEE stop-0.jpg, no el webp).
//   - `stop-<n>.webp`  long-edge ≤ SERVED_MAX, q80 → lo que sirve `stops.json.image`.
//
// Y REGENERA `src/data/stops.json` con image/imageWidth/imageHeight de cada stop
// **conservando los `polygons` ya trazados** (nunca los pisa: el trazado es trabajo
// manual caro). imageWidth/Height = las dimensiones del JPG nativo, que es el
// espacio de coordenadas en el que se trazan polígonos y hotspots VR.
//
// NO upscalea: si el cliente entrega a 4000×2250, el espacio de trazado es 4000×2250.
// Inventar píxeles no agrega detalle y sí agrega peso.
//
// Uso:  node scripts/make-stop-stills.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC_DIR = join(ROOT, "_media-src", "stops");
const OUT_DIR = join(ROOT, "public", "stops");
const STOPS_JSON = join(ROOT, "src", "data", "stops.json");

/** Long-edge del WebP servido. 2560 cubre un desktop retina sin traer el master. */
const SERVED_MAX = 2560;
const SERVED_Q = 80;
/** El JPG nativo es poster + fuente del OG: calidad alta, pero no lossless. */
const NATIVE_Q = 88;

const SRC_RE = /^stop-(\d+)-src\.(jpe?g|png|tiff?|webp)$/i;

if (!existsSync(SRC_DIR)) {
  console.error(`No existe ${SRC_DIR} — dejá ahí los masters como stop-<n>-src.jpg`);
  process.exit(1);
}

const sources = readdirSync(SRC_DIR)
  .map((file) => ({ file, m: file.match(SRC_RE) }))
  .filter(({ m }) => m)
  .map(({ file, m }) => ({ file, id: Number(m[1]) }))
  .sort((a, b) => a.id - b.id);

if (sources.length === 0) {
  console.error(`No hay masters que matcheen stop-<n>-src.<ext> en ${SRC_DIR}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// Polígonos ya trazados, indexados por id de stop — se re-inyectan tal cual.
const previous = existsSync(STOPS_JSON)
  ? JSON.parse(readFileSync(STOPS_JSON, "utf8"))
  : { stops: [] };
const keptPolygons = new Map(
  (previous.stops ?? []).map((s) => [s.id, s.polygons ?? []]),
);

const kb = (n) => `${Math.round(n / 1024)} KB`;
const stops = [];

for (const { file, id } of sources) {
  const input = join(SRC_DIR, file);

  // `.rotate()` sin args aplica la orientación EXIF antes de medir: así las
  // dimensiones que guardamos son las que el navegador realmente pinta (y contra
  // las que se trazan los polígonos), no las del sensor.
  const native = await sharp(input)
    .rotate()
    .jpeg({ quality: NATIVE_Q, mozjpeg: true })
    .toFile(join(OUT_DIR, `stop-${id}.jpg`));

  const served = await sharp(input)
    .rotate()
    .resize({ width: SERVED_MAX, height: SERVED_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: SERVED_Q })
    .toFile(join(OUT_DIR, `stop-${id}.webp`));

  const polygons = keptPolygons.get(id) ?? [];
  stops.push({
    id,
    frame: id, // vestigial (ningún runtime lo lee); se mantiene por compatibilidad de schema
    image: `/stops/stop-${id}.webp`,
    imageWidth: native.width,
    imageHeight: native.height,
    polygons,
  });

  const ar = (native.width / native.height).toFixed(4);
  console.log(
    `${file.padEnd(18)} → stop-${id}.jpg ${native.width}×${native.height} (${kb(native.size)}, ar ${ar})` +
      `  ·  stop-${id}.webp ${served.width}×${served.height} (${kb(served.size)})` +
      `  ·  ${polygons.length} polígono(s) conservado(s)`,
  );
}

// Aviso de integridad: los polígonos y los frames del flyby viven en el espacio de
// coordenadas del still. Si dos stops no comparten aspect, el encuadre no empalma.
const aspects = new Set(stops.map((s) => (s.imageWidth / s.imageHeight).toFixed(3)));
if (aspects.size > 1) {
  console.warn(
    `\n⚠ Los stops NO comparten aspect ratio (${[...aspects].join(", ")}). ` +
      `El flyby asume un encuadre único: pedile al cliente el set completo al mismo aspect.`,
  );
}

writeFileSync(STOPS_JSON, JSON.stringify({ stops }, null, 2) + "\n");
console.log(`\n✓ ${stops.length} stops → ${OUT_DIR}`);
console.log(`✓ geometría → ${STOPS_JSON} (polígonos conservados)`);
