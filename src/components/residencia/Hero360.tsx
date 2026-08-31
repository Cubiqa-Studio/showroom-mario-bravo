"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";
import { kuulaEmbedUrl } from "@/lib/kuula";
import { useZoomKuula, ZOOM_MAX, ZOOM_MIN, ZOOM_PASO } from "@/hooks/useZoomKuula";
import { ZoomHero } from "./ZoomHero";

/**
 * Tour 360° de Kuula embebido en el hero (tipología E dúplex: 207/213).
 *
 * Nota scroll/zoom: en ESCRITORIO la URL lleva `zoom=0`, así Kuula NO captura la rueda
 * del mouse → la rueda scrollea la PÁGINA y arrastrar para mirar sigue funcionando sin
 * ningún "guard". El zoom lo damos por fuera del iframe: se monta al 200% y se muestra
 * la mitad (`hero-360--x2`), y los controles sólo tocan el `transform`. En TÁCTIL va
 * `zoom=1` —ahí no hay rueda que robar, el scroll se hace arrastrando el bottom sheet—
 * así que queda el pinch nativo y los controles mueven el FOV real por el Player API.
 *
 * En TÁCTIL (mobile) el 360 es directamente interactivo: se ARRASTRA para mirar sin
 * tener que tocar antes. Sólo ahí queda un chip chico arriba a la derecha para AMPLIAR
 * a pantalla completa (en fullscreen el chip se oculta vía `:fullscreen`). Si el browser
 * no soporta fullscreen de elementos (iOS Safari), cae a abrir el tour en una pestaña
 * nueva. En ESCRITORIO el chip NO se muestra (pedido de Joaquim, 31-08).
 *
 * Anti-lag iOS: en táctil pasamos el src por `withKuulaTouchGate` para que Kuula muestre
 * su pantalla de título (botón play); ese tap destraba el throttle de WebGL en WebKit
 * (ver src/lib/kuula.ts). Para NO cargar primero la versión autoload y recargar después
 * (isTouch arranca en false hasta el efecto), gateamos el montaje del <iframe> detrás de
 * `mounted`: hasta entonces mostramos un skeleton negro (igual que el fondo del hero).
 */

const RECORTE_REPOSO = 0.5;
const RECORTE_MAX = 1;
const RECORTE_PASO = 0.05;

export function Hero360({ src, title }: { src: string; title: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { t } = useI18n();
  const isTouch = useIsTouch();
  // Montamos el iframe recién después del primer efecto (isTouch ya resuelto) → el src
  // se calcula una sola vez, sin doble load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // hideFullscreen: en el hero el 360° ya es 100dvh → el botón fullscreen de Kuula
  // (arriba a la derecha) sobra y se encimaba a nuestro navbar (Miro 2026-07-15).
  const iframeSrc = kuulaEmbedUrl(src, isTouch, {
    hideFullscreen: true,
    hideVr: !isTouch,
    zoom: isTouch,
  });

  const conRecorte = mounted && !isTouch;
  const [recorte, setRecorte] = useState(RECORTE_REPOSO);
  const [arrastrando, setArrastrando] = useState(false);
  useEffect(() => setRecorte(RECORTE_REPOSO), [src]);
  const kuula = useZoomKuula(iframeRef, mounted && isTouch, src);

  const openTour = () => {
    const el = wrapRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() =>
        window.open(src, "_blank", "noopener,noreferrer"),
      );
    } else {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  const control = isTouch
    ? {
        valor: kuula.valor,
        min: ZOOM_MIN,
        max: ZOOM_MAX,
        paso: ZOOM_PASO,
        listo: kuula.listo,
        onCambio: kuula.aplicar,
      }
    : {
        valor: recorte,
        min: RECORTE_REPOSO,
        max: RECORTE_MAX,
        paso: RECORTE_PASO,
        listo: true,
        onCambio: setRecorte,
        onArrastre: setArrastrando,
      };

  return (
    <div className={`hero-360-wrap${conRecorte ? " hero-360-wrap--x2" : ""}`} ref={wrapRef}>
      {/* `allow="fullscreen"` sin `gyroscope; accelerometer`: en el celu, inclinar el
          teléfono ya NO mueve el 360° (pedido del cliente) — sólo se mira arrastrando.
          Se conserva `fullscreen` para el chip de ampliar. */}
      {mounted ? (
        <iframe
          ref={iframeRef}
          className={`hero-360${conRecorte ? " hero-360--x2" : ""}`}
          style={
            conRecorte
              ? {
                  transform: `translate(-25%, -25%) scale(${recorte})`,
                  transition: arrastrando ? "none" : undefined,
                }
              : undefined
          }
          src={iframeSrc}
          title={title}
          allow="fullscreen"
          allowFullScreen
        />
      ) : (
        <div className="hero-360-skeleton" aria-hidden />
      )}

      {mounted ? <ZoomHero {...control} className="zh--hero" /> : null}

      {/* Sin shield que tape el 360: en mobile se arrastra para mirar SIN tocar antes
          (el scroll de la página se hace arrastrando el bottom sheet). Sólo un chip chico
          arriba a la derecha para ampliar a pantalla completa. */}
      <button
        type="button"
        className="h360-fs"
        onClick={openTour}
        aria-label={t.hero.explore360}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        360°
      </button>
    </div>
  );
}
