"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import type { SiteConfig, Stop, Units } from "@/lib/types";
import { floorUnitsFrom, otherAvailableUnitsFrom, vistasDeUnidadFrom } from "@/lib/units";
import { unitIdDeRuta } from "@/lib/residencia";
import { DetailOverlay } from "./DetailOverlay";

interface UnitDetailHostProps {
  /** Unidades EN VIVO (ya refrescadas desde el proxy por ShowroomClient). */
  units: Units;
  /** Geometría de las vistas, para el cierre de la landing (`TowerSection`). */
  stops: Stop[];
  site: SiteConfig;
}

/**
 * Monta la ficha de unidad como OVERLAY sobre el showroom, mirando la URL.
 *
 * Es el reemplazo de la ruta interceptada `app/@modal/(.)residencia/[id]`, que
 * `output: "export"` no soporta (Next corta el build: "Intercepting routes are not
 * supported with static export"). La interceptación la decidía el SERVIDOR por el
 * header `Next-URL` del fetch RSC; en un sitio estático no hay servidor que la decida.
 *
 * La pieza que lo hace posible es que Next parchea `history.pushState` para mantener
 * `usePathname()` en sincronía sin navegar (ver `abrirFichaSobreShowroom` en
 * src/lib/residencia.ts). Entonces:
 *   · el click sobre una unidad reescribe la URL a /residencia/:id,
 *   · este componente lo ve por el pathname y monta el overlay,
 *   · el árbol de rutas sigue siendo /showroom → el FlybyViewer NO se desmonta y al
 *     cerrar volvés a la misma cámara (era el punto de la interceptación),
 *   · el back del navegador y el `router.back()` del DetailOverlay cierran igual.
 *
 * Los datos que antes armaba el server component los deriva acá el cliente: ya tiene
 * el map de unidades y los stops (los recibe el showroom), y las derivaciones son
 * puras (src/lib/units.ts). Como `units` viene ya refrescado desde el proxy, la ficha
 * abierta sobre el showroom muestra el estado/precio EN VIVO, no el del build.
 */
export function UnitDetailHost({ units, stops, site }: UnitDetailHostProps) {
  const pathname = usePathname();
  const unitId = unitIdDeRuta(pathname);
  const unit = unitId ? units[unitId] : undefined;

  // Un id que no existe en el map. En la práctica es inalcanzable (todos los
  // disparadores salen del propio map), pero si pasa NO dejamos la URL apuntando a
  // una ficha inexistente con el showroom a la vista: la devolvemos al exterior.
  // Antes esto lo hacía el `redirect("/")` de la ruta interceptada.
  useEffect(() => {
    if (unitId && !unit) window.history.replaceState(null, "", "/showroom");
  }, [unitId, unit]);

  const derivados = useMemo(() => {
    if (!unitId || !unit) return null;
    return {
      others: otherAvailableUnitsFrom(units, unitId),
      floorUnits: floorUnitsFrom(units, unitId),
      vistas: vistasDeUnidadFrom(stops, unitId),
    };
  }, [unitId, unit, units, stops]);

  if (!unitId || !unit || !derivados) return null;

  return (
    <DetailOverlay
      unit={unit}
      unitId={unitId}
      others={derivados.others}
      site={site}
      floorUnits={derivados.floorUnits}
      vistas={derivados.vistas}
    />
  );
}
