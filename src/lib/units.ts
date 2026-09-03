import type { Stop, Unit, Units } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Derivaciones PURAS sobre el map de unidades y la geometría de los stops.
//
// Viven acá y no en `data.ts` porque `data.ts` arrastra la capa de Airtable
// (`import "server-only"`) y los stores de Netlify Blobs: importarlo desde un
// componente CLIENTE rompe el build. Con el export estático eso pasó de ser un
// detalle a ser estructural — la ficha ahora se abre SOBRE el showroom desde el
// cliente (ver src/components/gallery/UnitDetailHost.tsx), así que el cliente
// necesita las mismas derivaciones que antes calculaba el servidor.
//
// `data.ts` las re-exporta, así los imports que ya existían siguen funcionando.
// ─────────────────────────────────────────────────────────────────────────────

/** Unidad + su id (la key del JSON), para construir links a /residencia/:id. */
export type UnitWithId = Unit & { id: string };

/** Una vista del exterior donde ESTA unidad tiene polígono trazado. */
export interface VistaUnidad {
  stopId: number;
  image: string;
  /** Tamaño natural del render = viewBox del overlay (coordenadas 1:1). */
  width: number;
  height: number;
  points: string;
}

/** Piso de una unidad = su id sin los dos últimos dígitos ("704" → "7", "1704" → "17"). */
export function floorOf(unitId: string): string {
  return unitId.length > 2 ? unitId.slice(0, -2) : unitId;
}

/** Otras unidades DISPONIBLES (carrusel de la landing), excluyendo `excludeId`. */
export function otherAvailableUnitsFrom(map: Units, excludeId: string): UnitWithId[] {
  return Object.entries(map)
    .filter(([id, u]) => id !== excludeId && u.status === "available")
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Todas las unidades del MISMO piso que `unitId` (incluida ella), ordenadas. */
export function floorUnitsFrom(map: Units, unitId: string): UnitWithId[] {
  const floor = floorOf(unitId);
  return Object.entries(map)
    .filter(([id]) => floorOf(id) === floor)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * Las vistas del showroom en las que la unidad está marcada, en orden de stop.
 *
 * Lo consume el cierre de la landing (`TowerSection`), que no muestra un render
 * genérico sino LA vista desde la que entró el visitante, con su unidad señalada.
 * Devuelve sólo lo necesario para dibujarla y no los stops enteros: cada stop trae
 * los polígonos de las 63 unidades y esto viaja en el HTML de cada landing.
 */
export function vistasDeUnidadFrom(stops: Stop[], unitId: string): VistaUnidad[] {
  const vistas: VistaUnidad[] = [];
  for (const stop of stops) {
    const poly = stop.polygons.find((p) => p.unitId === unitId);
    if (!poly) continue;
    vistas.push({
      stopId: stop.id,
      image: stop.image,
      width: stop.imageWidth ?? 1920,
      height: stop.imageHeight ?? 1080,
      points: poly.points,
    });
  }
  return vistas;
}
