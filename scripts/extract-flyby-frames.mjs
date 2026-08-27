// Extrae los frames de un tramo del flyby desde el .mp4 del 3D y los cablea en flyby.json.
//
// Este paso estaba documentado pero NO commiteado en el proyecto anterior, y fue la
// fuente de todos los drifts históricos: el conteo de frames del JSON se desincronizó
// del disco (un tramo quedó con 28 frames declarados como 30 → el último frame no
// existía), y una recompresión manual cambió .jpg por .webp sin actualizar las rutas.
// Acá el array `frames` del segmento se REGENERA leyendo el disco, nunca a mano.
//
// Qué hace:
//   1. Vacía `public/frames/seg-<from>-<to>/` (así no quedan huérfanos de una corrida previa).
//   2. ffmpeg extrae los frames NATIVOS (sin -vf scale: NO upscalear; el still es
//      nítido y los frames livianos comparten el mismo encuadre, no la misma resolución).
//   3. sharp los pasa a WebP q78 y borra los JPG temporales.
//   4. Regenera el segmento en `src/data/flyby.json` desde el disco (orden numérico).
//   5. Imprime el PSNR de empalme: frame 1 ↔ stop <from>, y último frame ↔ stop <to>.
//      ≥33 dB = aterriza limpio · ~22 dB = off-by-one (se ve un "pop") · ~12 dB = par equivocado.
//
// Requiere `ffmpeg` en el PATH (binario del sistema, no una dependencia npm).
//
// Uso:  node scripts/extract-flyby-frames.mjs "_media-src/flyby/tramo-0-1.mp4" 0 1
//       npm run flyby:frames -- "_media-src/flyby/tramo-0-1.mp4" 0 1
import sharp from "sharp";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FLYBY_JSON = join(ROOT, "src", "data", "flyby.json");

/** Calidad WebP de los frames. Baseline medida contra el JPG fuente: ~47-48 dB. */
const FRAME_Q = 78;
/** Umbral de aceptación del empalme frame-final ↔ still destino. */
const PSNR_MIN = 30;
/** Piso de movimiento de un frame, como fracción del movimiento MEDIANO de su propio
 *  clip. Por debajo de esto el frame no aporta: se descarta. Se mide contra el clip y no
 *  en dB absolutos porque cada tramo tiene su velocidad; un umbral fijo o no toca al que
 *  está mal o desarma al que está bien. Calibrado con los cuatro clips del 27-08: el paso
 *  más lento de los que se ven BIEN está en 10% y 32% de su mediana, mientras que los
 *  frames congelados de los que se ven mal están en 1,8-5,3%. 8% cae en ese hueco. */
const STALL_FLOOR = 0.08;
/** Tope de deriva acumulada, en múltiplos de la mediana: si de tanto descartar el salto
 *  se hizo grande, se conserva el frame igual. Red de seguridad para que una tira larga
 *  de pasos apenas-bajo-el-piso no colapse en un tirón. */
const STALL_CEIL = 1.0;

// `--land <mp4>` (opcional): agrega el PRIMER frame de ese video como frame de CIERRE
// del tramo. Por qué existe: el cliente entrega el flyby cortado en clips de 30 frames
// (0-30, 30-60, 60-90, 90-120) y el corte se lleva el frame del stop — el clip N termina
// UNO ANTES y la posición exacta del stop destino es el frame 1 del clip N+1. En los
// tramos que desaceleran al final la diferencia es invisible (empalman a 31-34 dB); en
// los que cortan todavía en movimiento se ve un salto al estacionar. Mirá el PSNR de
// empalme que este script imprime al terminar: si el aterrizaje da bajo, probá con --land.
const argv = process.argv.slice(2);
// Por defecto salen EXACTAMENTE los frames que trae el video, uno a uno. `--drop-stalls`
// es opt-in y descarta los frames sin movimiento (ver el paso 2); está sólo para
// diagnosticar un clip, no se usa para lo que se sirve.
const dropDupes = argv.includes("--drop-stalls");
const flags = argv.filter((a) => a !== "--drop-stalls");
let land;
const landAt = flags.indexOf("--land");
if (landAt >= 0) {
  land = flags[landAt + 1];
  flags.splice(landAt, 2);
}
const [input, fromArg, toArg] = flags;
if (!input || fromArg === undefined || toArg === undefined || (landAt >= 0 && land === undefined)) {
  console.error(
    "Uso: node scripts/extract-flyby-frames.mjs <input.mp4> <from> <to> [--land <mp4-del-tramo-siguiente>] [--drop-stalls]",
  );
  process.exit(1);
}
const from = Number(fromArg);
const to = Number(toArg);
if (!Number.isInteger(from) || !Number.isInteger(to)) {
  console.error("`from` y `to` tienen que ser ids de stop enteros.");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`No existe el input: ${input}`);
  process.exit(1);
}
if (land && !existsSync(land)) {
  console.error(`No existe el video de --land: ${land}`);
  process.exit(1);
}

const ff = (args) => execFileSync("ffmpeg", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  console.error("Falta `ffmpeg` en el PATH. Instalalo antes de correr este script.");
  process.exit(1);
}

const segName = `seg-${from}-${to}`;
const outDir = join(ROOT, "public", "frames", segName);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1 · frames nativos a JPG temporal. `-fps_mode passthrough` = un frame de salida por
// frame de entrada (sin duplicar ni tirar): el conteo lo decide el video, no nosotros.
const tmp = mkdtempSync(join(tmpdir(), "flyby-"));
console.log(`Extrayendo frames de ${input} …`);
ff(["-y", "-loglevel", "error", "-i", input, "-fps_mode", "passthrough", "-q:v", "2", "-start_number", "1", join(tmp, "%04d.jpg")]);

// Frame de cierre (--land). Se numera a continuación del último para que caiga al final
// del orden natural, y de ahí en adelante es un frame más: entra al WebP y al JSON solo.
if (land) {
  const n = readdirSync(tmp).filter((f) => f.endsWith(".jpg")).length;
  ff(["-y", "-loglevel", "error", "-i", land, "-frames:v", "1", "-q:v", "2", join(tmp, `${String(n + 1).padStart(4, "0")}.jpg`)]);
  console.log(`+ frame de cierre tomado de ${land} (= la posición exacta del stop ${to})`);
}

const jpgs = readdirSync(tmp)
  .filter((f) => f.endsWith(".jpg"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (jpgs.length === 0) {
  rmSync(tmp, { recursive: true, force: true });
  console.error("ffmpeg no produjo ningún frame — ¿el input tiene pista de video?");
  process.exit(1);
}

// 2 · Descartar los frames SIN MOVIMIENTO.
//
// El visor mapea el progreso LINEALMENTE al índice de frame (`frameAtProgress`, sin
// curva de easing), así que la velocidad que se ve es la del clip. Los clips que entrega
// el 3D vienen con "stalls": tiras de frames IDÉNTICOS al principio y/o al final —no un
// ease-in, frames repetidos: 43-48 dB entre consecutivos es ruido de compresión—. Con
// 7 frames muertos de 30, la transición se pasa el 24% del tiempo clavada y después mete
// todo el movimiento junto: se ve como un tirón. Arrastrando es peor, porque un cuarto
// del recorrido del dedo no mueve nada.
//
// El primero y el último NUNCA se tocan: son los anclas que empalman con los stills, y
// el último además es el que mide el PSNR de aterrizaje.
const thumb = (p) => sharp(p).resize(480, 270, { fit: "fill" }).removeAlpha().raw().toBuffer();
/** Desplazamiento RMS entre dos frames, normalizado a 0-1. Es 10^(-PSNR/20). */
const motion = (a, b) => {
  let se = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    se += d * d;
  }
  return Math.sqrt(se / a.length) / 255;
};

const kept = [];
let dropped = 0;
if (dropDupes && jpgs.length > 2) {
  const px = [];
  for (const jpg of jpgs) px.push(await thumb(join(tmp, jpg)));
  const pasos = [];
  for (let i = 0; i < px.length - 1; i++) pasos.push(motion(px[i], px[i + 1]));
  const mediana = [...pasos].sort((a, b) => a - b)[Math.floor(pasos.length / 2)];

  kept.push(jpgs[0]);
  let acc = 0;
  for (let i = 1; i < jpgs.length; i++) {
    acc += pasos[i - 1];
    const esUltimo = i === jpgs.length - 1;
    if (esUltimo || pasos[i - 1] >= STALL_FLOOR * mediana || acc >= STALL_CEIL * mediana) {
      kept.push(jpgs[i]);
      acc = 0;
    }
  }
  dropped = jpgs.length - kept.length;
  if (dropped > 0) {
    console.log(
      `− ${dropped} frame(s) sin movimiento descartado(s) (bajo el ${Math.round(STALL_FLOOR * 100)}% del paso mediano): ` +
        `comían ${Math.round((100 * dropped) / jpgs.length)}% de la transición sin mover la cámara`,
    );
  }
} else {
  kept.push(...jpgs);
}

// 3 · JPG → WebP, RENUMERANDO 0001..N para que no queden huecos.
let bytes = 0;
let heaviest = 0;
const webps = [];
for (let i = 0; i < kept.length; i++) {
  const name = `${String(i + 1).padStart(4, "0")}.webp`;
  const info = await sharp(join(tmp, kept[i])).webp({ quality: FRAME_Q }).toFile(join(outDir, name));
  webps.push(name);
  bytes += info.size;
  heaviest = Math.max(heaviest, info.size);
}
rmSync(tmp, { recursive: true, force: true });

const first = await sharp(join(outDir, webps[0])).metadata();
console.log(
  `${webps.length} frames → public/frames/${segName}/  ` +
    `${first.width}×${first.height}  ·  ${Math.round(bytes / 1024)} KB total  ` +
    `·  más pesado ${Math.round(heaviest / 1024)} KB`,
);
if (heaviest > 200 * 1024) {
  console.warn("⚠ Hay frames > 200 KB — si el master venía de-watermarkeado, recomprimí antes de commitear.");
}

// 3 · regenerar el segmento en flyby.json DESDE EL DISCO (la fuente de verdad).
const frames = readdirSync(outDir)
  .filter((f) => f.endsWith(".webp"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((f) => `/frames/${segName}/${f}`);

const flyby = existsSync(FLYBY_JSON) ? JSON.parse(readFileSync(FLYBY_JSON, "utf8")) : { segments: [] };
const segments = flyby.segments ?? [];
const at = segments.findIndex((s) => s.from === from && s.to === to);
// `dir` = hacia qué lado manda la CÁMARA este movimiento. Decide el chevron de la flecha
// Y el sentido del arrastre, así que no es cosmético. Re-extraer CONSERVA el que ya está;
// un segmento nuevo arranca en "right", que es como avanza todo el recorrido de este
// edificio — si alguna vez entra un tramo que gire al otro lado, corregilo a mano acá.
const DEFAULT_DIR = "right";
const segment = { from, to, dir: at >= 0 ? (segments[at].dir ?? DEFAULT_DIR) : DEFAULT_DIR, frames };
if (at >= 0) segments[at] = segment;
else segments.push(segment);
segments.sort((a, b) => a.from - b.from || a.to - b.to);
writeFileSync(FLYBY_JSON, JSON.stringify({ segments }, null, 2) + "\n");
console.log(`✓ flyby.json: segmento ${from}→${to} con ${frames.length} frames`);

// 4 · PSNR de empalme contra los stills de los extremos.
/** PSNR entre dos imágenes, o `null` si no se pudo medir (motivo en `psnrWhy`). */
let psnrWhy = null;
function psnr(a, b) {
  psnrWhy = null;
  if (!existsSync(a) || !existsSync(b)) {
    psnrWhy = "falta el still";
    return null;
  }
  // El filtro `psnr` reporta por STDERR y ffmpeg sale con código 0 — o sea que no
  // lanza y `execFileSync` (que devuelve SÓLO stdout) leía vacío: la medición daba
  // null siempre y el chequeo de empalme quedaba mudo, rotulado como "falta el still".
  // `spawnSync` sí expone stderr sin depender de que el proceso falle.
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", a, "-i", b, "-filter_complex", "[0:v]scale=960:540[x];[1:v]scale=960:540[y];[x][y]psnr", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const m = /average:([\d.]+)/.exec(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  if (!m) psnrWhy = "ffmpeg no devolvió PSNR";
  return m ? Number(m[1]) : null;
}

const stopWebp = (id) => join(ROOT, "public", "stops", `stop-${id}.webp`);
const firstFrame = join(outDir, webps[0]);
const lastFrame = join(outDir, webps.at(-1));

const fmt = (v) => (v === null ? `n/d (${psnrWhy})` : `${v.toFixed(2)} dB`);
const head = psnr(firstFrame, stopWebp(from));
const headTxt = fmt(head);
const tail = psnr(lastFrame, stopWebp(to));
const tailTxt = fmt(tail);
console.log(`\nEmpalme  frame 0001 ↔ stop-${from}: ${headTxt}`);
console.log(`Empalme  frame ${webps.length.toString().padStart(4, "0")} ↔ stop-${to}: ${tailTxt}`);
if (tail !== null && tail < PSNR_MIN) {
  console.warn(
    `\n⚠ El aterrizaje está por debajo de ${PSNR_MIN} dB: se va a ver un salto al parar en el stop ${to}.\n` +
      `  ~22 dB suele ser off-by-one (pedí el tramo con un frame más/menos) · ~12 dB es par equivocado (revisá from/to).`,
  );
}
