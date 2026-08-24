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
