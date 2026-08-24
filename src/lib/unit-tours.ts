// ─────────────────────────────────────────────────────────────────────────────
// Tours 360° por UNIDAD, agrupados por piso — alimenta el submenú "Unidades"
// dentro de "Tours" en el SideMenu.
//
// Single source of truth = el campo `tour360` de units.json (el mismo recorrido
// que muestra el hero de cada landing). NO se duplica nada: cargar/actualizar el
// 360° de una unidad en units.json la hace aparecer (o cambiar) acá sola.
//
// Client-safe: importa SÓLO units.json + tipos (igual que site.ts), así lo puede
// usar el SideMenu, que es un client component.
// ─────────────────────────────────────────────────────────────────────────────
import unitsData from "@/data/units.json";
import type { Units } from "./types";

const units = unitsData as unknown as Units;

/** Una unidad con tour 360° disponible. */
export interface UnitTour {
  /** Id/clave de la unidad en units.json, ej. "101". */
  id: string;
  /** Etiqueta mostrada (= `residence`), ej. "101". */
  residence: string;
  /** URL del recorrido 360° (Kuula). */
  url: string;
}

/** Un piso con sus unidades que tienen tour. */
export interface FloorTours {
  /** Piso crudo: "0" (PB), "1", "2", "3". */
  floor: string;
  units: UnitTour[];
}

/** Piso de una unidad = su id sin los dos últimos dígitos ("101" → "1", "001" → "0"). */
function floorOf(unitId: string): string {
  return unitId.length > 2 ? unitId.slice(0, -2) : unitId;
}

/**
 * Unidades con tour 360°, agrupadas por piso y ordenadas (PB → 1° → 2° → 3°, y
 * dentro de cada piso por número). Las unidades SIN `tour360` se omiten — la lista
 * crece sola a medida que se cargan más links en units.json.
 */
export function getUnitToursByFloor(): FloorTours[] {
  const byFloor = new Map<string, UnitTour[]>();

  for (const [id, u] of Object.entries(units)) {
    const url = u.tour360?.trim();
    if (!url) continue;
    const floor = floorOf(id);
    if (!byFloor.has(floor)) byFloor.set(floor, []);
    byFloor.get(floor)!.push({ id, residence: u.residence, url });
  }

  return Array.from(byFloor.entries())
    .map(([floor, list]) => ({
      floor,
      units: list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    }))
    .sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
}
