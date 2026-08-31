"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";
import { kuulaEmbedUrl } from "@/lib/kuula";
import { ZoomKuula } from "./ZoomKuula";

/**
 * Tour 360° de Kuula embebido en el hero (tipología E dúplex: 207/213).
 *
 * Nota scroll/zoom: en ESCRITORIO la URL lleva `zoom=0`, así Kuula NO captura la rueda
 * del mouse → la rueda scrollea la PÁGINA (no zoomea el 360) y arrastrar para mirar
 * sigue funcionando sin ningún "guard". En TÁCTIL va `zoom=1` + la barrita lateral:
 * ahí no hay rueda que robar (el scroll se hace arrastrando el bottom sheet), así que
 * se puede zoomear sin costo. Ver la tabla en `KuulaChromeOpts.zoom`, que explica por
 * qué no se puede tener la barrita en escritorio sin romper el scroll.
 *
 * En TÁCTIL (mobile) el 360 es directamente interactivo: se ARRASTRA para mirar sin
 * tener que tocar antes. La página no queda trabada porque el scroll se hace
 * arrastrando el BOTTOM SHEET que asoma abajo (ver residencia.css, `.has-360`), no
 * swipeando sobre el 360. Sólo queda un chip chico arriba a la derecha para AMPLIAR a
 * pantalla completa (en fullscreen el chip se oculta vía `:fullscreen`). Si el browser
 * no soporta fullscreen de elementos (iOS Safari), cae a abrir el tour en una pestaña
 * nueva. En desktop el chip no se muestra (el 360 ya es interactivo inline).
 *
 * Anti-lag iOS: en táctil pasamos el src por `withKuulaTouchGate` para que Kuula muestre
 * su pantalla de título (botón play); ese tap destraba el throttle de WebGL en WebKit
 * (ver src/lib/kuula.ts). Para NO cargar primero la versión autoload y recargar después
 * (isTouch arranca en false hasta el efecto), gateamos el montaje del <iframe> detrás de
 * `mounted`: hasta entonces mostramos un skeleton negro (igual que el fondo del hero).
 */
export function Hero360({ src, title }: { src: string; title: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { t } = useI18n();
  const isTouch = useIsTouch();
  // Zoom SÓLO en táctil. En escritorio habilitarlo le devuelve la rueda al 360° y la
  // ficha deja de scrollear (medido: 0px con el cursor sobre el hero, que ocupa la
  // pantalla entera). Ver la tabla en `KuulaChromeOpts.zoom`.
  const conZoom = isTouch;
  // Montamos el iframe recién después del primer efecto (isTouch ya resuelto) → el src
  // se calcula una sola vez, sin doble load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // hideFullscreen: en el hero el 360° ya es 100dvh → el botón fullscreen de Kuula
  // (arriba a la derecha) sobra y se encimaba a nuestro navbar (Miro 2026-07-15).
  const iframeSrc = kuulaEmbedUrl(src, isTouch, { hideFullscreen: true, zoom: conZoom });

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

  return (
    <div className="hero-360-wrap" ref={wrapRef}>
      {/* `allow="fullscreen"` sin `gyroscope; accelerometer`: en el celu, inclinar el
          teléfono ya NO mueve el 360° (pedido del cliente) — sólo se mira arrastrando.
          Se conserva `fullscreen` para el chip de ampliar. */}
      {mounted ? (
        <iframe
          ref={iframeRef}
          className="hero-360"
          src={iframeSrc}
          title={title}
          allow="fullscreen"
          allowFullScreen
        />
      ) : (
        <div className="hero-360-skeleton" aria-hidden />
      )}
      {/* Barrita de zoom. Se dibuja sola sólo si el embed lo permite. */}
      <ZoomKuula iframeRef={iframeRef} habilitado={conZoom} className="kz--hero" />

      {/* Sin shield que tape el 360: en mobile se arrastra para mirar SIN tocar antes
          (el scroll de la página se hace arrastrando el bottom sheet). Sólo un chip chico
          arriba a la derecha para ampliar a pantalla completa; en desktop no se muestra. */}
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
