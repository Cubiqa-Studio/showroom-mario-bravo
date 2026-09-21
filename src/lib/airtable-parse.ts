import type { AvanceObra } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Parseo de los registros de Airtable → tipos del dominio. TODO PURO: sin fetch,
// sin token, sin `server-only`. Corre igual en el build y en el navegador.
//
// HOY QUEDA SÓLO EL AVANCE DE OBRA. El parseo de UNIDADES vivía acá y se fue a
// `./cubiqa-parse` cuando el catálogo pasó al back de Cubiqa; lo de avance sigue
// en Airtable porque ese back no tiene entidad de avance de obra (ver la nota
// larga en `./airtable`).
//
// Está separado de `airtable.ts` porque el dato se pide DESDE DOS LUGARES y los
// dos tienen que interpretar los registros igual:
//   · EN EL BUILD (server): `airtable.ts` le pega a la API con el token.
//   · EN EL NAVEGADOR: el sitio le pide los registros al proxy —que es el que
//     tiene el token— y los parsea acá mismo (ver useAvance).
// Duplicar esto en el proxy (PHP) sería tener dos fuentes de verdad para el mismo
// parseo tolerante de nombres de columna; por eso el proxy es TONTO: pasa los
// registros crudos y no sabe nada del dominio.
// ─────────────────────────────────────────────────────────────────────────────

export type AirtableFields = Record<string, unknown>;

export interface AirtableRecord {
  id: string;
  fields?: AirtableFields;
}

/** Número tolerante: acepta number o string ("85", "85,5 %", "52%"). */
function toNum(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!m) return undefined;
    const n = parseFloat(m[0]);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === "number") return String(v);
  return undefined;
}

// ── Avance de obra ─────────────────────────────────────────────────────────────

/** Timestamp ordenable de una fecha. Date.parse entiende ISO (lo que devuelve un
 *  campo Date de Airtable) y muchos otros formatos; si no parsea, va último. */
function dateTs(d?: string): number {
  const n = d ? Date.parse(d) : NaN;
  return Number.isNaN(n) ? -Infinity : n;
}

/** Avance de obra: % general + fecha. Toma la fila con la Fecha más reciente
 *  (o la primera si no hay fechas). null si no hay filas. */
export function parseAvance(records: AirtableRecord[]): AvanceObra | null {
  if (!records.length) return null;
  const rows = records
    .map((r) => {
      const f = r.fields ?? {};
      // Columnas reales de la tabla "Avance de Obra" (con fallbacks tolerantes).
      const percent =
        toNum(f["Porcentaje"]) ??
        toNum(f["Avance General (%)"]) ??
        toNum(f["Avance General"]) ??
        toNum(f["Avance"]);
      // Aviso de diagnóstico: la fila existe pero ninguna columna de % matcheó
      // → casi seguro un nombre de columna distinto. Sin esto, el modal muestra
      // 0 % silencioso y el endpoint no da pistas del typo.
      if (percent === undefined) {
        console.warn(
          `[airtable] avance: fila ${r.id} sin columna de porcentaje reconocida ` +
            `(esperaba "Porcentaje"). Mostrando 0 %.`,
        );
      }
      return {
        percent: percent ?? 0,
        milestone: str(f["Hito en curso"]) ?? str(f["Hito"]),
        delivery: str(f["Fecha de entrega"]),
        date: str(f["Última actualización"]) ?? str(f["Fecha"]),
        note: str(f["Notas"]) ?? str(f["Nota"]),
      } satisfies AvanceObra;
    })
    // Más reciente primero por "Última actualización" (robusto vía Date.parse).
    .sort((a, b) => dateTs(b.date) - dateTs(a.date));
  return rows[0];
}
