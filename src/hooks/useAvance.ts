"use client";

import { useEffect, useState } from "react";
import type { AvanceObra } from "@/lib/types";

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
    fetch("/api/avance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        setAvance((data?.avance as AvanceObra | null) ?? null);
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
