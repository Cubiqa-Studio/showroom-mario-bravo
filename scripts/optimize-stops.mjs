// Optimiza los videos "estáticos" (cinemagraphs) de los stops del flyby — las vistas
// donde la cámara queda PARADA. Camila los exporta en 1080p a bitrate alto (~5-7 MB
// c/u); como autoplay-ean en el home (performance-crítico) los recomprimimos.
//
// Por cada `_media-src/stops/stop-N-vid.mp4` (master, gitignored) genera en
// `public/stops/`:
//   - `stop-N-vid.mp4`   H.264 1080p, sin audio (son loops muteados), faststart
//   - `stop-N-vid.webm`  VP9 1080p (entrega más liviana donde se soporta)
//   - `stop-N.jpg`       frame 0 = poster + red de seguridad del visor (mismo path
//                        que ya usa stops.json → no hay que tocar `image`)
//
// Uso:  npm run stops:optimize
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "_media-src", "stops");
const OUT_DIR = join(ROOT, "public", "stops");

if (!existsSync(SRC_DIR)) {
  console.error(`No existe ${SRC_DIR}. Dejá ahí los stop-N-vid.mp4 originales.`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const masters = readdirSync(SRC_DIR)
  .filter((f) => /^stop-\d+-vid\.mp4$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (masters.length === 0) {
  console.error(`No se encontraron stop-N-vid.mp4 en ${SRC_DIR}`);
  process.exit(1);
}

const SCALE = "scale=-2:1080"; // baja/mantiene a 1080p (alto par)
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stats", ...args], { stdio: "inherit" });
const mb = (p) => `${(statSync(p).size / 1048576).toFixed(2)} MB`;

for (const file of masters) {
  const n = basename(file).match(/stop-(\d+)-vid/i)[1];
  const src = join(SRC_DIR, file);
  const mp4 = join(OUT_DIR, `stop-${n}-vid.mp4`);
  const webm = join(OUT_DIR, `stop-${n}-vid.webm`);
  const poster = join(OUT_DIR, `stop-${n}.jpg`);

  console.log(`\n■ stop ${n}`);
  console.log("  → poster (frame 0)");
  ff(["-i", src, "-frames:v", "1", "-vf", SCALE, "-q:v", "3", poster]);
  console.log("  → mp4 (H.264 1080p, sin audio)");
  ff([
    "-i", src, "-vf", SCALE, "-an",
    "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", mp4,
  ]);
  console.log("  → webm (VP9 1080p, sin audio)");
  ff([
    "-i", src, "-vf", SCALE, "-an",
    "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
    "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", webm,
  ]);
  console.log(`  ✓ mp4 ${mb(mp4)} · webm ${mb(webm)} · poster ${mb(poster)}`);
}

console.log(`\n✓ ${masters.length} stops → ${OUT_DIR}`);
