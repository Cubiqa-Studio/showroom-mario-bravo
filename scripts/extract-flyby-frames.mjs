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
import { execFileSync } from "node:child_process";
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

const [input, fromArg, toArg] = process.argv.slice(2);
if (!input || fromArg === undefined || toArg === undefined) {
  console.error("Uso: node scripts/extract-flyby-frames.mjs <input.mp4> <from> <to>");
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

const jpgs = readdirSync(tmp)
  .filter((f) => f.endsWith(".jpg"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (jpgs.length === 0) {
  rmSync(tmp, { recursive: true, force: true });
  console.error("ffmpeg no produjo ningún frame — ¿el input tiene pista de video?");
  process.exit(1);
}

// 2 · JPG → WebP.
let bytes = 0;
let heaviest = 0;
for (const jpg of jpgs) {
  const info = await sharp(join(tmp, jpg)).webp({ quality: FRAME_Q }).toFile(join(outDir, jpg.replace(/\.jpg$/, ".webp")));
  bytes += info.size;
  heaviest = Math.max(heaviest, info.size);
}
rmSync(tmp, { recursive: true, force: true });

const first = await sharp(join(outDir, jpgs[0].replace(/\.jpg$/, ".webp"))).metadata();
console.log(
  `${jpgs.length} frames → public/frames/${segName}/  ` +
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
const segment = { from, to, dir: at >= 0 ? segments[at].dir ?? "left" : "left", frames };
if (at >= 0) segments[at] = segment;
else segments.push(segment);
segments.sort((a, b) => a.from - b.from || a.to - b.to);
writeFileSync(FLYBY_JSON, JSON.stringify({ segments }, null, 2) + "\n");
console.log(`✓ flyby.json: segmento ${from}→${to} con ${frames.length} frames`);

// 4 · PSNR de empalme contra los stills de los extremos.
function psnr(a, b) {
  if (!existsSync(a) || !existsSync(b)) return null;
  try {
    // El filtro `psnr` escribe a stderr; execFileSync lo tira si no lo capturamos.
    const out = execFileSync(
      "ffmpeg",
      ["-hide_banner", "-i", a, "-i", b, "-filter_complex", "[0:v]scale=960:540[x];[1:v]scale=960:540[y];[x][y]psnr", "-f", "null", "-"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const m = /average:([\d.]+)/.exec(out);
    return m ? Number(m[1]) : null;
  } catch (err) {
    const m = /average:([\d.]+)/.exec(String(err.stderr ?? ""));
    return m ? Number(m[1]) : null;
  }
}

const stopWebp = (id) => join(ROOT, "public", "stops", `stop-${id}.webp`);
const firstFrame = join(outDir, jpgs[0].replace(/\.jpg$/, ".webp"));
const lastFrame = join(outDir, jpgs.at(-1).replace(/\.jpg$/, ".webp"));

const head = psnr(firstFrame, stopWebp(from));
const tail = psnr(lastFrame, stopWebp(to));
const fmt = (v) => (v === null ? "n/d (falta el still)" : `${v.toFixed(2)} dB`);
console.log(`\nEmpalme  frame 0001 ↔ stop-${from}: ${fmt(head)}`);
console.log(`Empalme  frame ${jpgs.length.toString().padStart(4, "0")} ↔ stop-${to}: ${fmt(tail)}`);
if (tail !== null && tail < PSNR_MIN) {
  console.warn(
    `\n⚠ El aterrizaje está por debajo de ${PSNR_MIN} dB: se va a ver un salto al parar en el stop ${to}.\n` +
      `  ~22 dB suele ser off-by-one (pedí el tramo con un frame más/menos) · ~12 dB es par equivocado (revisá from/to).`,
  );
}
