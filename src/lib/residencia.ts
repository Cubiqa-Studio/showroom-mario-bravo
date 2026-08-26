import type { Unit } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Derivaciones para la landing de detalle. Mantienen la landing "data-driven":
// si la unidad trae el campo, se usa; si no, se deriva de sus otros datos (NO
// hardcodeado a una unidad puntual). Reemplazá poblando units.json.
// ─────────────────────────────────────────────────────────────────────────────

// Renders del hero para las unidades SIN tour 360°: hoy son las 11 del 6° y el 7°
// (las de los pisos 1 a 5 muestran su recorrido embebido y no pasan por acá).
//
// El cliente eligió el set (26-08): la FACHADA como imagen grande y tres interiores
// —cocina, dormitorio y living-comedor— en los mosaicos chicos del header. Una
// unidad puede traer su propia `gallery` en units.json para pisar este default.
//
// ⚠ Estas rutas las genera `npm run gallery:optimize` desde `_media-src/gallery/`:
// si se renombran los originales, hay que actualizarlas acá (venían apuntando a
// `view-07/08/09/04.webp`, nombres de otro showroom, y el hero de esas 11 unidades
// mostraba cuatro imágenes rotas).
const DEFAULT_HERO_VIEWS = [
  "/gallery/optimized/01-fachada.webp",
  "/gallery/optimized/13-cocina.webp",
  "/gallery/optimized/14-dormitorio.webp",
  "/gallery/optimized/12-living-comedor.webp",
];

/** Galería del hero: la de la unidad (si la trae), o el set por defecto — la
 *  fachada grande + cocina/dormitorio/living como thumbs. */
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
