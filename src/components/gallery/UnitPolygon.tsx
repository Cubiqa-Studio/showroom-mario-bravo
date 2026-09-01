"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { FILL_ALPHA } from "@/lib/status";
import { PARAM_VISTA } from "@/lib/residencia";
import { useTransitionOrigin } from "@/components/transition/TransitionProvider";
import { markUnitEntryPoint } from "@/lib/analytics";

interface UnitPolygonProps {
  /** Unidad a la que navega el click (→ /residencia/:unitId). */
  unitId: string;
  /** Vista desde la que se entra: viaja en la URL para que el cierre de la landing
   *  muestre ESTA misma vista con la unidad señalada. */
  stopId: number;
  points: string;
  /** Status color for the fill. */
  color: string;
  /** Paint the status-colored fill. */
  fillShown: boolean;
  /** Show the thin white divider border. */
  borderShown: boolean;
  /** Hit-testable? When false (e.g. mid-flyby) the polygon is inert to the pointer. */
  interactive?: boolean;
  /** Dispositivo táctil: en mobile el primer toque SELECCIONA y el segundo ENTRA. */
  isTouch?: boolean;
  /** Esta unidad ya está seleccionada (mobile): el próximo toque navega. */
  isSelected?: boolean;
  /** Primer toque en mobile: resaltar la unidad (sin navegar todavía). */
  onSelect: (unitId: string, clientX: number, clientY: number) => void;
  /** Cursor entró al polígono (coords de viewport, para anclar el tooltip). */
  onEnter: (clientX: number, clientY: number) => void;
  /** Cursor se movió dentro del polígono: el tooltip lo sigue. */
  onMove: (clientX: number, clientY: number) => void;
  onLeave: () => void;
}

/**
 * A single building unit as an SVG <polygon>. Transparent by default but
 * hit-testable over its whole area (pointer-events: all) while `interactive`, so
 * hover works even with no visible fill; set interactive=false to make it inert.
 * Fill (status color) and the thin white divider border are controlled
 * independently so Availability can paint a unit without outlining it.
 */
export function UnitPolygon({
  unitId,
  stopId,
  points,
  color,
  fillShown,
  borderShown,
  interactive = true,
  isTouch = false,
  isSelected = false,
  onSelect,
  onEnter,
  onMove,
  onLeave,
}: UnitPolygonProps) {
  const router = useRouter();
  const { beginOpen } = useTransitionOrigin();
  const open = () => {
    // `beginOpen` fija el ORIGEN y arranca el zoom-in SINCRÓNICO (instantáneo),
    // sin esperar a que cargue la landing.
    markUnitEntryPoint("showroom_polygon", unitId);
    beginOpen({ x: lastPtRef.current.x, y: lastPtRef.current.y });
    router.push(`/residencia/${unitId}?${PARAM_VISTA}=${stopId}`);
  };
  // Última posición del puntero en el polígono (origen del zoom al abrir).
  const lastPtRef = useRef({ x: 0, y: 0 });
  // `pointer-events` va como ATRIBUTO de presentación, no en `style`: framer-motion sólo
  // escribe `style` al montar y no lo re-aplica en re-render, así que un style.pointerEvents
  // condicionado por `interactive` quedaría congelado en su valor inicial. React sí actualiza
  // el atributo en cada render → el polígono se vuelve realmente inerte durante el flyby.
  return (
    <motion.polygon
      data-unit-id={unitId}
      points={points}
      fill={color}
      stroke="#ffffff"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pointerEvents={interactive ? "all" : "none"}
      style={{ cursor: "pointer" }}
      initial={false}
      animate={{ fillOpacity: fillShown ? FILL_ALPHA : 0, strokeOpacity: borderShown ? 1 : 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={(e) => {
        // `interactive` es false mid-flyby / al terminar un scrub, así un arrastre
        // nunca dispara navegación (sólo un click/tap limpio sobre la unidad).
        if (!interactive) return;
        lastPtRef.current = { x: e.clientX, y: e.clientY };
        // Mobile: el PRIMER toque resalta la unidad (muestra sus datos); el SEGUNDO
        // toque (ya seleccionada) entra al detalle. `stopPropagation` evita que el
        // tap se interprete como "tocar el vacío" y la deseleccione al instante.
        if (isTouch && !isSelected) {
          e.stopPropagation();
          onSelect(unitId, e.clientX, e.clientY);
          return;
        }
        open();
      }}
      onMouseEnter={(e) => onEnter(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        lastPtRef.current = { x: e.clientX, y: e.clientY };
        onMove(e.clientX, e.clientY);
      }}
      onMouseLeave={onLeave}
    />
  );
}
