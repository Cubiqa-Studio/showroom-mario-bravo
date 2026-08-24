import type { FloorPlate, Stop, UnitPolygon } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// "Superficie" del editor de polígonos: la mínima abstracción común entre un
// Stop (vista del flyby) y una FloorPlate (planta de piso). El digitalizador y
// el sidebar trabajan contra esto, así el MISMO editor sirve para ambos.
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorSurface {
  /** Clave única para storage de trabajo en curso, ej. "stop:3" / "plate:7". */
  key: string;
  /** Título mostrado en el sidebar/encabezado, ej. "stop 3" / "piso 7". */
  label: string;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  polygons: UnitPolygon[];
  /** Endpoint POST para persistir { polygons, imageWidth, imageHeight }. */
  saveUrl: string;
  /** Endpoint GET del archivo completo (export-all). */
  exportAllUrl: string;
  /** Nombre del archivo destino, ej. "stops.json" / "plates.json". */
  fileName: string;
}

export function surfaceFromStop(stop: Stop): EditorSurface {
  return {
    key: `stop:${stop.id}`,
    label: `stop ${stop.id}`,
    image: stop.image,
    imageWidth: stop.imageWidth,
    imageHeight: stop.imageHeight,
    polygons: stop.polygons,
    saveUrl: `/api/admin/stops/${stop.id}`,
    exportAllUrl: "/api/admin/stops",
    fileName: "stops.json",
  };
}

export function surfaceFromPlate(plate: FloorPlate): EditorSurface {
  return {
    key: `plate:${plate.floor}`,
    label: `piso ${plate.floor}`,
    image: plate.image,
    imageWidth: plate.imageWidth,
    imageHeight: plate.imageHeight,
    polygons: plate.polygons,
    saveUrl: `/api/admin/plates/${plate.floor}`,
    exportAllUrl: "/api/admin/plates",
    fileName: "plates.json",
  };
}
