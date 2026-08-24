// Comprime un video pesado (p.ej. master 4K del cliente) a assets web 1080p:
// mp4 (H.264) + webm (VP9) + poster JPG, en public/. El master NO va al deploy:
// dejalo en _media-src/ (gitignored), igual que la intro.
//
// Uso:  node scripts/optimize-video.mjs <input> <out-basename> [posterSeconds]
//   ej. node scripts/optimize-video.mjs _media-src/mario-bravo-master.mp4 mario-bravo
//       → public/mario-bravo.mp4, public/mario-bravo.webm, public/mario-bravo-poster.jpg
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import { existsSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const [input, base, posterAt = "2"] = process.argv.slice(2);
if (!input || !base) {
  console.error("Uso: node scripts/optimize-video.mjs <input> <out-basename> [posterSeconds]");
  process.exit(1);
}
const src = isAbsolute(input) ? input : join(ROOT, input);
if (!existsSync(src)) {
  console.error(`No existe el video fuente: ${src}`);
  process.exit(1);
}

const out = (name) => join(ROOT, "public", name);
const mp4 = out(`${base}.mp4`);
const webm = out(`${base}.webm`);
const poster = out(`${base}-poster.jpg`);

const SCALE = "scale=-2:1080"; // baja a 1080p (alto par); -2 mantiene el aspecto
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stats", ...args], { stdio: "inherit" });
const mb = (p) => `${(statSync(p).size / 1048576).toFixed(1)} MB`;

console.log("→ poster (JPG)");
ff(["-ss", posterAt, "-i", src, "-frames:v", "1", "-vf", SCALE, "-q:v", "3", poster]);

console.log("→ mp4 (H.264 1080p)");
ff([
  "-i", src, "-vf", SCALE,
  "-c:v", "libx264", "-crf", "25", "-preset", "slow", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", mp4,
]);

console.log("→ webm (VP9 1080p)");
ff([
  "-i", src, "-vf", SCALE,
  "-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0",
  "-deadline", "good", "-cpu-used", "2", "-row-mt", "1",
  "-c:a", "libopus", "-b:a", "128k", webm,
]);

console.log(`\n✓ ${base}.mp4 ${mb(mp4)} · ${base}.webm ${mb(webm)} · ${base}-poster.jpg ${mb(poster)}`);
