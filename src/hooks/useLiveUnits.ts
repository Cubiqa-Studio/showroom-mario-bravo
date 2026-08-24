"use client";

import { useEffect, useRef, useState } from "react";
import type { Units } from "@/lib/types";

/**
 * Trae las unidades EN VIVO desde /api/unidades (estado/precio/etc. ya mergeados
 * con Airtable) para componentes CLIENTE que no las reciben por props — p. ej. el
 * MasterplanModal, que se monta tanto en el showroom como en la landing.
 *
 * Arranca con `fallback` (units.json estático) y, una vez `enabled`, hace UN fetch
 * y reemplaza el map. Si el fetch falla, queda el fallback (nunca rompe). Pensado
 * para abrir lazily: pasá `enabled` = (modal abierto) para no pegarle al endpoint
 * hasta que haga falta.
 */
export function useLiveUnits(fallback: Units, enabled = true): Units {
  const [units, setUnits] = useState<Units>(fallback);
  const fetched = useRef(false);

  useEffect(() => {
    if (!enabled || fetched.current) return;
    fetched.current = true;
    let alive = true;
    fetch("/api/unidades")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.units) setUnits(data.units as Units);
      })
      .catch(() => {
        // Sin conexión / error → nos quedamos con el fallback estático.
        fetched.current = false;
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return units;
}
