// Clona los polígonos de una planta a otros pisos, remapeando el unitId.
//
// Los pisos 2 a 5 son la MISMA planta tipo: las unidades están en idéntica posición
// y sólo cambia el prefijo del id (201… → 301…). Trazar los 10 polígonos cuatro
// veces a mano es trabajo repetido y una fuente de errores (un vértice corrido en
// un piso y el hover salta). Se traza el piso 2 y se clona.
//
// El remapeo es por PREFIJO de piso: un polígono `205` del piso 2 se clona como
// `305` en el 3. Si el id destino no existe en units.json, el polígono se descarta
// y se avisa (así el 6° y el 7°, que tienen menos unidades, nunca quedan con
// polígonos huérfanos si alguien clona sobre ellos por error).
//
// Uso:  node scripts/clone-plate-polygons.mjs <pisoOrigen> <pisoDestino...>
//       node scripts/clone-plate-polygons.mjs 2 3 4 5
//       npm run plates:clone -- 2 3 4 5
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PLATES_JSON = join(ROOT, "src", "data", "plates.json");
const UNITS_JSON = join(ROOT, "src", "data", "units.json");

const [from, ...targets] = process.argv.slice(2);
if (!from || targets.length === 0) {
  console.error("Uso: node scripts/clone-plate-polygons.mjs <pisoOrigen> <pisoDestino...>");
  console.error("Ej.: node scripts/clone-plate-polygons.mjs 2 3 4 5");
  process.exit(1);
}
if (targets.includes(from)) {
  console.error(`El piso origen (${from}) no puede estar entre los destinos.`);
  process.exit(1);
}
for (const f of [from, ...targets]) {
  if (!existsSync(PLATES_JSON)) break;
  if (!/^\d+$/.test(f)) {
    console.error(`"${f}" no es un piso válido (se espera un número).`);
    process.exit(1);
  }
}

const file = JSON.parse(readFileSync(PLATES_JSON, "utf8"));
const units = JSON.parse(readFileSync(UNITS_JSON, "utf8"));
const plates = file.plates ?? [];

const source = plates.find((p) => p.floor === from);
if (!source) {
  console.error(`El piso ${from} no existe en plates.json.`);
  process.exit(1);
}
if (source.polygons.length === 0) {
  console.error(`El piso ${from} no tiene polígonos trazados todavía — no hay nada que clonar.`);
  process.exit(1);
}

/** "205" → "305" cuando se clona del piso 2 al 3. El sufijo (la UF) no se toca. */
const remap = (unitId, toFloor) =>
  unitId.startsWith(from) ? toFloor + unitId.slice(from.length) : null;

let cloned = 0;
for (const floor of targets) {
  const target = plates.find((p) => p.floor === floor);
  if (!target) {
    console.warn(`⚠ piso ${floor}: no existe en plates.json — se saltea.`);
    continue;
  }
  if (target.imageWidth !== source.imageWidth || target.imageHeight !== source.imageHeight) {
    console.warn(
      `⚠ piso ${floor}: el plano mide ${target.imageWidth}×${target.imageHeight} y el del piso ${from} ` +
        `${source.imageWidth}×${source.imageHeight}. Los polígonos NO son transferibles entre espacios ` +
        `distintos — se saltea.`,
    );
    continue;
  }

  const kept = [];
  const dropped = [];
  for (const poly of source.polygons) {
    const unitId = remap(poly.unitId, floor);
    if (!unitId) {
      dropped.push(`${poly.unitId} (no arranca con "${from}")`);
      continue;
    }
    if (!units[unitId]) {
      dropped.push(`${poly.unitId}→${unitId} (no existe en units.json)`);
      continue;
    }
    kept.push({ ...poly, unitId });
  }

  const before = target.polygons.length;
  target.polygons = kept;
  cloned += kept.length;
  console.log(
    `piso ${from} → piso ${floor}:  ${kept.length} polígono(s)` +
      (before ? `  (pisaba ${before} previo(s))` : "") +
      (dropped.length ? `\n    descartados: ${dropped.join(", ")}` : ""),
  );
}

writeFileSync(PLATES_JSON, JSON.stringify(file, null, 2) + "\n");
console.log(`\n✓ ${cloned} polígono(s) clonados → ${PLATES_JSON}`);
console.log("  Revisá el diff y commiteá.");
