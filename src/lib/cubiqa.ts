import "server-only";
import type { CubiqaBrochure } from "./cubiqa-types";
import { parseProyecto, type LiveUnitFields, type ProyectoEnVivo } from "./cubiqa-parse";

// ─────────────────────────────────────────────────────────────────────────────
// Capa del back de Cubiqa (server-only): config, red y resiliencia. El MAPEO vive
// en `./cubiqa-parse`, que es puro y lo comparten el build y el navegador (una
// sola fuente de verdad para la traducción de los enums).
//
// Fetch crudo a `GET {CUBIQA_API_BASE}/api/projects/{CUBIQA_PROJECT_ID}/public`,
// sin SDK. El endpoint es PÚBLICO: no lleva token (es la única ruta de proyectos
// del back sin `verifyToken`). Aun así las dos variables se leen del server y NO
// son `NEXT_PUBLIC_*` — ver la nota de abajo.
//
// CUÁNDO CORRE ESTO. Con `output: "export"` corre en el BUILD, para hornear en el
// HTML un estado plausible desde el primer frame (y para que el bloque SEO del
// showroom y el JSON-LD de cada ficha viajen con datos reales). En RUNTIME el dato
// en vivo lo pide el navegador al proxy del mismo dominio y lo parsea con el mismo
// `cubiqa-parse`. Ver src/lib/api.ts y deploy/hostinger/api/proyecto.php.
//
// En `next dev` esto además atiende /api/proyecto (route.dev.ts), así que trabajar
// en local es idéntico a lo que era con Airtable.
//
// CACHE: el Data Cache de Next vía `next: { revalidate: 60 }`. En un build de
// export el efecto práctico es deduplicar las llamadas dentro del mismo build (las
// 63 fichas + el showroom comparten UNA lectura en vez de pedir 64 veces); en
// `next dev` acota la staleness a 60 s. Si el back falla, devolvemos vacío y el
// merge deja la metadata de units.json intacta (fallback robusto).
//
// ⚠ POR QUÉ NO SON `NEXT_PUBLIC_*`. Ninguna de las dos es un secreto (el endpoint
// es público y el id es un uuid), pero una `NEXT_PUBLIC_` se sustituye como TEXTO
// dentro del bundle en el build: apuntar el showroom a otro proyecto exigiría
// rebuild + resubir el DEPLOY.zip. Leídas del server, se cambian editando
// `showroom-config.php` en el hosting, en una línea. Ésa es también la propiedad
// que hace este diseño reutilizable en los otros showrooms.
//
// ⚠ AVANCE DE OBRA NO ESTÁ ACÁ. El back de Cubiqa no tiene entidad de avance, así
// que ese dato sigue saliendo de Airtable (`./airtable`). Es lo único que queda.
// ─────────────────────────────────────────────────────────────────────────────

export { mergeLiveUnits, unidadesHuerfanas } from "./cubiqa-parse";
export type { LiveUnitFields } from "./cubiqa-parse";

interface CubiqaConfig {
  /** Origen del back, sin barra final ("http://localhost:3001"). */
  base: string;
  projectId: string;
}

function readConfig(): CubiqaConfig | null {
  const base = process.env.CUBIQA_API_BASE?.trim().replace(/\/+$/, "");
  const projectId = process.env.CUBIQA_PROJECT_ID?.trim();
  // Sin las dos no hay integración: el merge cae a units.json y el build SIGUE
  // SALIENDO. Es a propósito — así un clon limpio, una preview y el propio sitio
  // se pueden buildear con el back todavía sin desplegar.
  if (!base || !projectId) return null;
  return { base, projectId };
}

/** URL del endpoint público del proyecto. */
function urlProyecto(cfg: CubiqaConfig): string {
  return `${cfg.base}/api/projects/${encodeURIComponent(cfg.projectId)}/public`;
}

/**
 * La URL del back, o `null` si falta config. La usa el route handler de dev
 * (`/api/proyecto`), que pasa el `data` CRUDO en vez del parseado: así la URL se
 * arma en UN solo lugar y dev no puede quedar apuntando a otra cosa que el build.
 */
export function urlProyectoPublico(): string | null {
  const cfg = readConfig();
  return cfg ? urlProyecto(cfg) : null;
}

/** Qué variables de entorno faltan para que la integración funcione. `[]` = ninguna.
 *  Se devuelve en el JSON de dev para que abrir el endpoint diga qué falta. */
export function configFaltante(): string[] {
  return [
    ...(process.env.CUBIQA_API_BASE?.trim() ? [] : ["CUBIQA_API_BASE"]),
    ...(process.env.CUBIQA_PROJECT_ID?.trim() ? [] : ["CUBIQA_PROJECT_ID"]),
  ];
}

/** Techo de espera de UNA llamada al back.
 *
 *  6 s y no 5: cuando la base de datos del back tiene un hipo, su extensión de
 *  reintentos de Prisma quema un par de segundos de backoff ANTES de contestar el
 *  error. Con 5 s abortábamos justo en la ventana en la que igual iba a fallar,
 *  pero sin distinguir "el back está mal" de "la red está lenta". */
const TIMEOUT_MS = 6000;

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

/** Envoltorio de respuesta del back: `{ statusCode, success, data }`. */
interface Sobre {
  success?: boolean;
  data?: unknown;
}

/** Trae el `data` del endpoint público. Lanza si el HTTP no es 2xx. */
async function fetchProyecto(cfg: CubiqaConfig): Promise<unknown> {
  const res = await fetch(urlProyecto(cfg), {
    headers: { Accept: "application/json" },
    // Opt-in de cache de Next (en 15 el fetch NO cachea por defecto): revalida a
    // los 60 s → dentro de un build, las 64 páginas comparten una sola lectura.
    next: { revalidate: 60 },
    // Corta un back lento (cold start, base fría) y convierte el cuelgue en el
    // fallback a units.json en vez de en un build colgado.
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 404 es ambiguo del lado del back: devuelve lo mismo para "ese id no existe"
    // y para "el proyecto está desactivado". Lo decimos para no perder media hora.
    const pista =
      res.status === 404
        ? ' — el id no existe o el proyecto está INACTIVO (el back no los distingue)'
        : "";
    throw new Error(`Cubiqa ${res.status}${pista}: ${body.slice(0, 200)}`);
  }
  const sobre = (await res.json()) as Sobre;
  return sobre?.data;
}

/** Última respuesta BUENA, en memoria del proceso.
 *
 *  Sin esto, cualquier hipo del back (un timeout, un 503) tira la capa en vivo
 *  entera y el sitio se hornea con units.json: precios "Consultar" y superficies
 *  viejas. Con esto, un fallo aislado sirve la última copia buena y el build no
 *  sale degradado.
 *
 *  Vive lo que vive el proceso (un build, o hasta el próximo reload en dev) y es
 *  sólo un COLCHÓN: el cacheo real lo hace el Data Cache de Next. */
let ultimaBuena: { data: unknown; at: number } | null = null;

/** `fetchProyecto` + colchón: ante un fallo devuelve la última copia buena si la
 *  hay; si nunca hubo una, propaga el error (→ fallback a units.json). */
async function fetchProyectoResiliente(cfg: CubiqaConfig): Promise<unknown> {
  try {
    const data = await fetchProyecto(cfg);
    ultimaBuena = { data, at: Date.now() };
    return data;
  } catch (err) {
    if (!ultimaBuena) throw err;
    const mins = Math.round((Date.now() - ultimaBuena.at) / 60000);
    console.warn(
      `[cubiqa] el back falló (${reason(err)}) — sirvo la última copia buena ` +
        `(hace ${mins} min).`,
    );
    return ultimaBuena.data;
  }
}

/** El proyecto EN VIVO (unidades mapeadas + brochure), o vacío si no hay config o
 *  si falla la carga. Nunca lanza: el sitio tiene que poder buildearse igual. */
export async function fetchProyectoEnVivo(): Promise<ProyectoEnVivo> {
  const cfg = readConfig();
  if (!cfg) return { units: {}, brochure: null };
  try {
    return parseProyecto(await fetchProyectoResiliente(cfg));
  } catch (err) {
    console.error(`[cubiqa] ${reason(err)} — sigo con units.json.`);
    return { units: {}, brochure: null };
  }
}

/** Map `{ [nº de unidad]: LiveUnitFields }`. `{}` si no hay datos. */
export async function fetchCubiqaUnits(): Promise<Record<string, LiveUnitFields>> {
  return (await fetchProyectoEnVivo()).units;
}

/** El brochure del proyecto. `null` si no hay ninguno cargado (o no hay config). */
export async function fetchCubiqaBrochure(): Promise<CubiqaBrochure | null> {
  return (await fetchProyectoEnVivo()).brochure;
}
