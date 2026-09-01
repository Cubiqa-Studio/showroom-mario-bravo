"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { useRouter } from "next/navigation";
import type { Stop, Units } from "@/lib/types";
import { statusColor } from "@/lib/status";
import { PARAM_VISTA } from "@/lib/residencia";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTransitionOrigin } from "@/components/transition/TransitionProvider";
import { markUnitEntryPoint } from "@/lib/analytics";
import { UnitPolygon } from "./UnitPolygon";
import { UnitTooltip } from "./UnitTooltip";

interface InteractiveOverlayProps {
  stop: Stop;
  units: Units;
  /**
   * Natural-pixel viewBox size — matches the background render so coords scale 1:1.
   * The SVG uses `slice` (like the image's object-cover), so polygons keep tracking
   * the render even when the container's aspect ratio differs (e.g. full-screen).
   */
  width: number;
  height: number;
  /** When false (e.g. mid-flyby in phase 2) the overlay is inert and invisible. */
  active?: boolean;
  /** Availability toggle: paint every unit by status permanently. */
  showAvailability?: boolean;
  /** Dispositivo táctil: el hover no existe → primer toque resalta, segundo entra. */
  isTouch?: boolean;
  /**
   * Unidad que "respira": dibuja un contorno BLANCO pulsante (sin relleno) sobre
   * ella, de forma permanente, como pista de que las unidades son interactivas.
   * No abre tooltip ni usa los colores de disponibilidad.
   */
  breathingUnitId?: string | null;
  /**
   * Señal para limpiar la selección táctil: al incrementarse (ej.: el usuario empezó
   * a panear la vista), se descarta la unidad seleccionada y su tooltip.
   */
  resetKey?: number;
}

/**
 * The polygon layer: an absolutely-positioned <svg> over the stop image. One
 * floating tooltip is repositioned to whichever polygon is hovered.
 */
export function InteractiveOverlay({
  stop,
  units,
  width,
  height,
  active = true,
  showAvailability = false,
  isTouch = false,
  breathingUnitId = null,
  resetKey = 0,
}: InteractiveOverlayProps) {
  const { t } = useI18n();
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  // Unidad seleccionada por toque (mobile): el primer tap la fija acá (resaltado +
  // tooltip) y el segundo tap sobre la misma navega al detalle.
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  // Lado de apertura, decidido al entrar a cada unidad (ver `sideForCursor`). Se
  // mantiene fijo durante ese hover para que el tooltip no salte de lado al moverse.
  const [placement, setPlacement] = useState<"left-start" | "right-start">(
    "right-start",
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navegación al detalle (mismo mecanismo que UnitPolygon: zoom-in desde el punto
  // tocado + push a /residencia/:id). Se usa cuando en MOBILE se toca la tarjeta.
  const router = useRouter();
  const { beginOpen } = useTransitionOrigin();
  // Punto donde se tocó la unidad (origen del zoom al entrar desde la tarjeta).
  const selectPtRef = useRef({ x: 0, y: 0 });

  // Unidad cuyo tooltip se muestra: en desktop la del hover; en mobile la seleccionada
  // por toque. (El contorno que "respira" resalta el polígono pero NO abre tooltip.)
  const tipUnitId = isTouch ? selectedUnitId : hoveredUnitId;

  // El tooltip se ancla al CURSOR (no al polígono) y se abre hacia AFUERA del
  // edificio: hacia el borde de pantalla más cercano, así nunca tapa el ala opuesta.
  // `offset` lo separa apenas del puntero; `flip` es la red de seguridad si el lado
  // elegido no entra; `shift` lo mantiene dentro de la pantalla en vertical.
  const { refs, floatingStyles } = useFloating({
    placement,
    open: tipUnitId !== null,
    middleware: [
      offset(16),
      flip({ padding: 8 }),
      // En TOUCH reservamos la franja inferior (~96px) para que la tarjeta —ahora
      // clickeable— NUNCA se pare encima de las flechas de "Girar" (bottom-6=24px +
      // h-12=48px): si no, al tocar una unidad de PB/1° la tarjeta quedaba sobre una
      // flecha y el tap para ROTAR entraba a la unidad. `shift` sólo clampa el eje
      // vertical acá, así que el padding inferior la empuja por encima de los controles.
      // Desktop queda igual (padding uniforme de 8, el tooltip no es interactivo).
      // `crossAxis: true` = clampear TAMBIÉN en horizontal. En `left/right-*` el eje
      // "cross" de shift es la X, y viene apagado por default: la tarjeta mide 224px y
      // en un teléfono de 412 no entra a ningún costado del dedo si tocaste cerca del
      // medio (ni a la derecha ni volteada a la izquierda por `flip`), así que se salía
      // ~30px por el borde derecho. Y una tarjeta que se sale ENSANCHA el documento:
      // Chrome de Android agranda el viewport de layout a ese ancho (441 sobre 412
      // medidos) y a partir de ahí TODO el sitio —showroom y ficha— queda dibujado más
      // ancho que la pantalla: el contenido "corrido a la derecha" y la navbar con los
      // botones cortados que reportó Joaquim el 30-08. Y no se arregla solo: sobrevive
      // a la navegación al detalle, por eso "a veces se arregla refrescando".
      shift({
        crossAxis: true,
        padding: isTouch ? { top: 8, bottom: 96, left: 8, right: 8 } : 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Lado más cercano al borde: cursor en la mitad izquierda → abrí a la izquierda;
  // en la derecha → a la derecha. Empuja el tooltip hacia el cielo/paisaje, no sobre
  // las demás unidades.
  const sideForCursor = (clientX: number): "left-start" | "right-start" =>
    typeof window !== "undefined" && clientX < window.innerWidth / 2
      ? "left-start"
      : "right-start";

  // Mueve la referencia (un elemento virtual de tamaño 0 en la posición del
  // cursor). Mientras el puntero está sobre un polígono el tooltip lo SIGUE; al
  // salir dejamos de llamar a esto, así queda CONGELADO y se puede ir a tocarlo.
  const setCursor = useCallback(
    (clientX: number, clientY: number) => {
      refs.setPositionReference({
        getBoundingClientRect: () => ({
          width: 0,
          height: 0,
          x: clientX,
          y: clientY,
          top: clientY,
          left: clientX,
          right: clientX,
          bottom: clientY,
        }),
      });
    },
    [refs],
  );

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  // El tooltip es informativo y NO se entra con el mouse (pointer-events: none),
  // así que cierra ni bien salís de la unidad. La micro-gracia (80ms) sólo evita el
  // parpadeo al cruzar de una unidad a su vecina; cualquier movimiento la cancela.
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHoveredUnitId(null), 80);
  }, [cancelClose]);

  // When the overlay is deactivated (e.g. a flyby transition starts), drop any
  // hover/selection right away. Otherwise the filled polygon + tooltip would pop
  // back in — the tooltip anchored to a now-unmounted polygon — the instant the
  // overlay re-activates on the destination stop, which reads as a glitch.
  useEffect(() => {
    if (active) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setHoveredUnitId(null);
    setSelectedUnitId(null);
  }, [active]);

  // El padre pide limpiar la selección táctil (ej.: empezó un paneo de la vista).
  useEffect(() => {
    if (resetKey === 0) return;
    setSelectedUnitId(null);
  }, [resetKey]);

  // Primer toque (mobile): resaltar la unidad y anclar su tooltip al punto tocado.
  const selectUnit = (id: string, clientX: number, clientY: number) => {
    cancelClose();
    setPlacement(sideForCursor(clientX));
    setCursor(clientX, clientY);
    selectPtRef.current = { x: clientX, y: clientY };
    setSelectedUnitId(id);
  };

  // Mobile: tocar la TARJETA entra a la unidad que muestra (mismo destino que el 2º
  // toque sobre el polígono). Antes la tarjeta era pointer-events:none y el tap se
  // filtraba al polígono de atrás → entrabas a OTRA unidad (feedback de Juani). Sólo
  // en touch; en desktop el tooltip sigue siendo informativo (no se entra con mouse).
  const enterTipUnit = useCallback(() => {
    if (!tipUnitId) return;
    markUnitEntryPoint("showroom_tooltip", tipUnitId);
    beginOpen({ x: selectPtRef.current.x, y: selectPtRef.current.y });
    router.push(`/residencia/${tipUnitId}?${PARAM_VISTA}=${stop.id}`);
  }, [tipUnitId, beginOpen, router, stop.id]);

  // Unidad resaltada (relleno + borde): hover (desktop) o selección por toque (mobile).
  const activeUnitId = tipUnitId;
  const tipUnit = tipUnitId ? units[tipUnitId] : undefined;

  // Contorno que "respira": sólo si el overlay está activo, NO está la Disponibilidad
  // encendida (con el switch on la 216 se pinta como cualquier otra unidad: borde
  // blanco, sin respirar), la unidad existe en esta vista, y NO está ya resaltada por
  // hover/toque (evita doblar contornos).
  const breathingPoly =
    active &&
    !showAvailability &&
    breathingUnitId &&
    breathingUnitId !== activeUnitId
      ? stop.polygons.find((p) => p.unitId === breathingUnitId)
      : undefined;
  // Color de la respiración = disponibilidad de la unidad (verde/ámbar), como pidió
  // el cliente (antes era blanco y casi no se distinguía).
  const breathingUnit = breathingPoly ? units[breathingPoly.unitId] : undefined;
  const breathingColor = breathingUnit
    ? statusColor(breathingUnit.status)
    : "#22c55e";

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full transition-opacity duration-200"
        style={{
          pointerEvents: active ? "auto" : "none",
          opacity: active ? 1 : 0,
        }}
        aria-hidden={!active}
        onClick={(e) => {
          // Toque sobre el vacío (cielo/paisaje, no un polígono) deselecciona en
          // mobile. Los polígonos hacen stopPropagation al seleccionar, así que esto
          // no se dispara al elegir una unidad.
          if (isTouch && e.target === e.currentTarget) setSelectedUnitId(null);
        }}
      >
        {stop.polygons.map((poly) => {
          const unit = units[poly.unitId];
          if (!unit) return null;
          const isActive = activeUnitId === poly.unitId;
          // Availability on: every unit is painted by status; the white divider
          // border stays on "available" permanently and on the rest (reserved)
          // only when highlighted. Availability off: fill + border only when highlighted
          // (hover en desktop, toque en mobile, o forzado por el tour).
          const fillShown = showAvailability || isActive;
          const borderShown = showAvailability
            ? unit.status === "available" || isActive
            : isActive;
          return (
            <UnitPolygon
              stopId={stop.id}
              key={poly.unitId}
              unitId={poly.unitId}
              points={poly.points}
              color={statusColor(unit.status)}
              fillShown={fillShown}
              borderShown={borderShown}
              interactive={active}
              isTouch={isTouch}
              isSelected={selectedUnitId === poly.unitId}
              onSelect={selectUnit}
              onEnter={(x, y) => {
                cancelClose();
                setPlacement(sideForCursor(x));
                setCursor(x, y);
                setHoveredUnitId(poly.unitId);
              }}
              onMove={(x, y) => {
                // Cualquier movimiento sobre el polígono mantiene vivo el tooltip y
                // lo pega al cursor (también neutraliza el cierre al pasar de una
                // unidad a su vecina, donde enter/leave pueden llegar en cualquier orden).
                cancelClose();
                setCursor(x, y);
              }}
              onLeave={scheduleClose}
            />
          );
        })}

        {/* Unidad que "respira" (pista de interacción). Va al final del SVG → se
            pinta por encima de los polígonos. `pointerEvents="none"` (atributo, no
            style) deja que el polígono interactivo de DEBAJO siga recibiendo el
            hover/toque. La animación es CSS (.unit-breathe) → arranca al montar y
            corre SIEMPRE, sin depender de hover. El halo oscuro le da contraste para
            que el color se lea sobre cualquier render. */}
        {breathingPoly && (
          <>
            <polygon
              points={breathingPoly.points}
              fill="none"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              className="unit-breathe"
            />
            <polygon
              points={breathingPoly.points}
              fill={breathingColor}
              fillOpacity={0.16}
              stroke={breathingColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              className="unit-breathe"
            />
          </>
        )}
      </svg>

      {active && tipUnitId && tipUnit && (
        <FloatingPortal>
          {/* Wrapper EXTERNO: lo posiciona floating-ui (via `transform` en style) y le
              hace el fade de entrada. NO le ponemos scale acá para no pelear con ese
              transform de posición. DESKTOP → informativo (pointer-events-none). */}
          <motion.div
            ref={refs.setFloating}
            style={floatingStyles}
            className={
              isTouch ? "pointer-events-auto z-50" : "pointer-events-none z-50"
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            {isTouch ? (
              // MOBILE: la tarjeta ENTRA a su unidad. Feedback UX: aro dorado (se ve
              // clickeable) + `whileTap` (se achica al tocar → sabés que registró el
              // toque); al soltar corre el zoom de entrada. El scale va en ESTE hijo
              // interno (no en el wrapper posicionado) así no rompe la posición.
              <motion.div
                role="button"
                tabIndex={0}
                aria-label={t.unitTooltip.enterAria(tipUnit.residence)}
                onClick={enterTipUnit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    enterTipUnit();
                  }
                }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 25 }}
                className="cursor-pointer rounded-xl shadow-[0_0_22px_rgba(184,125,9,0.35)] outline-none ring-2 ring-gold/70 focus-visible:ring-gold"
              >
                <UnitTooltip unit={tipUnit} />
              </motion.div>
            ) : (
              <UnitTooltip unit={tipUnit} />
            )}
          </motion.div>
        </FloatingPortal>
      )}
    </>
  );
}
