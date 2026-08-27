// Genera las "plates" (plantas clicables por piso) desde los planos del cliente.
//
// Una plate es la imagen de la planta de un piso + un polígono por unidad. Se usan
// en la pestaña "Planta del piso" de la ficha y en el Plan Maestro del showroom.
//
// Por cada piso emite `public/tipology/piso-<floor>.webp` y REGENERA
// `src/data/plates.json` **conservando los `polygons` ya trazados** (nunca los pisa:
// el trazado es trabajo manual caro).
//
// El espacio de coordenadas es el px NATIVO del plano — no se reescala. Si el
// cliente re-exporta un plano a otro tamaño, hay que re-trazar ESE piso.
//
// PISOS QUE COMPARTEN PLANO: los pisos 2 a 5 son la misma planta tipo, así que
// comparten un único archivo fuente y una única imagen servida. Pero cada piso
// necesita SUS polígonos (los unitId cambian: 201… vs 301…). Trazá el piso 2 y
// después clonalos con `node scripts/clone-plate-polygons.mjs 2 3 4 5`.
//
// Uso:  node scripts/make-plates.mjs      (o `npm run plates:images`)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC_DIR = join(ROOT, "_media-src", "plantas");
const OUT_DIR = join(ROOT, "public", "tipology");
const PLATES_JSON = join(ROOT, "src", "data", "plates.json");

/** WebP casi sin pérdida: son planos con líneas finas y texto chico, un q bajo los
 *  emborrona justo donde el usuario mira (los números de unidad). */
const QUALITY = 90;

/**
 * Piso → archivo fuente en `_media-src/plantas/`. Varios pisos pueden apuntar al
 * mismo archivo (planta tipo); en ese caso comparten también la imagen servida.
 *
 * LAS CLAVES SON LAS DEL SELECTOR, no sólo prefijos de unidad. El subsuelo, la
 * planta baja y el 8° NO tienen unidades —y por eso no llevan polígonos—, pero sí
 * se muestran: son la cochera, los amenities y la azotea, que es justo lo que
 * pregunta el que compra.
 */
const FLOOR_SOURCES = {
  SS: "subsuelo-cochera.png",
  "0": "planta-baja-amenities.png",
  "1": "piso-1.png",
  "2": "piso-tipo-2-5.png",
  "3": "piso-tipo-2-5.png",
  "4": "piso-tipo-2-5.png",
  "5": "piso-tipo-2-5.png",
  "6": "piso-6.png",
  "7": "piso-7.png",
  "8": "azotea-8vo.png",
};

/**
 * Orden de recorrido del edificio, de abajo hacia arriba. Va APARTE y explícito
 * porque `Object.keys` NO respeta el orden de escritura: las claves que parecen
 * enteros ("0", "1", …) salen primero y en orden numérico, y las de texto ("SS")
 * después — o sea que el subsuelo terminaba arriba del 8°.
 *
 * Tiene que coincidir con `SITE.floors` (src/data/site.ts), que es lo que consume
 * el selector de "Planta del piso".
 */
const FLOOR_ORDER = ["SS", "0", "1", "2", "3", "4", "5", "6", "7", "8"];

const faltantes = Object.keys(FLOOR_SOURCES).filter((f) => !FLOOR_ORDER.includes(f));
if (faltantes.length) {
  console.error(`✗ FLOOR_ORDER no incluye: ${faltantes.join(", ")} — agregalos y volvé a correr.`);
  process.exit(1);
}

if (!existsSync(SRC_DIR)) {
  console.error(`No existe ${SRC_DIR} — dejá ahí los planos por piso.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// Polígonos ya trazados, indexados por piso — se re-inyectan tal cual.
const previous = existsSync(PLATES_JSON)
  ? JSON.parse(readFileSync(PLATES_JSON, "utf8"))
  : { plates: [] };
const keptPolygons = new Map(
  (previous.plates ?? []).map((p) => [p.floor, p.polygons ?? []]),
);

const kb = (n) => `${Math.round(n / 1024)} KB`;
/** source → { name, width, height } ya convertido (evita re-encodear la planta tipo 4×). */
const encoded = new Map();
const plates = [];

for (const floor of FLOOR_ORDER) {
  const source = FLOOR_SOURCES[floor];
  const input = join(SRC_DIR, source);
  if (!existsSync(input)) {
    console.warn(`⚠ piso ${floor}: falta ${source} — se saltea (se conservan sus polígonos).`);
    const polygons = keptPolygons.get(floor) ?? [];
    const prev = (previous.plates ?? []).find((p) => p.floor === floor);
    if (prev) plates.push({ ...prev, polygons });
    continue;
  }

  if (!encoded.has(source)) {
    // Nombre de salida = el del fuente, así los pisos que comparten planta comparten
    // archivo (una sola descarga para 2°-5°).
    const name = source.replace(/\.[^.]+$/, "") + ".webp";
    const before = await sharp(input).metadata();
    const info = await sharp(input)
      // 1 · RECORTE del lienzo vacío. Los planos vienen exportados sobre una hoja
      // con mucho margen transparente alrededor del dibujo; servidos así, la planta
      // se ve chica y flotando en el medio de un rectángulo vacío. `trim` sobre el
      // alfa deja la caja real del dibujo. Va ANTES del flatten (después ya no hay
      // alfa que recortar).
      .trim({ threshold: 1 })
      // 2 · SIN flatten: el plano conserva su transparencia (el cliente los exporta en
      //     PNG justamente para eso) y apoya sobre el fondo oscuro de la tarjeta. Con
      //     `flatten({background:"#ffffff"})` aparecía un rectángulo BLANCO alrededor
      //     del dibujo, que es lo que se veía en el Plan Maestro.
      //     `alphaQuality: 100` para que el borde del alfa no se degrade.
      .webp({ quality: QUALITY, alphaQuality: 100 })
      .toFile(join(OUT_DIR, name));
    // Cuánto se recortó de cada lado (sharp los devuelve negativos).
    const offset = { left: -(info.trimOffsetLeft ?? 0), top: -(info.trimOffsetTop ?? 0) };
    encoded.set(source, { name, width: info.width, height: info.height, size: info.size, offset, before });
    const saved = Math.round((1 - (info.width * info.height) / (before.width * before.height)) * 100);
    console.log(
      `${source.padEnd(22)} → ${name.padEnd(22)} ${before.width}×${before.height} → ${info.width}×${info.height}` +
        `  (−${saved}% de lienzo)  ${kb(info.size)}`,
    );
  }

  const img = encoded.get(source);
  let polygons = keptPolygons.get(floor) ?? [];

  // Si ya había polígonos trazados y el recorte movió el origen, hay que correrlos
  // el mismo delta o quedarían desfasados respecto del plano. Se remapean solos: el
  // trazado manual no se pierde ni hay que rehacerlo.
  const prev = (previous.plates ?? []).find((p) => p.floor === floor);
  const shifted = prev && (prev.imageWidth !== img.width || prev.imageHeight !== img.height);
  if (polygons.length && shifted) {
    const { left, top } = img.offset;
    polygons = polygons.map((p) => ({
      ...p,
      points: p.points
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(",").map(Number);
          return `${+(x - left).toFixed(2)},${+(y - top).toFixed(2)}`;
        })
        .join(" "),
    }));
    console.log(
      `  ↳ piso ${floor}: ${polygons.length} polígono(s) recorridos −${left},−${top} por el nuevo recorte`,
    );
  }

  plates.push({
    floor,
    image: `/tipology/${img.name}`,
    imageWidth: img.width,
    imageHeight: img.height,
    polygons,
  });
}

plates.sort((a, b) => FLOOR_ORDER.indexOf(a.floor) - FLOOR_ORDER.indexOf(b.floor));
writeFileSync(PLATES_JSON, JSON.stringify({ plates }, null, 2) + "\n");

const traced = plates.filter((p) => p.polygons.length > 0);
console.log(`\n✓ ${plates.length} plantas → ${PLATES_JSON}`);
console.log(
  traced.length
    ? `✓ polígonos conservados en ${traced.length} piso(s): ${traced.map((p) => `${p.floor}°(${p.polygons.length})`).join(" ")}`
    : "· todavía sin polígonos trazados (usá /admin/polygon-editor/plano/<piso>)",
);
