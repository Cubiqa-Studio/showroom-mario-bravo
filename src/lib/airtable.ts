import "server-only";
import type { AvanceObra, Unit, Units } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de Airtable (server-only). Replica el patrón de la referencia (REMAX /
// MERCED): fetch crudo a la REST API de Airtable (sin SDK), token SÓLO en el
// servidor.
//
// CACHE: una sola capa, el Data Cache de Next vía `next: { revalidate: 60 }`. En
// Next 15 el fetch NO cachea por defecto, así que lo opt-in-eamos explícito →
// staleness acotada a 60 s y ≤1 llamada/min a Airtable. Persistente en Netlify
// (plugin) y en Node/Hostinger (cache en filesystem, `.next/cache`). Dentro de un
// mismo render, la request-memoization de Next deduplica las llamadas repetidas a
// getLiveUnits (metadata + page). Si Airtable falla, devolvemos {} / null y el
// merge deja la metadata de units.json intacta (fallback robusto).
//
// Airtable es la FUENTE EN VIVO de: Estado (→ color del contorno), Precio,
// Ambientes y Superficies. El resto (planos, tours, geometría, dorm/baño) sigue
// viviendo en el código (units.json) y es el fallback.
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

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableConfig {
  token: string;
  baseId: string;
  unitsTable: string;
  avanceTable: string;
}

function readConfig(): AirtableConfig | null {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const unitsTable = process.env.AIRTABLE_UNITS_TABLE_ID;
  const avanceTable = process.env.AIRTABLE_AVANCE_TABLE_ID;
  // Sin token/base/tabla de unidades no hay integración: el merge cae a units.json.
  if (!token || !baseId || !unitsTable) return null;
  return { token, baseId, unitsTable, avanceTable: avanceTable ?? "" };
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
  /** Vistas (texto, columna "Vistas" de Airtable): "Montaña", "Parcial al lago"… */
  vistas?: string;
  piso?: string;
}

type AirtableFields = Record<string, unknown>;
interface AirtableRecord {
  id: string;
  fields?: AirtableFields;
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
 *  Ver la nota en fetchAirtableUnits: la tipología del sitio es la letra A–E. */
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

/** Trae TODOS los registros de una tabla (pagina por `offset`; 44 unidades entran
 *  en una página, pero paginamos por las dudas). Lanza si el HTTP no es 2xx. */
async function fetchTable(cfg: AirtableConfig, table: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${AIRTABLE_API}/${cfg.baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${cfg.token}` },
      // Opt-in de cache de Next (en 15 el fetch NO cachea por defecto): revalida a
      // los 60 s → ≤1 hit/min a Airtable y staleness acotada a 60 s.
      next: { revalidate: 60 },
      // Corta una Airtable lenta (cold cache / latencia de región): /showroom es
      // force-dynamic y ESPERA este fetch antes de emitir HTML. El try/catch de
      // abajo convierte el AbortError en el fallback {} → el showroom pinta con
      // units.json en ≤2.5 s en vez de colgar el reveal tras "Descubrir".
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Airtable ${res.status} en "${table}": ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { records?: AirtableRecord[]; offset?: string };
    if (data.records) records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// ── Unidades ─────────────────────────────────────────────────────────────────

/** Map { [Unidad]: LiveUnitFields } desde Airtable. {} si no hay config o si
 *  falla la carga (el merge deja la metadata de units.json intacta). */
export async function fetchAirtableUnits(): Promise<Record<string, LiveUnitFields>> {
  const cfg = readConfig();
  if (!cfg) return {};
  try {
    const recs = await fetchTable(cfg, cfg.unitsTable);
    const map: Record<string, LiveUnitFields> = {};
    for (const r of recs) {
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
        superficieExterior: toNum(pick(f, "Superficie Semi/Desc", "Superficie Semicubierta", "Superficie Descubierta")),
        superficieTotal: toNum(pick(f, "Superficie Total")),
        vistas: str(pick(f, "Vistas")),
        piso: str(pick(f, "Piso")),
      };
    }
    return map;
  } catch (err) {
    console.error("[airtable] fallo al traer unidades:", err);
    return {};
  }
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
 *  (o la primera si no hay fechas). null si no hay tabla configurada o sin filas. */
export async function fetchAvance(): Promise<AvanceObra | null> {
  const cfg = readConfig();
  if (!cfg || !cfg.avanceTable) return null;
  try {
    const recs = await fetchTable(cfg, cfg.avanceTable);
    if (!recs.length) return null;
    const rows = recs
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
        // 0 % silencioso y /api/avance no da pistas del typo.
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
  } catch (err) {
    console.error("[airtable] fallo al traer avance de obra:", err);
    return null;
  }
}
