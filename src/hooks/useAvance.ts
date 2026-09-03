"use client";

import { useEffect, useState } from "react";
import type { AvanceObra } from "@/lib/types";
import { API_AVANCE } from "@/lib/api";
import { parseAvance, type AirtableRecord } from "@/lib/airtable-parse";

/**
 * Trae el avance de obra EN VIVO desde /api/avance (Airtable). Devuelve `loading`
 * para mostrar un skeleton hasta que llega el dato, y `avance` = null si no hay
 * datos / la tabla no está configurada (el badge se oculta en ese caso).
 */
export function useAvance(): { avance: AvanceObra | null; loading: boolean } {
  const [avance, setAvance] = useState<AvanceObra | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(API_AVANCE)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        // Registros CRUDOS de Airtable; el parseo (elegir la fila más reciente y
        // resolver los nombres de columna) es el mismo que usa el build.
        const records = (data?.records as AirtableRecord[] | undefined) ?? [];
        setAvance(parseAvance(records));
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { avance, loading };
}
