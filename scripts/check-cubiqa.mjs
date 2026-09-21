// ─────────────────────────────────────────────────────────────────────────────
// Verifica el cruce entre el catálogo del back de Cubiqa y src/data/units.json.
//
//   npm run check:cubiqa                     ← le pega al back de .env.local
//   npm run check:cubiqa -- payload.json     ← contra una respuesta guardada
//
// POR QUÉ EXISTE. La integración falla ABIERTA y EN SILENCIO. El merge recorre
// units.json y descarta cualquier unidad del back cuyo número no sea una de sus
// keys (ver mergeLiveUnits). Si el catálogo se cargó con otra nomenclatura —"1 01",
// "Unidad 101", "10" sin el cero a la izquierda, todas válidas para el back— no
// matchea NADA: el sitio queda con todo "Disponible" y todo "Consultar", que es
// EXACTAMENTE cómo se ve hoy sin la integración, y sin un solo error en consola.
// Una integración muerta puede pasar un QA manual completo.
//
// Esto corre el MISMO parser que el navegador y el build, y sale con código != 0
// si el cruce no cierra. Es lo que hay que mirar antes de deployar, junto con
// `npm run deploy:config`.
//
// No tiene dependencias: Node 22 trae fetch y sabe importar TypeScript con
// --experimental-strip-types (ya está en el flag del script de package.json).
// ─────────────────────────────────────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

// `pathToFileURL` y no la ruta pelada: en Windows un `import("C:/…")` lo toma como
// un esquema de URL ("c:") y revienta con ERR_UNSUPPORTED_ESM_URL_SCHEME.
const { parseProyecto, mergeLiveUnits, unidadesHuerfanas } = await import(
  pathToFileURL(join(RAIZ, "src/lib/cubiqa-parse.ts")).href
);
const units = JSON.parse(await readFile(join(RAIZ, "src/data/units.json"), "utf8"));

// ── De dónde sale el payload ─────────────────────────────────────────────────

async function leerEnvLocal() {
  const env = {};
  try {
    const crudo = await readFile(join(RAIZ, ".env.local"), "utf8");
    for (const linea of crudo.split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env.local */
  }
  return env;
}

const archivo = process.argv[2];
let data;

if (archivo) {
  const crudo = JSON.parse(await readFile(archivo, "utf8"));
  // Acepta el sobre completo del back o el `data` pelado.
  data = crudo?.data ?? crudo?.project ?? crudo;
  console.log(`Leyendo ${archivo}`);
} else {
  const env = await leerEnvLocal();
  const base = (env.CUBIQA_API_BASE ?? "").replace(/\/+$/, "");
  const projectId = env.CUBIQA_PROJECT_ID ?? "";
  if (!base || !projectId) {
    console.error(
      "✖ Faltan CUBIQA_API_BASE y/o CUBIQA_PROJECT_ID en .env.local.\n" +
        "  (O pasá una respuesta guardada: npm run check:cubiqa -- payload.json)",
    );
    process.exit(1);
  }
  const url = `${base}/api/projects/${encodeURIComponent(projectId)}/public`;
  console.log(`GET ${url}`);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    const pista =
      res.status === 404
        ? "\n  404 = el id no existe O el proyecto está INACTIVO (el back no los distingue)."
        : "";
    console.error(`✖ El back respondió ${res.status}.${pista}\n  ${cuerpo.slice(0, 300)}`);
    process.exit(1);
  }
  data = (await res.json())?.data;
}

// ── El mismo parseo que corren el build y el navegador ───────────────────────

const { units: live, brochure } = parseProyecto(data);
const mergeado = mergeLiveUnits(units, live);

const idsLocales = Object.keys(units);
const nombresBack = Object.keys(live);
const huerfanas = unidadesHuerfanas(units, live);
const sinDato = idsLocales.filter((id) => !(id in live));

const problemas = [];
const avisos = [];

if (!nombresBack.length) {
  problemas.push("el back no devolvió NINGUNA unidad.");
}
if (huerfanas.length) {
  problemas.push(
    `${huerfanas.length} unidad(es) del back sin equivalente en units.json: ` +
      `${huerfanas.slice(0, 12).join(", ")}${huerfanas.length > 12 ? "…" : ""}\n` +
      `    El match es por el NÚMERO DE UNIDAD, como texto y exacto. units.json usa: ` +
      `${idsLocales.slice(0, 5).join(", ")}…`,
  );
}
if (sinDato.length) {
  problemas.push(
    `${sinDato.length} unidad(es) de units.json sin dato del back: ` +
      `${sinDato.slice(0, 12).join(", ")}${sinDato.length > 12 ? "…" : ""}\n` +
      `    Esas se quedan con el estado y el precio horneados.`,
  );
}

// Los ceros: no rompen nada gracias a los guards del parser, pero casi siempre
// significan una fila a medio cargar y conviene verlo ANTES de publicar.
const crudas = Array.isArray(data?.units) ? data.units : [];
const cuenta = (pred) => crudas.filter(pred).length;
const sinPrecio = cuenta((u) => !(u.usdPrice > 0));
const sinTotal = cuenta((u) => !(u.totalArea > 0));
const sinCubierta = cuenta((u) => !(u.coveredArea > 0));
const sinSemi = cuenta((u) => !(u.semiCoveredArea > 0));
const sinAmbientes = cuenta((u) => !(u.bedrooms > 0));
if (sinPrecio) avisos.push(`${sinPrecio} unidad(es) con usdPrice = 0 → quedan en "Consultar".`);
if (sinTotal) avisos.push(`${sinTotal} unidad(es) con totalArea = 0 → queda la superficie de units.json.`);
if (sinCubierta) avisos.push(`${sinCubierta} unidad(es) con coveredArea = 0 → idem.`);
if (sinSemi) avisos.push(`${sinSemi} unidad(es) con semiCoveredArea = 0 → queda la de units.json (las 63 la tienen cargada).`);
if (sinAmbientes) avisos.push(`${sinAmbientes} unidad(es) con bedrooms = 0 → quedan los ambientes de units.json.`);

const ESTADOS = new Set(["Available", "Reserved", "Sold"]);
const estadosRaros = [...new Set(crudas.map((u) => u.state).filter((s) => !ESTADOS.has(s)))];
if (estadosRaros.length) {
  problemas.push(
    `estado(s) que el showroom no conoce: ${estadosRaros.join(", ")}. ` +
      `Esas unidades se quedan con el estado horneado.`,
  );
}

const fraccionarios = crudas.filter((u) => Number.isFinite(u.bedrooms) && u.bedrooms % 1 !== 0);
if (fraccionarios.length) {
  avisos.push(
    `${fraccionarios.length} unidad(es) con ambientes fraccionarios ` +
      `(${fraccionarios.slice(0, 5).map((u) => `${u.name}: ${u.bedrooms}`).join(", ")}). ` +
      `Se muestran como "1,5 amb" — confirmá que sea intencional.`,
  );
}

// ── El diff, unidad por unidad: viejo → nuevo ────────────────────────────────

const m2 = (a) => (a == null ? "—" : `${a}`);
const filas = idsLocales.map((id) => {
  const a = units[id];
  const b = mergeado[id];
  const cambios = [];
  if (a.status !== b.status) cambios.push(`estado ${a.status}→${b.status}`);
  if (a.price !== b.price) cambios.push(`precio ${a.price}→${b.price}`);
  if (a.ambientes !== b.ambientes) cambios.push(`amb ${a.ambientes}→${b.ambientes}`);
  if (a.areas?.total !== b.areas?.total) cambios.push(`total ${m2(a.areas?.total)}→${m2(b.areas?.total)}`);
  if (a.areas?.interior !== b.areas?.interior) cambios.push(`cub ${m2(a.areas?.interior)}→${m2(b.areas?.interior)}`);
  if (a.areas?.exterior !== b.areas?.exterior) cambios.push(`semi ${m2(a.areas?.exterior)}→${m2(b.areas?.exterior)}`);
  if ((a.vistas ?? "") !== (b.vistas ?? "")) cambios.push(`vistas →${b.vistas ?? "—"}`);
  return { id, cambios };
});

const conCambios = filas.filter((f) => f.cambios.length);

console.log(
  `\nunits.json: ${idsLocales.length} unidades · back: ${nombresBack.length} · ` +
    `cruzan: ${idsLocales.length - sinDato.length}`,
);
console.log(
  `brochure: ${brochure ? `${brochure.filename} (${brochure.pageCount} págs., ${(brochure.size / 1e6).toFixed(1)} MB)` : "ninguno — se usa el PDF commiteado"}`,
);

const porEstado = Object.entries(
  Object.values(mergeado).reduce((acc, u) => ({ ...acc, [u.status]: (acc[u.status] ?? 0) + 1 }), {}),
)
  .map(([k, v]) => `${k}: ${v}`)
  .join(" · ");
console.log(`estados tras el merge → ${porEstado}`);

if (conCambios.length) {
  console.log(`\nCambios respecto de units.json (${conCambios.length} unidades):`);
  for (const f of conCambios) console.log(`  ${f.id.padEnd(5)} ${f.cambios.join(" · ")}`);
} else {
  console.log(`\n⚠ NINGUNA unidad cambia respecto de units.json.`);
  console.log(`  Si esperabas datos en vivo, esto es el síntoma de que el cruce no cierra.`);
}

if (avisos.length) {
  console.warn(`\n⚠ Avisos:`);
  for (const a of avisos) console.warn(`   · ${a}`);
}

if (problemas.length) {
  console.error(`\n✖ Problemas:`);
  for (const p of problemas) console.error(`   · ${p}`);
  process.exit(1);
}

console.log(`\n✓ El cruce cierra.`);
