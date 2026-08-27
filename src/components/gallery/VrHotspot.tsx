"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Stop } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";

interface VrHotspotProps {
  stop: Stop;
  /** Posición del hotspot en píxeles nativos del render del stop. */
  x: number;
  y: number;
  /** Escala de la bolita (1 = tamaño base). */
  scale?: number;
  /** Inerte/invisible durante las transiciones del flyby. */
  active?: boolean;
  /** Render del preview del hover (webp de la galería). Sin esto, el render del stop. */
  previewImage?: string;
  /** Etiqueta del preview: "hall" (default) o "amenities". */
  previewKind?: "hall" | "amenities";
  /** Táctil: no hay hover → el 1er toque REVELA el preview (clickeable) y tocarlo —o la
   *  bolita otra vez— abre el modal 360° (mismo patrón que las tarjetas de unidad). */
  isTouch?: boolean;
  /** Señal para descartar el preview revelado (ej.: el usuario empezó a panear). */
  resetKey?: number;
  /** Abre el modal del tour 360°. Si no se pasa, la bolita no dispara nada al click. */
  onOpen?: () => void;
}

/**
 * Hotspot 360° anclado a un punto del render. Un SVG con el MISMO viewBox+slice que la
 * imagen ubica el punto exacto (trackea el object-cover); desde su posición en pantalla
 * se centra una "bolita" de tamaño CONSTANTE.
 *
 * DESKTOP: hover gira la bolita y muestra un preview INFORMATIVO del render; el click en
 * la bolita abre el modal 360°.
 * TÁCTIL (mobile/tablet): como no hay hover, el 1er toque en la bolita REVELA el preview
 * —ahora CLICKEABLE, con aro dorado + whileTap, igual que la tarjeta de una unidad— y
 * tocarlo (o tocar la bolita de nuevo) abre el MODAL 360° de hoy. El "zoom" es el
 * scale-in del modal sumado al whileTap del preview.
 */
export function VrHotspot({
  stop,
  x,
  y,
  scale = 1,
  active = true,
  previewImage,
  previewKind = "hall",
  isTouch = false,
  resetKey = 0,
  onOpen,
}: VrHotspotProps) {
  const width = stop.imageWidth ?? 1920;
  const height = stop.imageHeight ?? 1080;
  const layerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<SVGCircleElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState(false);
  // Táctil: el preview se "revela" con el 1er toque (no hay hover).
  const [revealed, setRevealed] = useState(false);
  const { t } = useI18n();

  // En desktop el preview sale con el hover; en táctil, cuando está revelado.
  const showPreview = isTouch ? revealed : hover;

  // Posición en pantalla del punto anclado, recalculada en resize/scroll.
  //
  // CLAMP DE SEGURIDAD: el visor va con "cover", así que en un viewport más ancho que
  // el render se recorta alto arriba y abajo. Si el punto anclado cae dentro de ese
  // recorte, la bolita quedaría cortada contra el borde; esto la mantiene entera
  // dentro de la capa visible.
  useEffect(() => {
    const layer = layerRef.current;
    const anchor = anchorRef.current;
    if (!layer || !anchor) return;
    const update = () => {
      const a = anchor.getBoundingClientRect();
      const l = layer.getBoundingClientRect();
      // Radio de la bolita (h-16 = 64px) a la escala de esta vista, + un respiro.
      const r = 32 * scale + 12;
      // Abajo, apenas lo justo para que entre entera: el margen grande empujaba la
      // bolita bien arriba de la puerta y quedaba VOLANDO sobre la fachada.
      const bottom = 32 * scale + 16;
      const clamp = (v: number, min: number, max: number) =>
        max < min ? (min + max) / 2 : Math.min(Math.max(v, min), max);
      setPos({
        x: clamp(a.left + a.width / 2 - l.left, r, l.width - r),
        y: clamp(a.top + a.height / 2 - l.top, r, l.height - bottom),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(layer);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [x, y, width, height, scale]);

  // Si el overlay se apaga (transición), soltá el hover/preview para no dejarlo pegado.
  useEffect(() => {
    if (!active) {
      setHover(false);
      setRevealed(false);
    }
  }, [active]);

  // El padre pide descartar el preview táctil (ej.: empezó a panear la vista).
  useEffect(() => {
    if (resetKey) setRevealed(false);
  }, [resetKey]);

  // Táctil: un toque FUERA de la bolita/preview descarta el preview revelado (igual que
  // deseleccionar una unidad tocando el vacío). La capa es pointer-events:none, así que
  // sólo la bolita/preview quedan DENTRO de layerRef; cualquier otro target → soltar.
  useEffect(() => {
    if (!isTouch || !revealed) return;
    const onDown = (e: PointerEvent) => {
      const layer = layerRef.current;
      if (layer && !layer.contains(e.target as Node)) setRevealed(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [isTouch, revealed]);

  // Abrir el modal 360°; en táctil suelta el preview para que no quede detrás del modal.
  const openTour = () => {
    setRevealed(false);
    if (!onOpen) return;
    onOpen();
  };

  // Click en la bolita: desktop → abre el modal; táctil → 1er toque revela, 2º abre.
  const handleClick = () => {
    if (!isTouch) {
      openTour();
      return;
    }
    if (!revealed) {
      setRevealed(true);
      return;
    }
    openTour();
  };

  // Tarjeta del preview (render + etiqueta). Compartida por desktop (informativa) y
  // táctil (envuelta en un botón clickeable).
  const previewCard = (
    <div className="overflow-hidden rounded-2xl bg-paper shadow-2xl ring-1 ring-line">
      <div className="relative aspect-[16/10] w-full bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewImage ?? stop.image}
          alt={t.vr.tour}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[15px] font-semibold text-white">
          360°
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-ink">{t.vr.virtualTour}</p>
        <p className="text-xs text-muted">
          {previewKind === "amenities" ? t.vr.amenities : t.vr.hall}
        </p>
      </div>
    </div>
  );

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-10 transition-opacity duration-300"
      style={{ opacity: active ? 1 : 0, pointerEvents: "none" }}
      aria-hidden={!active}
    >
      {/* Ancla invisible que trackea el render (mismo encuadre que la imagen). */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <circle ref={anchorRef} cx={x} cy={y} r={1} fill="transparent" />
      </svg>

      {pos && (
        <div
          className="absolute"
          style={{
            left: pos.x,
            top: pos.y,
            transform: "translate(-50%, -50%)",
            pointerEvents: active ? "auto" : "none",
          }}
        >
          {/* Halo pulsante (atrae la mirada al hotspot). */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/40 blur-[2px]"
            animate={
              active
                ? {
                    scale: [scale, 1.5 * scale, scale],
                    opacity: [0.45, 0, 0.45],
                  }
                : { scale, opacity: 0 }
            }
            transition={
              active
                ? { duration: 2.6, repeat: Infinity, ease: "easeOut" }
                : { duration: 0.2 }
            }
          />

          {/* Bolita 360°. */}
          <motion.button
            type="button"
            aria-label={t.vr.open}
            title={t.vr.tour}
            onClick={handleClick}
            onMouseEnter={() => !isTouch && setHover(true)}
            onMouseLeave={() => !isTouch && setHover(false)}
            onFocus={() => !isTouch && setHover(true)}
            onBlur={() => !isTouch && setHover(false)}
            animate={{ scale: (showPreview ? 1.1 : 1) * scale }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative grid h-16 w-16 cursor-pointer place-items-center rounded-full bg-tier-dark/85 text-ink shadow-xl ring-1 ring-line backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {/* Arco doble que gira mientras el preview está activo. */}
            <motion.svg
              viewBox="0 0 64 64"
              fill="none"
              aria-hidden
              className="absolute inset-0 h-full w-full text-gold"
              animate={{ rotate: showPreview ? 360 : 0 }}
              transition={
                showPreview
                  ? { repeat: Infinity, duration: 2.4, ease: "linear" }
                  : { duration: 0.4, ease: "easeOut" }
              }
            >
              <circle
                cx="32"
                cy="32"
                r="27"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="42 127"
              />
              <circle
                cx="32"
                cy="32"
                r="27"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="42 127"
                strokeDashoffset="-84.5"
              />
            </motion.svg>
            <span className="relative text-[16.5px] font-extrabold leading-none tracking-tight">
              360°
            </span>
          </motion.button>

          {/* Preview del render (hover en desktop; toque en táctil). En táctil es un
              BOTÓN clickeable que abre el modal 360° (aro dorado + whileTap, como la
              tarjeta de una unidad); en desktop es informativo (pointer-events-none). */}
          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 ${
                  isTouch ? "pointer-events-auto" : "pointer-events-none"
                }`}
                aria-hidden={isTouch ? undefined : true}
              >
                {isTouch ? (
                  <motion.div
                    role="button"
                    tabIndex={0}
                    aria-label={t.vr.open}
                    onClick={openTour}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTour();
                      }
                    }}
                    // Es role=button (no <button>), así que el pointerdown NO lo exime el
                    // gesto de paneo del FlybyViewer: frenamos la propagación para que
                    // tocar el preview no arranque un paneo (ni descarte el preview).
                    onPointerDown={(e) => e.stopPropagation()}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 380, damping: 25 }}
                    className="cursor-pointer rounded-2xl outline-none ring-2 ring-gold/70 shadow-[0_0_22px_rgba(184,125,9,0.35)] focus-visible:ring-gold"
                  >
                    {previewCard}
                  </motion.div>
                ) : (
                  previewCard
                )}
                {/* Flechita del tooltip. */}
                <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-paper shadow-md" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
