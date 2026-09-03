"use client";

import { useEffect, useRef, useState } from "react";
import unitsData from "@/data/units.json";
import type { Units } from "@/lib/types";
import { API_UNIDADES } from "@/lib/api";
import { mergeLiveUnits, parseUnits, type AirtableRecord } from "@/lib/airtable-parse";

// Metadata base del sitio (planos, tours, geometría, dorm/baño). Airtable sólo pisa
// estado/precio/ambientes/superficies encima. Ya venía en el bundle (lo importan el
// buscador y el plan maestro como fallback), así que no agrega peso.
const BASE = unitsData as unknown as Units;

/**
 * Las unidades EN VIVO (estado/precio/tipología/superficies ya mergeados con
 * Airtable), o `null` mientras no llegaron — o si el pedido falló.
 *
 * Devolver `null` en vez de un fallback es lo que le permite a quien llama
 * distinguir "todavía no sé" de "ya sé": la ficha standalone usa eso para seguir
 * mostrando lo que horneó el servidor hasta tener el dato real, sin tener que
 * recibir el map entero por props (ver ResidenciaLandingLive).
 *
 * Un solo pedido por montaje. `enabled` permite abrirlo lazily (p. ej. `enabled` =
 * modal abierto) para no pegarle al endpoint hasta que haga falta.
 */
export function useLiveUnitsOrNull(enabled = true): Units | null {
  const [units, setUnits] = useState<Units | null>(null);
  const pedido = useRef(false);

  useEffect(() => {
    if (!enabled || pedido.current) return;
    pedido.current = true;
    let vivo = true;
    fetch(API_UNIDADES)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // El endpoint devuelve los registros CRUDOS de Airtable; el parseo y el
        // merge sobre units.json se hacen acá (misma lógica que usa el build, ver
        // src/lib/airtable-parse.ts). Sin registros no hay nada que pisar.
        const records = data?.records as AirtableRecord[] | undefined;
        if (!vivo || !records?.length) return;
        setUnits(mergeLiveUnits(BASE, parseUnits(records)));
      })
      .catch(() => {
        // Sin conexión / proxy caído → se queda en null y manda lo horneado.
        // Se libera el flag para que un remontaje vuelva a intentar.
        pedido.current = false;
      });
    return () => {
      vivo = false;
    };
  }, [enabled]);

  return units;
}

/**
 * Igual que `useLiveUnitsOrNull` pero con un piso: arranca en `fallback` y lo
 * reemplaza cuando llega el dato real. Si nunca llega, queda el fallback (no rompe).
 *
 * Es la forma que consumen el showroom (donde el fallback son las unidades horneadas
 * en el build) y los componentes que no las reciben por props — p. ej. el
 * MasterplanModal, que se monta tanto en el showroom como en la ficha.
 */
export function useLiveUnits(fallback: Units, enabled = true): Units {
  return useLiveUnitsOrNull(enabled) ?? fallback;
}
