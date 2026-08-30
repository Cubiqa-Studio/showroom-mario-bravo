// Planos de unidad ("Plano de la unidad" en la ficha de /residencia/:id).
//
// Toma los renders de planta que entregó el cliente en `_media-src/tipologias/`,
// les recorta el lienzo vacío, los pasa a WebP web-ready en `public/plans/` y
// escribe el `floorPlan` de cada unidad en `src/data/units.json`.
//
// CÓMO SE LEEN LOS NOMBRES DEL CLIENTE. Cada archivo dice a qué unidades va, por
// el NÚMERO DE UNIDAD dentro del piso (no por tipología):
//   "PISO DEL 1 AL 5 - 10 Y 3"  → unidades 03 y 10 de los pisos 1 a 5  (tipología A)
//   "PLANTA DEL 1 AL 5TO - 9 Y 4" → unidades 04 y 09                   (tipología B)
//   "PLANTA DEL 1 AL 5TO - 8 Y 5" → unidades 05 y 08                   (tipología C)
//   "PISO 1 AL 5TO - 1 Y 7"       → unidades 01 y 07                   (tipología D)
//   "PLANTA DEL 1 AL 5TO - 2 Y 6" → unidades 02 y 06                   (tipología E)
//   "PLANTA 6TO PISO - 01" / "- 06" → 601 y 606
//   "PLANTA 7MO PISO - 01" / "- 06" → 701 y 706
// Los pares coinciden exactamente con el mapeo de recorridos 360° del Miro
// (A:03/10 · B:04/09 · C:05/08 · D:01/07 · E:02/06), que es la validación cruzada.
//
// EL 6° REUSA LAS TIPOLOGÍAS DEL PISO TIPO, CON LA NUMERACIÓN CORRIDA. En el 6° las
// unidades 01 y 06 son las grandes de retiro (tienen plano propio) y se comen la
// numeración: las seis chicas quedan un número atrás respecto del piso tipo. Es
// verificable de dos maneras independientes, y las dos dan lo mismo:
//   · por posición en la planta (los rótulos de piso-6.png vs piso-tipo-2-5.png)
//   · por superficie cubierta de la planilla de venta
//     602↔03 · 603↔04 · 604↔05 · 607↔08 · 608↔09 · 609↔10
// Van marcadas `inferred` y se listan aparte al final: el cliente NO las nombró,
// las dedujimos. Si Camila confirma otra cosa, se cambia acá y se vuelve a correr.
//
// Uso:  node scripts/make-unit-plans.mjs      (o `npm run plans:units`)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC_DIR = join(ROOT, "_media-src", "tipologias");
const OUT_DIR = join(ROOT, "public", "plans");
const UNITS_JSON = join(ROOT, "src", "data", "units.json");

/** Lado mayor del WebP servido. La ficha muestra el plano con `max-height: 620px`
 *  y ~560px de ancho de columna → 1400 alcanza para pantallas 2× con margen. */
const MAX_SIDE = 1400;
const QUALITY = 82;

/** Alfa a partir del cual un píxel cuenta como DIBUJO para calcular el recorte.
 *  Estos PNG son de alfa casi binaria (~99,8% en 0 o 255); el 0,2% del medio es el
 *  antialias del borde, más algún píxel suelto de la exportación —incluido un borde
 *  de 1px en el (0,0) con alfa 96 que hacía que `sharp.trim()` no recortara NADA—.
 *  128 deja afuera esa basura y deja adentro todo el dibujo. */
const ALPHA_MIN = 128;

/** Aire alrededor del dibujo, en píxeles del original (~4px en el WebP servido).
 *  Suficiente para que el trazo no quede pegado al borde, sin volver a meter lienzo. */
const PAD = 12;

/** Píxeles del borde del lienzo que se ignoran al medir. Estos PNG traen una
 *  HAIRLINE de 1px pegada al borde (en algunos, una línea vertical opaca de alto
 *  completo en x=0). Es invisible, pero cualquier medición que la mire concluye que
 *  el dibujo llega al borde y no recorta nada — que es justo lo que pasaba. */
const BORDER_SKIP = 4;

/**
 * Caja del CONTENIDO real, más `PAD`.
 *
 * Va a mano y no con `sharp.trim()` a propósito: `trim` compara contra el color de
 * una esquina y frena apenas encuentra una diferencia, así que con la hairline del
 * borde devolvía el lienzo entero — de ahí que los planos salieran nadando en aire.
 *
 * Mide por FILAS y COLUMNAS en vez de por píxel suelto: una fila/columna cuenta como
 * dibujo si tiene al menos unos pocos píxeles opacos. Así un punto perdido de la
 * exportación no estira la caja, y cualquier rasgo real (una pared, un balcón) la
 * estira igual porque ocupa cientos de píxeles. El resultado es estable: subir el
 * umbral 20× mueve la caja 1px.
 */
async function contentBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const colHits = new Int32Array(W);
  const rowHits = new Int32Array(H);
  for (let y = BORDER_SKIP; y < H - BORDER_SKIP; y++) {
    const row = y * W * C;
    for (let x = BORDER_SKIP; x < W - BORDER_SKIP; x++) {
      if (data[row + x * C + 3] < ALPHA_MIN) continue;
      colHits[x]++;
      rowHits[y]++;
    }
  }
  const span = (hits, min) => {
    let a = -1;
    let b = -1;
    for (let i = 0; i < hits.length; i++) {
      if (hits[i] < min) continue;
      if (a < 0) a = i;
      b = i;
    }
    return [a, b];
  };
  const [minX, maxX] = span(colHits, Math.max(4, Math.round(H * 0.001)));
  const [minY, maxY] = span(rowHits, Math.max(4, Math.round(W * 0.001)));
  // Lienzo vacío (no debería pasar): devolvemos todo antes que romper.
  if (minX < 0 || minY < 0) return { left: 0, top: 0, width: W, height: H, canvas: { W, H } };
  const left = Math.max(0, minX - PAD);
  const top = Math.max(0, minY - PAD);
  return {
    left,
    top,
    width: Math.min(W, maxX + 1 + PAD) - left,
    height: Math.min(H, maxY + 1 + PAD) - top,
    canvas: { W, H },
  };
}

/** Pisos que comparten la planta tipo (los 5 planos "PISO 1 AL 5"). */
const TIPO_FLOORS = ["1", "2", "3", "4", "5"];

/**
 * Un plano por entrada.
 *  · `out`     nombre del WebP en /public/plans (sin extensión)
 *  · `src`     archivo original del cliente, TAL CUAL lo mandó (trazabilidad)
 *  · `units`   unidades a las que va
 *  · `expect`  tipología que deben tener esas unidades en units.json (chequeo)
 *  · `inferred` deducido por nosotros, no rotulado por el cliente
 *
 * OJO con el nombre `tipologia-X`: `unitTipologia()` (src/lib/residencia.ts) sabe
 * derivar la letra del NOMBRE del plano con /TIPOLOG[IÍ]A\s*([A-Z])/. Hoy no matchea
 * porque el guion no es [A-Z] — y así tiene que quedar: las unidades del 6° reusan
 * estos archivos SIN ser tipologías A–E. Si alguna vez se afloja ese regex, el 6°
 * empezaría a mostrar una tipología que el cliente nunca asignó.
 */
/** ["03","10"] → ["103","110","203","210", … ] (los 5 pisos tipo). */
const tipo = (slots) => TIPO_FLOORS.flatMap((f) => slots.map((s) => f + s));

const PLANS = [
  { out: "tipologia-A", src: "PISO DEL 1 AL 5 - 10 Y 3.png",    units: tipo(["03", "10"]), expect: "A" },
  { out: "tipologia-B", src: "PLANTA DEL 1 AL 5TO - 9 Y 4.png", units: tipo(["04", "09"]), expect: "B" },
  { out: "tipologia-C", src: "PLANTA DEL 1 AL 5TO - 8 Y 5.png", units: tipo(["05", "08"]), expect: "C" },
  { out: "tipologia-D", src: "PISO 1 AL 5TO - 1 Y 7.png",       units: tipo(["01", "07"]), expect: "D" },
  { out: "tipologia-E", src: "PLANTA DEL 1 AL 5TO - 2 Y 6.png", units: tipo(["02", "06"]), expect: "E" },

  // 6° y 7°: plantas de retiro, un plano por unidad grande.
  { out: "piso-6-01", src: "PLANTA 6TO PISO - 01.png", units: ["601"] },
  { out: "piso-6-06", src: "PLANTA 6TO PISO - 06.png", units: ["606"] },
  { out: "piso-7-01", src: "PLANTA 7MO PISO - 01.png", units: ["701"] },
  { out: "piso-7-06", src: "PLANTA 7MO PISO - 06.png", units: ["706"] },
];

/** Las seis chicas del 6°: mismo plano que la tipología del piso tipo, numeración
 *  corrida un lugar (ver el encabezado). Deducido por nosotros, no por el cliente. */
const INFERRED = {
  "602": "tipologia-A",
  "603": "tipologia-B",
  "604": "tipologia-C",
  "607": "tipologia-C",
  "608": "tipologia-B",
  "609": "tipologia-A",
};

/** PRESTADOS: el cliente NO mandó el dibujo de esta unidad y se muestra el de otra.
 *  No es lo mismo que `INFERRED` (ahí el plano SÍ es el que corresponde, sólo que
 *  hubo que deducir a qué unidad iba).
 *
 *  702 ← 701: del 7° sólo llegaron el "01" y el "06". Sobre `piso-7.webp` la 02 es
 *  la 01 espejada en vertical (mismo orden estar-comedor → cocina → 3 dormitorios,
 *  con la terraza arriba en vez de abajo) y las dos son 4 amb. / 3 dorm. / 2 baños,
 *  así que sirve como aproximación —lo pidió Joaquim el 30-08—, pero **está espejado
 *  y las superficies no coinciden** (229 m² contra 217,65). Cuando Camila mande el
 *  "PLANTA 7MO PISO - 02.png", sacá esta entrada y agregalo a PLANS. */
const BORROWED = {
  "702": "piso-7-01",
};

if (!existsSync(SRC_DIR)) {
  console.error(`No existe ${SRC_DIR} — dejá ahí los planos de tipología del cliente.`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const units = JSON.parse(readFileSync(UNITS_JSON, "utf8"));
const kb = (n) => `${Math.round(n / 1024)} KB`;

// ── 1 · Imágenes ─────────────────────────────────────────────────────────────
const assigned = new Map(); // unitId → ruta pública
let failed = false;

for (const plan of PLANS) {
  const input = join(SRC_DIR, plan.src);
  if (!existsSync(input)) {
    console.warn(`⚠ falta ${plan.src} — se saltea (esas unidades quedan sin plano).`);
    failed = true;
    continue;
  }

  // 1 · Recorte al dibujo. Los renders vienen sobre una hoja enorme con el plano
  //     chico en el medio: en la tipología A el dibujo ocupa 1627 de 3508 px de
  //     ancho, o sea que más de la mitad del archivo es aire.
  const box = await contentBox(input);
  const info = await sharp(input)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    // 2 · SIN flatten: el plano se sirve con transparencia y apoya sobre el fondo
    //     de la tarjeta (`--panel` en la ficha, `--bg-2` en el buscador). Aplanado
    //     contra blanco, la sombra tenue del render se volvía un rectángulo gris
    //     que se veía como un "fondo" pegado al plano.
    // 3 · `withoutEnlargement` por si algún día llega un render chico.
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 100 })
    .toFile(join(OUT_DIR, `${plan.out}.webp`));

  const { W, H } = box.canvas;
  const savedCanvas = Math.round((1 - (box.width * box.height) / (W * H)) * 100);
  console.log(
    `${plan.src.padEnd(30)} → ${(plan.out + ".webp").padEnd(18)} ` +
      `${W}×${H} → recorte ${box.width}×${box.height} ` +
      `(−${savedCanvas}% de lienzo) → ${info.width}×${info.height}  ${kb(info.size)}`,
  );

  for (const id of plan.units) {
    if (!units[id]) {
      console.error(`✗ ${plan.src}: la unidad ${id} no existe en units.json`);
      failed = true;
      continue;
    }
    // Chequeo cruzado: el par de unidades del nombre del archivo tiene que
    // coincidir con la tipología que mapeó Camila en el Miro. Si no coincide,
    // uno de los dos está mal y NO hay que adivinar.
    if (plan.expect && units[id].tipologia !== plan.expect) {
      console.error(
        `✗ ${id}: el plano dice tipología ${plan.expect} pero units.json tiene ` +
          `${units[id].tipologia ?? "(ninguna)"} — revisar antes de seguir.`,
      );
      failed = true;
      continue;
    }
    assigned.set(id, `/plans/${plan.out}.webp`);
  }
}

for (const [id, out] of Object.entries({ ...INFERRED, ...BORROWED })) {
  if (!units[id]) {
    console.error(`✗ inferido: la unidad ${id} no existe en units.json`);
    failed = true;
    continue;
  }
  assigned.set(id, `/plans/${out}.webp`);
}

if (failed) {
  console.error("\n✗ Hubo errores — units.json NO se tocó.");
  process.exit(1);
}

// ── 2 · units.json ───────────────────────────────────────────────────────────
let changed = 0;
for (const [id, path] of assigned) {
  if (units[id].floorPlan !== path) {
    units[id].floorPlan = path;
    changed++;
  }
}
writeFileSync(UNITS_JSON, JSON.stringify(units, null, 2) + "\n");

const all = Object.keys(units);
const without = all.filter((id) => !assigned.has(id));
console.log(`\n✓ ${assigned.size}/${all.length} unidades con plano (${changed} actualizadas)`);
console.log(`· inferidas (numeración corrida del 6°): ${Object.keys(INFERRED).join(" ")}`);
console.log(
  `⚠ prestadas (el cliente no mandó SU plano): ${Object.entries(BORROWED)
    .map(([id, out]) => `${id} ← ${out}`)
    .join(" · ")}`
);
console.log(
  without.length
    ? `⚠ SIN plano (siguen en el placeholder): ${without.join(" ")} — falta pedírselo al cliente.`
    : "✓ ninguna unidad quedó en el placeholder.",
);
