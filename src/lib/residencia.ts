import type { Unit } from "./types";

/**
 * Query param con el stop del showroom desde el que se entró a la unidad. Lo escribe
 * el click sobre el polígono y lo lee el cierre de la landing (`TowerSection`), que
 * muestra ESA vista con la unidad señalada en vez de un render genérico.
 *
 * Va por la URL —y no por estado en memoria— para que sobreviva a un refresh y a un
 * link compartido. Si falta o apunta a una vista donde la unidad no está trazada, se
 * cae a la primera vista que la tenga.
 */
export const PARAM_VISTA = "vista";

/** Prefijo de las rutas de ficha. Una sola definición para escribirlas y leerlas. */
export const RUTA_RESIDENCIA = "/residencia/";

// ─────────────────────────────────────────────────────────────────────────────
// Apertura de la ficha SOBRE el showroom, sin navegar.
//
// Antes esto lo hacía una RUTA INTERCEPTADA (`app/@modal/(.)residencia/[id]`):
// `router.push("/residencia/704")` renderizaba la ficha en el slot @modal con el
// showroom vivo debajo. Con `output: "export"` eso NO existe — Next corta el build
// con "Intercepting routes are not supported with static export", porque la
// interceptación se decide en el SERVIDOR (por el header `Next-URL` del fetch RSC)
// y en un sitio estático no hay servidor que la decida.
//
// El reemplazo usa el History API NATIVO, que Next parchea a propósito para esto
// (ver node_modules/next/dist/client/components/app-router.js: "Ensures usePathname
// and useSearchParams hold the newly provided url"): `pushState` despacha un
// ACTION_RESTORE con el árbol de rutas ACTUAL y la URL nueva → la barra dice
// /residencia/704 y `usePathname()` lo refleja, pero el árbol sigue siendo
// /showroom y el FlybyViewer NO se desmonta (cámara y scroll preservados, que es
// justo lo que daba la interceptación).
//
// De ahí en adelante todo lo demás sigue igual y sin tocar:
//   · <ZoomLayer> ya reaccionaba al pathname → el zoom-in/out anda solo.
//   · el back del navegador dispara popstate → Next restaura /showroom → la ficha
//     se desmonta y el zoom-out arranca. `router.back()` del DetailOverlay sigue
//     siendo la forma correcta de cerrar.
//   · un F5 sobre /residencia/704 pide el HTML horneado de la ficha standalone
//     (app/residencia/[id]), igual que antes.
//
// ⚠ El primer argumento va en `null` A PROPÓSITO. El parche de Next hace bypass si
// el `data` que le pasás ya trae sus marcas internas (`__NA` / `_N`): pasarle
// `window.history.state` haría que la URL cambie SIN avisarle al router, y entonces
// `usePathname()` seguiría en /showroom → la ficha nunca se abriría. Next copia solo
// su estado interno a la entrada nueva.
// ─────────────────────────────────────────────────────────────────────────────

/** El id de unidad de una ruta de ficha, o null si la ruta no es una ficha. */
export function unitIdDeRuta(pathname: string | null | undefined): string | null {
  if (!pathname?.startsWith(RUTA_RESIDENCIA)) return null;
  const resto = pathname.slice(RUTA_RESIDENCIA.length);
  // Sin barras: /residencia/704 sí, /residencia/704/algo no.
  if (!resto || resto.includes("/")) return null;
  try {
    return decodeURIComponent(resto);
  } catch {
    return resto;
  }
}

interface AbrirFichaOpts {
  /** Stop del showroom desde el que se entró (query `?vista=`). */
  vista?: number;
  /**
   * `true` para NO apilar historial. Los saltos LATERALES entre unidades (carrusel,
   * plano de la planta, plan maestro) reemplazan: así el historial queda
   * `/showroom → /residencia/<actual>` y un solo back vuelve al exterior, en vez de
   * tener que desandar una entrada por unidad visitada.
   */
  reemplazar?: boolean;
}

/**
 * Abre (o cambia) la ficha de una unidad SOBRE el showroom: reescribe la URL sin
 * navegar. Sólo tiene sentido en el cliente y con el showroom montado — desde la
 * ficha standalone hay que navegar de verdad (router.replace).
 */
export function abrirFichaSobreShowroom(unitId: string, opts: AbrirFichaOpts = {}): void {
  const url = new URL(window.location.href);
  url.pathname = `${RUTA_RESIDENCIA}${unitId}`;
  if (opts.vista != null) url.searchParams.set(PARAM_VISTA, String(opts.vista));
  else url.searchParams.delete(PARAM_VISTA);

  const destino = url.pathname + url.search + url.hash;
  if (opts.reemplazar) window.history.replaceState(null, "", destino);
  else window.history.pushState(null, "", destino);
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivaciones para la landing de detalle. Mantienen la landing "data-driven":
// si la unidad trae el campo, se usa; si no, se deriva de sus otros datos (NO
// hardcodeado a una unidad puntual). Reemplazá poblando units.json.
// ─────────────────────────────────────────────────────────────────────────────

// Renders del hero para las unidades SIN tour 360°: las 13 del 6° y el 7° (las de
// los pisos 1 a 5 muestran su recorrido embebido y no pasan por acá).
//
// DROP DEL 30-08. El cliente mandó material propio para estas unidades y reemplaza
// al set anterior (fachada + cocina/dormitorio/living de la galería del edificio,
// que eran renders del piso tipo y no de un semipiso con terraza). Ahora:
//   · grande  → "View 13", el render HORIZONTAL del living-comedor con la terraza
//               y la vista abierta a Palermo. Era una de las dos vistas que faltaban
//               de la numeración del cliente (ver _media-src/MANIFIESTO-ENTREGA.md).
//   · mosaicos → las tres ampliaciones de esa misma escena: el living con la terraza
//               de fondo, el comedor contra la vista, y la terraza al atardecer.
//
// Una unidad puede traer su propia `gallery` en units.json para pisar este default.
//
// ⚠ Estas rutas las genera `npm run unidades:optimize` desde `_media-src/unidades/`,
// que es un set aparte del de la galería del proyecto a propósito: son cuatro tomas
// de la MISMA escena y en el lightbox del menú quedarían repetidas.
const DEFAULT_HERO_VIEWS = [
  "/unidades/01-living-comedor-terraza.webp",
  "/unidades/02-living-terraza-familia.webp",
  "/unidades/03-comedor-vista.webp",
  "/unidades/04-terraza-atardecer.webp",
];

/** Galería del hero: la de la unidad (si la trae), o el set por defecto — el
 *  living-comedor con la terraza en grande y tres tomas de la misma escena como
 *  mosaicos. */
export function unitGallery(unit: Unit): string[] {
  if (unit.gallery && unit.gallery.length) return unit.gallery;
  return DEFAULT_HERO_VIEWS;
}

/** Orientación abreviada → palabra completa ("SE" → "Sudeste"/"Southeast").
 *  El mapa de labels viene del diccionario i18n activo (t.orientations). */
export function orientationLabel(
  orientation: string | undefined,
  labels: Record<string, string>,
): string {
  if (!orientation) return "";
  return labels[orientation.toUpperCase()] ?? orientation;
}

/** Baños con separador decimal del idioma activo: 2.5 → "2,5" (es) / "2.5" (en). */
export function formatBaths(baths: number, locale: string): string {
  return baths.toLocaleString(locale, { maximumFractionDigits: 1 });
}

/** Superficie total a mostrar: m² si hay `areas.total`, si no los sq ft legacy. */
export function unitArea(unit: Unit, locale: string): { value: string; unit: string } {
  if (unit.areas?.total != null) return { value: String(unit.areas.total), unit: "m²" };
  return { value: unit.sqft.toLocaleString(locale), unit: "ft²" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivaciones usadas por el BUSCADOR de unidades (client-safe: sin server-only).
// ─────────────────────────────────────────────────────────────────────────────

/** Superficie numérica (m²) para ordenar/filtrar; cae a sqft si no hay `areas.total`. */
export function unitAreaValue(unit: Unit): number {
  return unit.areas?.total ?? unit.sqft;
}

/**
 * Ambientes de la unidad. Prioriza el dato EN VIVO de Airtable; si no está, lo
 * deriva por convención AR (1 dormitorio = 2 ambientes → beds + 1). Siempre
 * devuelve un número (todas las unidades tienen `beds`).
 */
export function unitAmbientes(unit: Unit): number {
  return unit.ambientes ?? unit.beds + 1;
}

/**
 * Baños TOTALES (baños + toilette) — el número que filtra el buscador. Pedido de
 * Juani (2026-07-16): el filtro "Toilette" confundía; en su lugar los dúplex de
 * 2 baños + toilette aparecen como "3 baños". La tarjeta sigue detallando
 * "2 baños · toilette" (el desglose real).
 */
export function unitTotalBaths(unit: Unit): number {
  return unit.baths + (unit.toilette ?? 0);
}

/**
 * Tipología comercial (A–F). Prioriza el campo `tipologia` de Airtable; si no
 * está, la deriva del nombre del plano (`/tipology/unity/TIPOLOGIA%20A.png` → "A").
 * `undefined` si no se puede determinar.
 */
export function unitTipologia(unit: Unit): string | undefined {
  const live = unit.tipologia?.trim().toUpperCase();
  if (live) return live;
  const m = decodeURIComponent(unit.floorPlan || "")
    .toUpperCase()
    .match(/TIPOLOG[IÍ]A\s*([A-Z])/);
  return m ? m[1] : undefined;
}

/** Clave de piso = id sin los dos últimos dígitos ("001" → "0", "216" → "2"). */
export function unitFloorKey(id: string): string {
  return id.length > 2 ? id.slice(0, -2) : id;
}

/**
 * Extrae el monto de un precio libre distinguiendo separadores de MILES de un
 * DECIMAL final: "420.000,50" / "420,000.50" / "352170.5" → "420000.50" /
 * "352170.5"; "352.170" → "352170". Devuelve null si el formato es ambiguo —
 * mejor no mostrar/publicar precio que mostrar uno corrupto (aplastar el
 * decimal infla el monto 10x-100x).
 */
export function normalizeAmount(price: string): string | null {
  const m = price.replace(/\s/g, "").match(/\d[\d.,]*/);
  if (!m) return null;
  const parts = m[0].split(/[.,]/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  // Todos los grupos tras el primero de 3 dígitos → son separadores de miles.
  if (parts.slice(1).every((p) => p.length === 3)) return parts.join("");
  // Último grupo de 1-2 dígitos → decimal (los intermedios deben ser miles).
  if (last.length >= 1 && last.length <= 2 && parts.slice(1, -1).every((p) => p.length === 3)) {
    return `${parts.slice(0, -1).join("")}.${last}`;
  }
  return null;
}

/**
 * Formatea el precio que viene de Airtable. Un número plano ("100000") se muestra
 * como "$100.000" (separador de miles del idioma activo). Si NO es un número plano
 * (vacío, "Consultar", "USD 120k"…), devuelve null para que quien lo use muestre
 * su propia etiqueta de "consultar".
 */
export function formatPrice(price: string | undefined, locale: string): string | null {
  const raw = (price ?? "").trim();
  if (!raw || /[a-zA-Z]/.test(raw)) return null;
  const amount = normalizeAmount(raw);
  const n = amount == null ? NaN : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString(locale)}`;
}
