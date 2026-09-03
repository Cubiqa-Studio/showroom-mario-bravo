import type { AvanceObra, Unit, Units } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Parseo de los registros de Airtable → tipos del dominio. TODO PURO: sin fetch,
// sin token, sin `server-only`. Corre igual en el build y en el navegador.
//
// Está separado de `airtable.ts` porque con el export estático la data en vivo se
// pide DOS veces desde lugares distintos, y las dos tienen que interpretar los
// registros exactamente igual:
//
//   · EN EL BUILD (server): `airtable.ts` le pega a la API de Airtable con el token
//     y hornea el resultado en el HTML.
//   · EN EL NAVEGADOR (runtime): el sitio le pide los registros al proxy —que es el
//     que tiene el token— y los parsea acá mismo (ver useLiveUnits).
//
// Duplicar esta lógica en el proxy (PHP) sería tener dos fuentes de verdad para el
// mismo parseo tolerante de nombres de columna; por eso el proxy es TONTO: pasa los
// registros crudos de Airtable y no sabe nada del dominio.
//
// NOMBRES DE COLUMNA: se leen por nombre exacto, con alias tolerantes, porque cada
// showroom arma su base y los nombres varían. Los de TIER Bravo (verificados contra
// la base el 25-08-2026):
//   Unidad · Piso · Ambientes · Tipología · Precio USD · Anticipo USD · Saldo USD
//   Superficie Cubierta · Superficie Semi/Desc · Superficie Común · Superficie Total
//
// ⚠ FALTA "Estado". Es la columna que pinta el contorno de cada unidad (verde
// disponible / amarillo reservada). Mientras no exista, TODAS las unidades quedan
// con el estado de units.json ("available"): el showroom se ve como si estuviera
// todo disponible. Hay que pedirle al cliente que la agregue.
// ─────────────────────────────────────────────────────────────────────────────

export type AirtableFields = Record<string, unknown>;

export interface AirtableRecord {
  id: string;
  fields?: AirtableFields;
}

/** Campos que Airtable controla EN VIVO para una unidad (match por "Unidad"). */
export interface LiveUnitFields {
  status?: Unit["status"];
  price?: string;
  tipologia?: string;
  ambientes?: number;
  /** Superficie cubierta en m² (→ areas.interior). */
  superficieCubierta?: number;
  /** Superficie semicubierta / descubierta en m² (→ areas.exterior). */
  superficieExterior?: number;
  /** Superficie total en m² (→ areas.total). */
  superficieTotal?: number;
  /** Proporcional de espacios comunes en m² (→ areas.comun). */
  superficieComun?: number;
  /** Vistas (texto, columna "Vistas" de Airtable): "Montaña", "Parcial al lago"… */
  vistas?: string;
  piso?: string;
}

/** "Disponible" → available · "Reservada/Reservado" → reserved · resto → undefined
 *  (deja el estado base de units.json). Tolerante a mayúsculas/acentos/género. */
function mapEstado(v: unknown): Unit["status"] | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (s.startsWith("reserv")) return "reserved";
  if (s.startsWith("dispon")) return "available";
  return undefined;
}

/** Sólo una LETRA suelta ("A", "c") → mayúscula. Cualquier otra cosa → undefined.
 *  Ver la nota en `parseUnits`: la tipología del sitio es la letra A–E. */
function letterOnly(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return /^[a-zA-Z]$/.test(t) ? t.toUpperCase() : undefined;
}

/** Número tolerante: acepta number o string ("85", "85,5 m²", "100m2"). */
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

/** Primer campo presente entre varios nombres posibles. Absorbe las diferencias de
 *  nomenclatura entre bases sin tener que tocar el código en cada showroom. */
function pick(f: AirtableFields, ...names: string[]): unknown {
  for (const n of names) {
    const v = f[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Precio legible desde un número plano de Airtable: 226939 → "USD 226.939".
 *  La columna de esta base se llama "Precio USD", así que la moneda es explícita y
 *  conviene hornearla en el string (si no, la UI muestra "$226.939" y no se sabe
 *  de qué moneda habla). Un valor que ya venga con texto se respeta tal cual. */
function money(v: unknown): string | undefined {
  const raw = str(v);
  if (!raw) return undefined;
  if (/[a-zA-Z$]/.test(raw)) return raw;
  const n = toNum(raw);
  if (n == null || n <= 0) return undefined;
  return `USD ${n.toLocaleString("es-AR")}`;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === "number") return String(v);
  return undefined;
}

/** Map { [Unidad]: LiveUnitFields } desde los registros crudos de Airtable. */
export function parseUnits(records: AirtableRecord[]): Record<string, LiveUnitFields> {
  const map: Record<string, LiveUnitFields> = {};
  for (const r of records) {
    const f = r.fields ?? {};
    // "Unidad" es la clave de match con units.json ("101", "001", …). Es TEXTO
    // (los PB conservan el cero a la izquierda): no la convertimos a número.
    const unidad = str(f["Unidad"]);
    if (!unidad) continue;
    map[unidad] = {
      status: mapEstado(pick(f, "Estado", "Estado de la unidad", "Disponibilidad")),
      price: money(pick(f, "Precio USD", "Precio")),
      // La columna "Tipología" de ESTA base repite el conteo de ambientes
      // ("3 AMBIENTES"), que ya viene en "Ambientes". Nuestra tipología es la
      // LETRA A–E (la que agrupa plano y recorrido 360°, mapeada desde el Miro y
      // guardada en units.json), así que sólo aceptamos de Airtable un valor que
      // sea realmente una letra — si el cliente algún día carga letras, entra sola.
      tipologia: letterOnly(pick(f, "Tipología", "Tipologia")),
      ambientes: toNum(pick(f, "Ambientes")),
      superficieCubierta: toNum(pick(f, "Superficie Cubierta")),
      superficieExterior: toNum(
        pick(f, "Superficie Semi/Desc", "Superficie Semicubierta", "Superficie Descubierta"),
      ),
      superficieTotal: toNum(pick(f, "Superficie Total")),
      superficieComun: toNum(pick(f, "Superficie Común", "Superficie Comun")),
      vistas: str(pick(f, "Vistas")),
      piso: str(pick(f, "Piso")),
    };
  }
  return map;
}

/** Pisa los campos en vivo de Airtable sobre la metadata base de units.json.
 *  Sólo pisa lo que Airtable trae (campo presente) → si Airtable está caído o
 *  vacío, queda intacto el dato de units.json (fallback robusto). */
export function mergeLiveUnits(base: Units, live: Record<string, LiveUnitFields>): Units {
  const out: Units = {};
  for (const [id, u] of Object.entries(base)) {
    const f = live[id];
    if (!f) {
      out[id] = u;
      continue;
    }
    const areas = { ...(u.areas ?? {}) };
    if (f.superficieTotal != null) areas.total = f.superficieTotal;
    if (f.superficieCubierta != null) areas.interior = f.superficieCubierta;
    if (f.superficieExterior != null) areas.exterior = f.superficieExterior;
    if (f.superficieComun != null) areas.comun = f.superficieComun;
    out[id] = {
      ...u,
      status: f.status ?? u.status,
      price: f.price ?? u.price,
      ambientes: f.ambientes ?? u.ambientes,
      tipologia: f.tipologia ?? u.tipologia,
      vistas: f.vistas ?? u.vistas,
      areas,
    };
  }
  return out;
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
