import "server-only";
import type { AvanceObra } from "./types";
import { parseAvance, type AirtableRecord } from "./airtable-parse";

// ─────────────────────────────────────────────────────────────────────────────
// Capa de Airtable (server-only) — HOY SÓLO PARA EL AVANCE DE OBRA.
//
// Las UNIDADES y el BROCHURE se migraron al back de Cubiqa (ver `./cubiqa`). Esto
// quedó vivo por una sola razón: ese back no tiene ninguna entidad de avance de
// obra —no hay dónde guardar el porcentaje ni la fecha—, y el modal "Avance de
// obra" es una función que el cliente usa y actualiza él mismo. Sacarlo habría
// sido una regresión visible que nadie pidió, a cambio de prolijidad.
//
// O sea: el token de Airtable y la tabla de avance siguen en `showroom-config.php`.
// El día que Cubiqa agregue `progress` al proyecto, `useAvance` apunta a
// `/api/proyecto` y este archivo, `airtable-parse` y `avance.php` se borran.
//
// El PARSEO vive en `./airtable-parse` (puro, compartido con el navegador).
//
// CUÁNDO CORRE. En `next dev` atiende /api/avance (route.dev.ts). En producción el
// dato lo pide el navegador al proxy PHP —que es el que guarda el token— y lo
// parsea con el mismo `airtable-parse`.
//
// CACHE: `next: { revalidate: 60 }` + el colchón de "última copia buena" de abajo.
// ─────────────────────────────────────────────────────────────────────────────

const AIRTABLE_API = "https://api.airtable.com/v0";

interface AirtableConfig {
  token: string;
  baseId: string;
  avanceTable: string;
}

function readConfig(): AirtableConfig | null {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const avanceTable = process.env.AIRTABLE_AVANCE_TABLE_ID;
  // Sin las tres no hay avance: el badge y el modal se ocultan solos.
  if (!token || !baseId || !avanceTable) return null;
  return { token, baseId, avanceTable };
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

/** Trae TODOS los registros de una tabla (pagina por `offset`; la de avance tiene
 *  un puñado de filas, pero paginamos por las dudas). Lanza si el HTTP no es 2xx. */
async function fetchTable(cfg: AirtableConfig, table: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${AIRTABLE_API}/${cfg.baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${cfg.token}` },
      // Opt-in de cache de Next (en 15 el fetch NO cachea por defecto).
      next: { revalidate: 60 },
      // Corta una Airtable lenta (cold cache / latencia de región). 5 s y no 2,5:
      // el primer hit de un proceso frío paga DNS + TLS + el cold start de la
      // tabla, y con 2,5 s abortaba de rutina en dev.
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

/** Última respuesta BUENA por tabla, en memoria del proceso: un fallo aislado
 *  sirve la copia anterior en vez de dejar el modal vacío. */
const lastGood = new Map<string, { records: AirtableRecord[]; at: number }>();

/** `fetchTable` + colchón: ante un fallo devuelve la última copia buena de ESA
 *  tabla si la hay; si nunca hubo una, propaga el error. */
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

/** Registros CRUDOS de la tabla de avance de obra. Es lo que sirve /api/avance (en
 *  dev) y lo que devuelve el proxy PHP (en prod): el cliente los parsea con
 *  `airtable-parse`. `[]` si no está configurada. */
export async function fetchAirtableAvanceRecords(): Promise<AirtableRecord[]> {
  const cfg = readConfig();
  if (!cfg) return [];
  try {
    return await fetchTableResilient(cfg, cfg.avanceTable);
  } catch (err) {
    console.error(`[airtable] avance de obra: ${reason(err)} — el modal queda vacío.`);
    return [];
  }
}

/** Avance de obra (% general + fecha). null si no hay tabla configurada o sin filas. */
export async function fetchAvance(): Promise<AvanceObra | null> {
  return parseAvance(await fetchAirtableAvanceRecords());
}
