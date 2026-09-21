import type { UnitStatus } from "./types";

interface StatusStyle {
  /** Human label shown in the tooltip badge and the availability legend. */
  label: string;
  /** Solid color used for the polygon fill and the badge. */
  color: string;
}

/**
 * available = verde · reserved = ámbar · sold = GRIS.
 *
 * ⚠ ESTE OBJETO ES LA PERILLA DE COLOR. Los tres colores del estado salen de acá y
 * de ningún otro lado (`statusColor` / `unitFillColor` / `statusLabel` y la leyenda
 * de "Disponibilidad"). Cambiar uno es cambiar esta línea; no hay hex repetido en
 * los componentes.
 *
 * El gris de "Vendida" lo eligió Joaquim (21-09-2026) sobre el rojo, para que el
 * hover de una vendida se lea como "apagada" y no como una alarma. Es un slate-500
 * y no el `--gray` del texto (#A8A8AE) a propósito: el relleno del polígono va al
 * 45% de opacidad (`FILL_ALPHA`) SOBRE UN RENDER FOTOGRÁFICO, y un gris claro ahí
 * desaparece. Si a Juani no le gusta, se toca sólo el hex de abajo.
 *
 * El hermano CLARO de este gris, para texto y puntitos sobre el lienzo negro de la
 * ficha, es `--slate` en residencia.css (mismo tono, más luminancia para llegar a
 * AA) — si cambiás uno, cambiá el otro.
 */
export const STATUS_STYLES: Record<UnitStatus, StatusStyle> = {
  available: { label: "Disponible", color: "#22c55e" },
  reserved: { label: "Reservada", color: "#eab308" },
  sold: { label: "Vendida", color: "#64748B" },
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

/**
 * Estilo de un estado, TOLERANTE a un valor que no esté en el mapa.
 *
 * El `??` no es paranoia de tipos: el estado viaja por la red (lo manda el back de
 * Cubiqa) y `tsconfig` NO tiene `noUncheckedIndexedAccess`, así que TypeScript cree
 * que `STATUS_STYLES[x]` siempre existe. Si el día de mañana el back suma un cuarto
 * `UnitState` y alguien lo deja pasar, `.color` sobre `undefined` tira un TypeError
 * DENTRO del render del overlay (los 63 polígonos), de la tarjeta de hover y de la
 * planta: pantalla en blanco, no un dato feo. Con el fallback, en el peor caso una
 * unidad se pinta de verde.
 *
 * La primera línea de defensa igual está en el parser, que mapea por igualdad
 * exacta y devuelve `undefined` en vez de castear (ver src/lib/cubiqa-parse.ts).
 */
function estilo(status: UnitStatus): StatusStyle {
  return STATUS_STYLES[status] ?? STATUS_STYLES.available;
}

export function statusColor(status: UnitStatus): string {
  return estilo(status).color;
}

/** Color de relleno de una unidad en la PLANTA: violeta si es dúplex, si no por estado. */
export function unitFillColor(unit: { status: UnitStatus; duplex?: boolean }): string {
  return unit.duplex ? DUPLEX_COLOR : estilo(unit.status).color;
}

export function statusLabel(status: UnitStatus): string {
  return estilo(status).label;
}

/**
 * Orden de la LEYENDA de "Disponibilidad" (AvailabilityToggle). Es un array suelto,
 * no un tipo exhaustivo: si agregás un estado a `UnitStatus`, el compilador NO te
 * avisa que falta acá y la leyenda pierde una fila en silencio.
 *
 * ── Los SIETE lugares que el compilador tampoco encuentra ───────────────────────
 * Al sumar "sold" hubo que tocar a mano, además de este array:
 *   · src/components/residencia/StatusPill.tsx       (era un ternario binario)
 *   · src/components/gallery/UnitFinderModal.tsx     (type Availability + la tupla
 *                                                     del segmentado)
 *   · src/components/residencia/residencia.css       (.badge-*, .finder-dot--*,
 *                                                     .finder-status--*, .is-*)
 *   · src/app/llms.txt/route.ts                      (otro ternario binario)
 * Un estado nuevo pasa por la misma lista.
 */
export const STATUS_ORDER: UnitStatus[] = ["available", "reserved", "sold"];
