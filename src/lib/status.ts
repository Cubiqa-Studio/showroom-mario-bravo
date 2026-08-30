import type { UnitStatus } from "./types";

interface StatusStyle {
  /** Human label shown in the tooltip badge and the availability legend. */
  label: string;
  /** Solid color used for the polygon fill and the badge. */
  color: string;
}

/** available = green · reserved = amber. */
export const STATUS_STYLES: Record<UnitStatus, StatusStyle> = {
  available: { label: "Disponible", color: "#22c55e" },
  reserved: { label: "Reservada", color: "#eab308" },
};

/** Opacity applied to a polygon fill on hover / when Availability is on. */
export const FILL_ALPHA = 0.45;

/** Violeta del DÚPLEX: pisa el color de disponibilidad en la planta (la disponibilidad
 *  queda en el StatusPill del tooltip). Es un canal distinto: "ocupa dos niveles". */
export const DUPLEX_COLOR = "#8b5cf6";

/** Violeta de la TERRAZA propia (las tres del último piso). Es a propósito el MISMO
 *  violeta del dúplex: Juani lo pidió así ("en violetita como hiciste en Caviahue con
 *  los que eran duplex"), y los dos canales dicen lo mismo —"esta unidad tiene algo
 *  que las demás no"— sin competir nunca, porque ningún proyecto usa los dos.
 *
 *  ⚠ A diferencia del dúplex, NO entra en `unitFillColor`: el relleno del polígono
 *  comunica DISPONIBILIDAD y pintarlo de violeta la taparía. Vive sólo en el chip. */
export const TERRAZA_COLOR = DUPLEX_COLOR;

/** Grafito del chip de EXPOSICIÓN (frente / contrafrente).
 *
 *  UN SOLO color para los dos valores, a propósito: el texto ya dice cuál es, y
 *  pintarlos distinto sugeriría que uno vale más que el otro. Acá no es así — el
 *  contrafrente da al pulmón de manzana, con la pileta y el parque, y para mucha
 *  gente es el lado bueno. La jerarquía de color de la tarjeta queda para el
 *  ESTADO (verde/ámbar), que es lo que de verdad hay que ver de un vistazo.
 *
 *  Tampoco entra en `unitFillColor`: el relleno del polígono comunica
 *  disponibilidad, y meter la exposición ahí la rompería. */
export const EXPOSURE_COLOR = "#3F3F46";

export function statusColor(status: UnitStatus): string {
  return STATUS_STYLES[status].color;
}

/** Color de relleno de una unidad en la PLANTA: violeta si es dúplex, si no por estado. */
export function unitFillColor(unit: { status: UnitStatus; duplex?: boolean }): string {
  return unit.duplex ? DUPLEX_COLOR : STATUS_STYLES[unit.status].color;
}

export function statusLabel(status: UnitStatus): string {
  return STATUS_STYLES[status].label;
}

export const STATUS_ORDER: UnitStatus[] = ["available", "reserved"];
