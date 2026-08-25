// ⚠ PROVISORIO — andamio hasta que lleguen los tramos 3D del flyby.
//
// El showroom navega entre vistas reproduciendo los frames pre-renderizados de cada
// tramo. La flecha de navegación sólo aparece si su segmento TIENE frames
// (`FlybyViewer`: `expectForward = !!forwardSeg && forwardSeg.frames.length > 0`) —
// sin frames no hay flechas y el showroom queda clavado en una sola vista.
//
// Todavía no hay tramos renderizados del edificio, así que este script sintetiza un
// cross-dissolve entre stops consecutivos para que la navegación exista y se puedan
// trazar los polígonos de las 4 vistas. NO es una órbita: la cámara no se mueve, las
// dos vistas se funden.
//
// CUANDO LLEGUEN LOS MP4 DE LOS TRAMOS:
//   1. node scripts/extract-flyby-frames.mjs "_media-src/flyby/tramo-0-1.mp4" 0 1   (×4)
//   2. borrar este script y su entrada en package.json
// El reemplazo es drop-in: `flyby.json` referencia los frames por ruta, y las rutas
// son las mismas. No hay que tocar código.
//
// Uso:  node scripts/make-placeholder-frames.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STOPS_JSON = join(ROOT, "src", "data", "stops.json");
const FLYBY_JSON = join(ROOT, "src", "data", "flyby.json");
const FRAMES_DIR = join(ROOT, "public", "frames");

/** Frames por tramo. La transición dura 650 ms → 14 frames ≈ 21 fps, de sobra para
 *  un fundido (no hay movimiento de cámara que resolver). Los tramos reales traen
 *  los que traiga el mp4; el viewer no asume un número fijo. */
const FRAMES_PER_SEG = 14;
/** Los frames REALES van a 1080p q78. Estos no, a propósito: un cross-dissolve de
 *  dos imágenes distintas superpone dos escenas y duplica el detalle, así que
 *  comprime pésimo — a 1080p/q78 el set daba 23 MB, contra los ~9 MB que pesa un
 *  flyby real completo. Un andamio no puede reventar el presupuesto de bytes de
 *  mobile: a 720p/q70 un fundido de 650 ms se ve igual (el viewer escala los frames
 *  al escenario de todos modos) y el set entra en ~4 MB. */
const FRAME_W = 1280;
const FRAME_H = 720;
const FRAME_Q = 70;

if (!existsSync(STOPS_JSON)) {
  console.error(`Falta ${STOPS_JSON} — corré primero node scripts/make-stop-stills.mjs`);
  process.exit(1);
}

const stops = JSON.parse(readFileSync(STOPS_JSON, "utf8")).stops ?? [];
if (stops.length < 2) {
  console.error(`Hacen falta al menos 2 stops para armar un anillo (hay ${stops.length}).`);
  process.exit(1);
}

/**
 * Orden del anillo. `null` = orden natural por id (0→1→2→3→0), que es el caso normal.
 *
 * Ponelo explícito cuando un stop NUEVO no vaya al final del recorrido. Es lo que va a
 * pasar con la "View 02b" que está preparando Juani: es un punto intermedio entre
 * stop-1 y stop-2, pero entra como `stop-4` para NO renumerar los existentes (renumerar
 * obligaría a re-trazar todos los polígonos). El viewer resuelve los segmentos por
 * from/to, no por orden de ids, así que un anillo con ids salteados es perfectamente
 * válido. En ese momento:
 *
 *     const RING = [0, 1, 4, 2, 3];
 */
const RING = null;

const ids = stops.map((s) => s.id).sort((a, b) => a - b);
const order = RING ?? ids;
for (const id of order) {
  if (!ids.includes(id)) {
    console.error(`RING nombra el stop ${id}, que no existe en stops.json (hay: ${ids.join(", ")}).`);
    process.exit(1);
  }
}
if (order.length !== ids.length) {
  console.warn(`⚠ RING recorre ${order.length} de ${ids.length} stops — los que falten quedan sin flecha.`);
}
// Anillo cerrado. Cada tramo tiene su vuelta (el viewer reproduce el mismo segmento al
// revés), así que un segmento por par alcanza para navegar en ambos sentidos.
const ring = order.map((from, i) => ({ from, to: order[(i + 1) % order.length] }));

/** El master nativo del stop (JPG) da el mejor downscale; el webp servido es fallback. */
function stillFor(id) {
  const jpg = join(ROOT, "public", "stops", `stop-${id}.jpg`);
  if (existsSync(jpg)) return jpg;
  const webp = join(ROOT, "public", "stops", `stop-${id}.webp`);
  if (existsSync(webp)) return webp;
  throw new Error(`No hay still para el stop ${id} en public/stops/`);
}

/** Fotograma base ya escalado al espacio del flyby (se reusa en los 16 fundidos). */
async function plate(id) {
  return sharp(stillFor(id))
    .resize(FRAME_W, FRAME_H, { fit: "cover", position: "centre" })
    .toBuffer();
}

const segments = [];
let total = 0;
let bytes = 0;

for (const { from, to } of ring) {
  const segName = `seg-${from}-${to}`;
  const outDir = join(FRAMES_DIR, segName);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const [a, b] = await Promise.all([plate(from), plate(to)]);
  const frames = [];

  for (let i = 0; i < FRAMES_PER_SEG; i++) {
    // t va de 0 (todo `from`) a 1 (todo `to`), ambos extremos incluidos: el primer
    // frame ES el stop de origen y el último ES el destino, que es justo lo que el
    // viewer espera al aterrizar (si no, se ve un salto al parar).
    const t = i / (FRAMES_PER_SEG - 1);
    // smoothstep: arranca y termina suave, así el fundido no "pega el frenazo".
    const eased = t * t * (3 - 2 * t);

    // `ensureAlpha(eased)` le pone al destino un alfa uniforme; compuesto sobre el
    // origen da el cross-dissolve. PNG intermedio para no perder el canal alfa.
    const top = await sharp(b).ensureAlpha(eased).png().toBuffer();
    const name = String(i + 1).padStart(4, "0") + ".webp";
    const info = await sharp(a)
      .composite([{ input: top, blend: "over" }])
      .webp({ quality: FRAME_Q })
      .toFile(join(outDir, name));

    bytes += info.size;
    frames.push(`/frames/${segName}/${name}`);
  }

  segments.push({ from, to, dir: "left", frames });
  total += frames.length;
  console.log(`${segName.padEnd(10)} ${frames.length} frames  ${FRAME_W}×${FRAME_H}`);
}

writeFileSync(FLYBY_JSON, JSON.stringify({ segments }, null, 2) + "\n");
console.log(
  `\n✓ ${total} frames provisorios (${Math.round(bytes / 1024 / 1024)} MB) → ${FRAMES_DIR}`,
);
console.log(`✓ ${segments.length} segmentos → ${FLYBY_JSON}`);
console.log("\n⚠ Son fundidos, no una órbita. Reemplazalos con flyby:frames cuando lleguen los tramos.");
