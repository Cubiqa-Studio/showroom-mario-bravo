// ─────────────────────────────────────────────────────────────────────────────
// Genera la imagen Open Graph (1200×630) que se ve al compartir en Meta Ads /
// WhatsApp / redes, + todo el set de iconos derivado de src/app/icon.svg
// (manifest 192/512, apple-icon 180, favicon.ico). Correr con:
//   node scripts/make-og.mjs      (o `npm run og:generate`)
//
// Composición: render del edificio (public/stops/stop-0.jpg) recortado a 1200×630
// + logo (public/logo.png) + degradés + wordmark. Si cambia el render base,
// reemplazá stop-0.jpg (o regeneralo con make-stop-stills.mjs) y volvé a correr esto.
//
// El recorte se calcula desde las dimensiones REALES del still: antes estaba
// hardcodeado a 5000 px de ancho y reventaba con cualquier entrega de otro tamaño.
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import path from "node:path";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const pub = (p) => path.join(ROOT, "public", p);
const ICON_SVG = path.join(ROOT, "src/app/icon.svg");
const W = 1200;
const H = 630;

/** Copy del overlay — editalo por proyecto. */
const EYEBROW = "MARIO BRAVO 955 · BUENOS AIRES";
const HEADLINE = "Departamentos de 1 a 4 ambientes";
/** Dorado del overlay: una versión CLARA del --gold de la paleta, porque acá va
 *  sobre un scrim oscuro (el --gold del sitio está calibrado contra blanco). */
const ACCENT = "#E0B95F";

async function makeOg() {
  const src = pub("stops/stop-0.jpg");
  const { width, height } = await sharp(src).metadata();

  // Recorte superior al aspect del OG: conserva cielo + edificio y descarta la
  // vereda. Si el still ya es más "chato" que 1200×630, no recorta nada.
  const cropH = Math.min(height, Math.round(width / (W / H)));
  const base = await sharp(src)
    .extract({ left: 0, top: 0, width, height: cropH })
    .resize(W, H)
    .toBuffer();

  // Variante BLANCA del wordmark: acá va sobre el render con un scrim oscuro encima,
  // y el OG se ve casi siempre en miniatura (WhatsApp, Meta Ads). El oro de la paleta
  // está calibrado contra blanco y a ese tamaño se apaga contra el cielo del atardecer.
  const logo = await sharp(pub("logo_blanco.png")).resize({ width: 300 }).toBuffer();

  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stop-color="#0c0a07" stop-opacity="0"/>
          <stop offset="1" stop-color="#0c0a07" stop-opacity="0.78"/>
        </linearGradient>
        <linearGradient id="topscrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0c0a07" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#0c0a07" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="200" fill="url(#topscrim)"/>
      <rect x="0" y="230" width="${W}" height="400" fill="url(#scrim)"/>
      <rect x="64" y="472" width="46" height="3" fill="${ACCENT}"/>
      <text x="120" y="483" font-family="Arial, Helvetica, sans-serif" font-size="23"
            font-weight="600" letter-spacing="5" fill="${ACCENT}">${EYEBROW}</text>
      <text x="62" y="558" font-family="Georgia, 'Times New Roman', serif" font-size="56"
            fill="#ffffff">${HEADLINE}</text>
    </svg>`);

  await sharp(base)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: 54, left: 64 },
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(pub("og.jpg"));
  const meta = await sharp(pub("og.jpg")).metadata();
  console.log(`public/og.jpg → ${meta.width}×${meta.height} (base ${width}×${height}, recorte ${width}×${cropH})`);
}

/** PNG cuadrado del icono, rasterizado del SVG a `density` alta para que no pixele. */
const iconPng = (size) =>
  sharp(ICON_SVG, { density: 384 }).resize(size, size).png().toBuffer();

async function makeIcons() {
  for (const size of [192, 512]) {
    writeFileSync(pub(`icon-${size}.png`), await iconPng(size));
    console.log(`public/icon-${size}.png ✓`);
  }
  // Apple touch icon: 180×180, sin transparencia (iOS la pinta negra igual).
  writeFileSync(path.join(ROOT, "src/app/apple-icon.png"), await iconPng(180));
  console.log("src/app/apple-icon.png ✓");
}

/**
 * favicon.ico multi-resolución. sharp no escribe .ico, así que armamos el
 * contenedor a mano: un ICONDIR + una entrada por tamaño + los PNG embebidos
 * (el formato ICO acepta PNG desde Vista; todo browser vigente lo lee).
 */
async function makeFavicon() {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(iconPng));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = icono
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0); // ancho  (0 = 256)
    e.writeUInt8(size, 1); // alto
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });

  writeFileSync(path.join(ROOT, "src/app/favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
  console.log(`src/app/favicon.ico ✓ (${sizes.join("/")} px)`);
}

await makeOg();
await makeIcons();
await makeFavicon();
console.log("OG + set de iconos generados.");
