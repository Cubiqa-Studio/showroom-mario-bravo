import "server-only";
import type { AvanceObra } from "./types";
import {
  parseAvance,
  parseUnits,
  type AirtableRecord,
  type LiveUnitFields,
} from "./airtable-parse";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de Airtable (server-only): config, red y resiliencia. El PARSEO de los
// registros vive en `./airtable-parse`, que es puro y lo comparten el build y el
// navegador (una sola fuente de verdad para los nombres de columna).
//
// Fetch crudo a la REST API de Airtable (sin SDK), token SÓLO en el servidor.
//
// CUÁNDO CORRE ESTO. Con `output: "export"` corre en el BUILD, para hornear en el
// HTML un estado plausible desde el primer frame (y para que el bloque SEO del
// showroom y el JSON-LD de cada ficha viajen con datos reales). En RUNTIME el dato
// en vivo lo pide el navegador al proxy —que es el que guarda el token— y lo parsea
// con el mismo `airtable-parse`. Ver src/lib/api.ts y deploy/hostinger/api/.
//
// En `next dev` esto además atiende /api/unidades y /api/avance (route.dev.ts), así
// que trabajar en local es idéntico a lo que era.
//
// CACHE: el Data Cache de Next vía `next: { revalidate: 60 }`. En un build de export
// el efecto práctico es deduplicar las llamadas dentro del mismo build (las 61 fichas
// + el showroom comparten UNA lectura de Airtable en vez de pedir 62 veces); en
// `next dev` acota la staleness a 60 s. Si Airtable falla, devolvemos {} / null y el
// merge deja la metadata de units.json intacta (fallback robusto).
//
// Airtable es la FUENTE EN VIVO de: Estado (→ color del contorno), Precio,
// Ambientes y Superficies. El resto (planos, tours, geometría, dorm/baño) sigue
// viviendo en el código (units.json) y es el fallback.
// ─────────────────────────────────────────────────────────────────────────────

export { mergeLiveUnits } from "./airtable-parse";
export type { LiveUnitFields } from "./airtable-parse";

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

/** Techo de espera de UNA llamada a Airtable. */
const TIMEOUT_MS = 5000;

/** Motivo en UNA línea. Un AbortError de `AbortSignal.timeout` es un DOMException:
 *  logueado entero escupe la tabla de constantes INDEX_SIZE_ERR…DATA_CLONE_ERR y
 *  tapa la consola sin decir nada útil. */
function reason(err: unknown): string {
  if (err instanceof Error) {
    return err.name === "TimeoutError" || err.name === "AbortError"
      ? `sin respuesta en ${TIMEOUT_MS} ms`
      : err.message;
  }
  return String(err);
}

/** Trae TODOS los registros de una tabla (pagina por `offset`; 61 unidades entran
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
      // los 60 s → dentro de un build, las 62 páginas comparten una sola lectura.
      next: { revalidate: 60 },
      // Corta una Airtable lenta (cold cache / latencia de región). El try/catch de
      // `fetchTableResilient` convierte el AbortError en la última copia buena (o en
      // units.json) en vez de colgar el build.
      //
      // 5 s y no 2,5: el primer hit de un proceso frío paga DNS + TLS + el cold
      // start de la tabla, y con 2,5 s abortaba de rutina en dev.
      signal: AbortSignal.timeout(TIMEOUT_MS),
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

/** Última respuesta BUENA por tabla, en memoria del proceso.
 *
 *  Sin esto, cualquier hipo de Airtable (un timeout, un 503) tira la capa en vivo
 *  entera y el showroom se hornea con units.json: precios "Consultar" y superficies
 *  viejas. Con esto, un fallo aislado sirve la última copia buena y el build no
 *  sale degradado.
 *
 *  Vive lo que vive el proceso (un build, o hasta el próximo reload en dev) y es
 *  sólo un COLCHÓN: el cacheo real lo hace el Data Cache de Next. */
const lastGood = new Map<string, { records: AirtableRecord[]; at: number }>();

/** `fetchTable` + colchón: ante un fallo devuelve la última copia buena de ESA
 *  tabla si la hay; si nunca hubo una, propaga el error (→ fallback a units.json). */
async function fetchTableResilient(cfg: AirtableConfig, table: string): Promise<AirtableRecord[]> {
  try {
    const records = await fetchTable(cfg, table);
    lastGood.set(table, { records, at: Date.now() });
    return records;
  } catch (err) {
    const cached = lastGood.get(table);
    if (!cached) throw err;
    const mins = Math.round((Date.now() - cached.at) / 60000);
    console.warn(
      `[airtable] "${table}" falló (${reason(err)}) — sirvo la última copia buena ` +
        `(${cached.records.length} filas, hace ${mins} min).`,
    );
    return cached.records;
  }
}

/** Registros CRUDOS de la tabla de unidades. Es lo que sirve /api/unidades (en dev)
 *  y lo que devuelve el proxy PHP (en prod): el cliente los parsea con
 *  `airtable-parse`. `[]` si no hay config o si falla la carga. */
export async function fetchAirtableUnitRecords(): Promise<AirtableRecord[]> {
  const cfg = readConfig();
  if (!cfg) return [];
  try {
    return await fetchTableResilient(cfg, cfg.unitsTable);
  } catch (err) {
    console.error(`[airtable] unidades: ${reason(err)} — sigo con units.json.`);
    return [];
  }
}

/** Registros CRUDOS de la tabla de avance de obra. `[]` si no está configurada. */
export async function fetchAirtableAvanceRecords(): Promise<AirtableRecord[]> {
  const cfg = readConfig();
  if (!cfg || !cfg.avanceTable) return [];
  try {
    return await fetchTableResilient(cfg, cfg.avanceTable);
  } catch (err) {
    console.error(`[airtable] avance de obra: ${reason(err)} — el modal queda vacío.`);
    return [];
  }
}

/** Map { [Unidad]: LiveUnitFields } desde Airtable. {} si no hay config o si
 *  falla la carga (el merge deja la metadata de units.json intacta). */
export async function fetchAirtableUnits(): Promise<Record<string, LiveUnitFields>> {
  return parseUnits(await fetchAirtableUnitRecords());
}

/** Avance de obra (% general + fecha). null si no hay tabla configurada o sin filas. */
export async function fetchAvance(): Promise<AvanceObra | null> {
  return parseAvance(await fetchAirtableAvanceRecords());
}
