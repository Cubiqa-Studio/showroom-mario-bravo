// Carga la EXPOSICIÓN (frente / contrafrente) de cada unidad en `src/data/units.json`.
//
// De dónde sale el dato: de las plantas generales del cliente, NO de Airtable — su
// base no tiene columna de orientación (columnas verificadas el 25-08: Piso, Unidad,
// Ambientes, Tipología, Precio USD, Anticipo, Saldo y las cuatro superficies).
//
// CÓMO SE DEDUJO, y por qué se puede confiar. Tres fuentes independientes coinciden:
//
//  1 · `_media-src/plantas/_planta-baja-amenities.png` fija la orientación de TODAS las
//      plantas: abajo está la CALLE (LOCAL 1 = el café, el hall con la recepción en el
//      medio, LOCAL 2 = el local de indumentaria), que es exactamente lo que se ve en
//      el render de la fachada. Arriba están la pileta, el deck y el parque.
//  2 · En `piso-tipo-2-5.png`, los rótulos 01, 02, 06 y 07 caen en la mitad de ABAJO,
//      con sus balcones contra ese borde; 03, 04, 05, 08, 09 y 10 en la de arriba.
//  3 · El tablero Miro del cliente ("Division showroom", 25-08) colorea la fachada a la
//      calle y la numera 1, 2, 6 y 7. Son 4 unidades, y en el render se cuentan 4
//      módulos de balcón por piso.
//
// EL 6° Y EL 7° SON PLANTAS DE RETIRO y no siguen la numeración del piso tipo:
//  · 6°: 601 y 606 son las grandes, ocupan el frente (se comen 01+02 y 06+07). Las seis
//        chicas quedan corridas un lugar (602↔03, 603↔04, 604↔05, 607↔08, 608↔09,
//        609↔10) y todas caen al contrafrente.
//  · 7°: 701 es la de abajo (terraza contra la calle) y 702 la de arriba (su balcón
//        terraza da al pulmón). La 706 CRUZA la planta —dormitorios arriba, estar
//        abajo— así que tiene las dos: se deja SIN dato y no muestra chip, antes que
//        etiquetarla mal.
//
// Uso:  node scripts/set-unit-exposure.mjs      (o `npm run units:exposure`)
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNITS_JSON = join(__dirname, "..", "src", "data", "units.json");

/** Pisos con planta tipo (misma distribución de las 10 unidades). */
const TIPO_FLOORS = ["1", "2", "3", "4", "5"];
/** Número de unidad dentro del piso tipo → a dónde da. */
const TIPO_FRENTE = ["01", "02", "06", "07"];
const TIPO_CONTRAFRENTE = ["03", "04", "05", "08", "09", "10"];

const EXPOSURE = {};
for (const f of TIPO_FLOORS) {
  for (const n of TIPO_FRENTE) EXPOSURE[f + n] = "frente";
  for (const n of TIPO_CONTRAFRENTE) EXPOSURE[f + n] = "contrafrente";
}

// 6° (retiro): las dos grandes al frente, las seis chicas al contrafrente.
EXPOSURE["601"] = "frente";
EXPOSURE["606"] = "frente";
for (const id of ["602", "603", "604", "607", "608", "609"]) {
  EXPOSURE[id] = "contrafrente";
}

// 7° (retiro).
EXPOSURE["701"] = "frente";
EXPOSURE["702"] = "contrafrente";

/** Unidades que dan a los DOS lados → sin chip, a propósito. */
const AMBAS = ["706"];

const units = JSON.parse(readFileSync(UNITS_JSON, "utf8"));
const ids = Object.keys(units);

let changed = 0;
let failed = false;

for (const [id, exposure] of Object.entries(EXPOSURE)) {
  if (!units[id]) {
    console.error(`✗ ${id} no existe en units.json`);
    failed = true;
    continue;
  }
  if (units[id].exposure !== exposure) {
    units[id].exposure = exposure;
    changed++;
  }
}

// Las que cruzan la planta: se limpia el campo por si quedó de una corrida anterior.
for (const id of AMBAS) {
  if (units[id] && units[id].exposure !== undefined) {
    delete units[id].exposure;
    changed++;
  }
}

if (failed) {
  console.error("\n✗ Hubo errores — units.json NO se tocó.");
  process.exit(1);
}

writeFileSync(UNITS_JSON, JSON.stringify(units, null, 2) + "\n");

const frente = ids.filter((id) => units[id].exposure === "frente");
const contra = ids.filter((id) => units[id].exposure === "contrafrente");
const sin = ids.filter((id) => !units[id].exposure);

console.log(`✓ ${frente.length + contra.length}/${ids.length} unidades con exposición (${changed} actualizadas)`);
console.log(`  frente ........ ${frente.length}  ${frente.join(" ")}`);
console.log(`  contrafrente .. ${contra.length}  ${contra.join(" ")}`);
console.log(
  sin.length
    ? `  sin dato ...... ${sin.length}  ${sin.join(" ")}  (cruzan la planta: dan a los dos lados)`
    : "  sin dato ...... 0",
);

// Chequeo de coherencia: en los pisos tipo tienen que dar 4 y 6 por piso.
for (const f of TIPO_FLOORS) {
  const delPiso = ids.filter((id) => id.startsWith(f) && id.length === 3);
  const fr = delPiso.filter((id) => units[id].exposure === "frente").length;
  const co = delPiso.filter((id) => units[id].exposure === "contrafrente").length;
  if (fr !== 4 || co !== 6) {
    console.error(`✗ piso ${f}: ${fr} al frente y ${co} al contrafrente (esperaba 4 y 6)`);
    process.exitCode = 1;
  }
}
