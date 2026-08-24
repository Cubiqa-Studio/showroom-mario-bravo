// Aplica la tanda de planos NUEVOS del cliente (2026-07-16) a las tipologías:
// public/tipology/unity/NUEVAS/<m2>.png → public/tipology/unity/TIPOLOGIA <X>.png
//
// Mapeo por superficie (verificado VISUALMENTE contra los planos actuales; 100M2 y
// 130M2 además traen la etiqueta "TIPOLOGIA D/F" horneada que lo confirma):
//   60M2→A · 85M2→B · 90M2→C · 100M2→D · 115M2→E · 130M2→F
//
// Los PNG nuevos traen márgenes TRANSPARENTES enormes (RGB verde residual con
// alpha=0 debajo, como la tanda 2026-06-09) → bbox por canal alpha. Diferencias
// con trim-tipologias.mjs que obligaron a re-derivarlo:
//   · 100M2/130M2 tienen la etiqueta de texto arriba a la izquierda → se BORRA
//     (alpha 0) antes del bbox, si no quedaba en la web y estiraba el recorte.
//   · 130M2 tiene manchas tenues sueltas (α≈63 en la esquina 0,0) → umbral α>100
//     y una fila/columna cuenta como contenido sólo con ≥4 px (anti-manchas).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "public", "tipology", "unity");
const SRC = join(DIR, "NUEVAS");

const MAP = [
  ["60M2.png", "TIPOLOGIA A.png"],
  ["85M2.png", "TIPOLOGIA B.png"],
  ["90M2.png", "TIPOLOGIA C.png"],
  ["100M2.png", "TIPOLOGIA D.png"],
  ["115M2.png", "TIPOLOGIA E.png"],
  ["130M2.png", "TIPOLOGIA F.png"],
];

// Región (full-res px) de la etiqueta "TIPOLOGIA X" horneada — bien lejos del plano.
const ERASE_LABEL = {
  "100M2.png": { left: 0, top: 0, width: 1600, height: 430 },
  "130M2.png": { left: 0, top: 0, width: 1600, height: 430 },
};

const PROBE_W = 700; // ancho del probe para el bbox (rápido y sobra precisión)
const ALPHA_MIN = 100; // px "contenido" = alpha > 100 (los planos son ~binarios)
const RUN_MIN = 4; // una fila/col cuenta sólo con ≥4 px de contenido (anti-manchas)

for (const [srcName, outName] of MAP) {
  const input = join(SRC, srcName);
  const base = sharp(input);
  const fm = await base.metadata();

  // 1 · Borrar la etiqueta horneada (si la hay): "dest-out" perfora el alpha.
  const erase = ERASE_LABEL[srcName];
  const prepared = erase
    ? await base
        .composite([
          {
            input: {
              create: {
                width: erase.width,
                height: erase.height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 },
              },
            },
            left: erase.left,
            top: erase.top,
            blend: "dest-out",
          },
        ])
        .png()
        .toBuffer()
    : await base.png().toBuffer();

  // 2 · Bbox de contenido sobre un probe reducido, por alpha con anti-manchas.
  const { data, info } = await sharp(prepared)
    .resize({ width: PROBE_W })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const rowCount = new Array(h).fill(0);
  const colCount = new Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * ch + 3] > ALPHA_MIN) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }
  const first = (arr) => arr.findIndex((n) => n >= RUN_MIN);
  const last = (arr) => arr.length - 1 - [...arr].reverse().findIndex((n) => n >= RUN_MIN);
  const minY = first(rowCount);
  const maxY = last(rowCount);
  const minX = first(colCount);
  const maxX = last(colCount);
  if (minX < 0 || minY < 0) throw new Error(`${srcName}: no se detectó contenido`);

  // 3 · Volver a full-res, recortar y respirar 4% transparente (como el trim viejo).
  const sx = fm.width / w;
  const sy = fm.height / h;
  const left = Math.max(0, Math.floor(minX * sx));
  const top = Math.max(0, Math.floor(minY * sy));
  const right = Math.min(fm.width, Math.ceil((maxX + 1) * sx));
  const bottom = Math.min(fm.height, Math.ceil((maxY + 1) * sy));
  const cw = right - left;
  const chh = bottom - top;
  const pad = Math.round(cw * 0.04);

  const { data: png, info: res } = await sharp(prepared)
    .extract({ left, top, width: cw, height: chh })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true });
  writeFileSync(join(DIR, outName), png);

  console.log(
    `${srcName.padEnd(10)} ${fm.width}x${fm.height} -> crop ${cw}x${chh} -> ${outName} ${res.width}x${res.height}` +
      ` (ratio ${(res.width / res.height).toFixed(3)}, ${Math.round(png.length / 1024)} KB)` +
      (erase ? " [etiqueta borrada]" : ""),
  );
}
