"use client";

import { useEffect, useState } from "react";
import type { AvanceObra } from "@/lib/types";
import { API_AVANCE } from "@/lib/api";
import { parseAvance, type AirtableRecord } from "@/lib/airtable-parse";

// ─────────────────────────────────────────────────────────────────────────────
// Avance de obra. Es LO ÚNICO que sigue saliendo de Airtable: el back de Cubiqa no
// tiene entidad de avance de obra (ver la nota en src/lib/airtable.ts).
//
// Mismo criterio de cache que las unidades: UN pedido por carga de página. Antes
// este hook no tenía dedupe de ningún tipo y disparaba en cada montaje del badge y
// del modal, que en una sesión son varios.
// ─────────────────────────────────────────────────────────────────────────────

/** Promesa a nivel de MÓDULO: se evalúa una vez por documento, sobrevive a las
 *  navegaciones del router y se muere en el F5. Mismo patrón que project-store. */
let enVuelo: Promise<AvanceObra | null> | null = null;
/** `undefined` = todavía no se pidió. */
let resuelto: AvanceObra | null | undefined;

function traerAvance(): Promise<AvanceObra | null> {
  if (resuelto !== undefined) return Promise.resolve(resuelto);
  if (enVuelo) return enVuelo;
  enVuelo = fetch(API_AVANCE)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      // Registros CRUDOS de Airtable; el parseo (elegir la fila más reciente y
      // resolver los nombres de columna) es el mismo que usa el build.
      const records = (data?.records as AirtableRecord[] | undefined) ?? [];
      resuelto = parseAvance(records);
      return resuelto;
    })
    .catch(() => {
      // El fallo NO se memoiza: un remontaje reintenta.
      enVuelo = null;
      return null;
    });
  return enVuelo;
}

/**
 * Trae el avance de obra EN VIVO desde /api/avance. Devuelve `loading` para
 * mostrar un skeleton hasta que llega el dato, y `avance` = null si no hay datos /
 * la tabla no está configurada (el badge se oculta en ese caso).
 */
export function useAvance(): { avance: AvanceObra | null; loading: boolean } {
  const [avance, setAvance] = useState<AvanceObra | null>(() => resuelto ?? null);
  const [loading, setLoading] = useState(resuelto === undefined);

  useEffect(() => {
    let alive = true;
    void traerAvance().then((a) => {
      if (!alive) return;
      setAvance(a);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { avance, loading };
}
