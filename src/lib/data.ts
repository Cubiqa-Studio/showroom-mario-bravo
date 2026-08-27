import stopsData from "@/data/stops.json";
import unitsData from "@/data/units.json";
import flybyData from "@/data/flyby.json";
import { SITE } from "@/data/site";
import type {
  AvanceObra,
  FloorPlate,
  FlybyFile,
  FlybySegment,
  SiteConfig,
  Stop,
  StopsFile,
  Unit,
  Units,
} from "./types";
import { readStopsFile } from "./stops-store";
import { readPlatesFile } from "./plates-store";
import { fetchAirtableUnits, fetchAvance, mergeLiveUnits } from "./airtable";

// ─────────────────────────────────────────────────────────────────────────────
// Single data-access seam.
//
// GEOMETRÍA (stops): persistente vía `stops-store` — Blob de Netlify en prod
//   (editable online), con el JSON commiteado como semilla/fallback. Por eso
//   getStops/getStop son async.
// METADATA (units) y FLYBY (segments): horneados del JSON (el editor no los toca).
// Para ir 100% a Supabase/Airtable se cambia sólo el body de estas funciones.
// ─────────────────────────────────────────────────────────────────────────────

const units = unitsData as unknown as Units;
const flybyFile = flybyData as unknown as FlybyFile;
// Conjunto de vistas que EXISTEN (estructura estable; editar polígonos no agrega
// ni quita stops), usado para validar los segmentos del flyby.
const seedStops = (stopsData as unknown as StopsFile).stops;

export async function getStops(): Promise<Stop[]> {
  return (await readStopsFile()).stops;
}

export async function getStop(id: number): Promise<Stop | undefined> {
  return (await readStopsFile()).stops.find((s) => s.id === id);
}

export function getUnits(): Units {
  return units;
}

/** ESTÁTICA (units.json, sin Airtable). Para datos en vivo usá `getLiveUnit`. */
export function getUnit(unitId: string): Unit | undefined {
  return units[unitId];
}

// ── Capa EN VIVO (Airtable) ──────────────────────────────────────────────────
// Pisa el estado/precio/tipología/ambientes/superficies de Airtable sobre la
// metadata base de units.json (match por id de unidad). Async porque consulta
// Airtable (con cache de 60 s y fallback a units.json si está caído). El color
// del contorno y los datos de la landing se recalculan solos al cambiar el dato
// en Airtable, sin tocar geometría ni rebuild.

/** Todas las unidades con los campos en vivo de Airtable ya mergeados. */
export async function getLiveUnits(): Promise<Units> {
  return mergeLiveUnits(units, await fetchAirtableUnits());
}

/** Una unidad ya mergeada con Airtable. */
export async function getLiveUnit(unitId: string): Promise<Unit | undefined> {
  return (await getLiveUnits())[unitId];
}

/** Avance de obra (% general + fecha) desde Airtable. null si no hay datos. */
export async function getAvance(): Promise<AvanceObra | null> {
  return fetchAvance();
}

/** Variante de `getOtherAvailableUnits` sobre un map ya mergeado (evita re-fetch). */
export function otherAvailableUnitsFrom(map: Units, excludeId: string): UnitWithId[] {
  return Object.entries(map)
    .filter(([id, u]) => id !== excludeId && u.status === "available")
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Variante de `getFloorUnits` sobre un map ya mergeado (evita re-fetch). */
export function floorUnitsFrom(map: Units, unitId: string): UnitWithId[] {
  const floor = floorOf(unitId);
  return Object.entries(map)
    .filter(([id]) => floorOf(id) === floor)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Todos los ids de unidad (para `generateStaticParams` de la landing). */
export function getUnitIds(): string[] {
  return Object.keys(units);
}

/** Unidad + su id (la key del JSON), para construir links a /residencia/:id. */
export type UnitWithId = Unit & { id: string };

/** ESTÁTICA (units.json). Para datos en vivo usá `otherAvailableUnitsFrom(await getLiveUnits(), id)`.
 *  Otras unidades DISPONIBLES (carrusel de la landing), excluyendo `excludeId`. */
export function getOtherAvailableUnits(excludeId: string): UnitWithId[] {
  return Object.entries(units)
    .filter(([id, u]) => id !== excludeId && u.status === "available")
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Piso de una unidad = su id sin los dos últimos dígitos ("704" → "7", "1704" → "17"). */
export function floorOf(unitId: string): string {
  return unitId.length > 2 ? unitId.slice(0, -2) : unitId;
}

/**
 * ESTÁTICA (units.json). Para datos en vivo usá `floorUnitsFrom(await getLiveUnits(), id)`.
 * Todas las unidades del MISMO piso que `unitId` (incluida ella), ordenadas.
 * Alimenta la pestaña "Planta del piso" (vecinos + datos reales para el tooltip).
 */
export function getFloorUnits(unitId: string): UnitWithId[] {
  const floor = floorOf(unitId);
  return Object.entries(units)
    .filter(([id]) => floorOf(id) === floor)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * Geometría de la planta de un piso para la LANDING. Devuelve la plate si ya hay
 * un PLANO real cargado (imagen ≠ placeholder), aunque todavía no se hayan trazado
 * los polígonos — así "Planta del piso" muestra el plano del piso ni bien existe, y
 * cuando se tracen los polígonos se superponen encima sin cambiar nada. Sólo cae al
 * esquemático si el piso no tiene plano. Persistencia vía `plates-store` (Blob de
 * Netlify en prod, semilla en local) → por eso es async.
 */
export async function getPlate(floor: string): Promise<FloorPlate | null> {
  const plate = (await readPlatesFile()).plates.find((p) => p.floor === floor);
  if (!plate) return null;
  const hasRealImage = !!plate.image && !plate.image.includes("placeholder");
  return hasRealImage || plate.polygons.length > 0 ? plate : null;
}

/** Todas las plates (admin/export). */
export async function getPlates(): Promise<FloorPlate[]> {
  return (await readPlatesFile()).plates;
}

/**
 * Pisos TRAZABLES = los que tienen plano, en el orden en que están en `plates.json`
 * (de abajo hacia arriba). Es lo que lista el menú del editor.
 *
 * NO es `getFloors()`: ese devuelve los prefijos de unidad (1 a 7) y dejaba afuera
 * plantas que SÍ hay que poder trazar aunque no tengan unidades propias — la azotea
 * del 8°, donde van las terrazas privadas de las unidades del 7°, es el caso.
 */
export async function getPlateFloors(): Promise<string[]> {
  return (await readPlatesFile()).plates.map((p) => p.floor);
}

/**
 * Plate CRUDA de un piso para el EDITOR (aunque no tenga polígonos todavía, así
 * hay imagen sobre la cual trazar). Si el piso no está en el archivo, devuelve
 * una plate por defecto con la imagen placeholder para empezar a digitalizar.
 */
export async function getPlateForEdit(floor: string): Promise<FloorPlate> {
  const found = (await readPlatesFile()).plates.find((p) => p.floor === floor);
  return found ?? { floor, image: "/plans/placeholder.svg", imageWidth: 1600, imageHeight: 1000, polygons: [] };
}

/** Pisos existentes (= prefijos de unidad), ordenados. Para el índice del editor. */
export function getFloors(): string[] {
  const floors = Array.from(new Set(Object.keys(units).map(floorOf))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  // `SITE.floors` es lo que consume el selector de pisos del cliente (no puede
  // importar units.json sin arrastrarlo entero al bundle). Si alguien agrega un
  // piso en units.json y se olvida de site.ts, el selector queda incompleto en
  // silencio: acá se avisa en dev, donde el error todavía es barato.
  //
  // Es un chequeo de SUPERCONJUNTO, no de igualdad: `SITE.floors` incluye a propósito
  // plantas SIN unidades (subsuelo, planta baja, azotea) que igual se muestran. Lo que
  // no puede pasar es que falte un piso que SÍ tiene unidades.
  if (process.env.NODE_ENV !== "production") {
    const declared = new Set(SITE.floors);
    const faltan = floors.filter((f) => !declared.has(f));
    if (faltan.length) {
      console.warn(
        `[data] SITE.floors (${SITE.floors.join(",") || "vacío"}) no incluye ${faltan.join(",")}, ` +
          `que sí tienen unidades en units.json. Actualizá src/data/site.ts — el selector ` +
          `de "Planta del piso" usa SITE.floors.`,
      );
    }
  }
  return floors;
}

/** Config a nivel proyecto (broker, ubicación, specs por defecto). */
export function getSite(): SiteConfig {
  return SITE;
}

// ── Fase 2: flyby (transiciones pre-renderizadas entre stops). Misma costura. ──

export function getFlyby(): FlybySegment[] {
  // Sólo segmentos cuyos extremos existen como stops, así el viewer nunca queda
  // apuntando a una vista inexistente (integridad: la costura filtra datos malos).
  const ids = new Set(seedStops.map((s) => s.id));
  return flybyFile.segments.filter((s) => ids.has(s.from) && ids.has(s.to));
}

/** El segmento de avance from → to, si existe. La vuelta usa el mismo al revés. */
export function getSegment(from: number, to: number): FlybySegment | undefined {
  return flybyFile.segments.find((s) => s.from === from && s.to === to);
}

/**
 * Los assets pesados del showroom (stills + frames del flyby), en el ORDEN en que se
 * tocan. Lo consume la INTRO para irlos bajando mientras el visitante mira la portada,
 * así al apretar "Descubrir" ya están en la cache del navegador y el showroom no tiene
 * que esperar nada: sin "Cargando recorrido… %" y con las flechas listas de entrada.
 *
 * Es SINCRÓNICA a propósito — no usa `getStops()` porque eso leería el Blob y
 * convertiría la intro en dinámica, que es lo último que querés en la primera pantalla
 * del sitio. Las rutas de imagen son estables aunque cambie la geometría: el editor de
 * polígonos edita puntos, no agrega ni quita vistas.
 *
 * El orden es el mismo criterio que usa el preload del `FlybyViewer`: primero lo que
 * destraba la pantalla, después lo que destraba el primer click, y al final el resto.
 */
export function getShowroomPreloadSrcs(): string[] {
  const segments = getFlyby();
  const first = seedStops[0];
  // El tramo que sale de la primera vista (lo que gatea la primera flecha) y el
  // siguiente: el flujo dominante es seguir avanzando.
  const fwd = first ? segments.find((s) => s.from === first.id) : undefined;
  const nextFwd = fwd ? segments.find((s) => s.from === fwd.to) : undefined;
  // El Set dedup-ea conservando el orden de inserción.
  return Array.from(
    new Set([
      ...(first ? [first.image] : []),
      ...(fwd?.frames ?? []),
      ...(nextFwd?.frames ?? []),
      ...seedStops.map((s) => s.image),
      ...segments.flatMap((s) => s.frames),
    ]),
  );
}
