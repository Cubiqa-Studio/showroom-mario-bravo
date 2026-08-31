"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";
import { kuulaEmbedUrl } from "@/lib/kuula";
import { useKuulaZoom } from "@/hooks/useKuulaZoom";
import { ZoomKuula } from "./ZoomKuula";
import { Vr360Modal } from "../gallery/Vr360Modal";

/**
 * Tour 360° de Kuula embebido en el hero (tipología E dúplex: 207/213).
 *
 * Nota scroll/zoom: en ESCRITORIO la URL lleva `zoom=0`. El zoom de Kuula es todo o
 * nada: habilitarlo (lo único que hace andar la barrita) le devuelve la RUEDA al tour,
 * y con un hero de 100vh la ficha deja de scrollear. Se probó taparlo con un overlay
 * que se corría solo, y en la vida real es una carrera que se pierde: alcanza con que
 * el mouse se mueva un pixel para que la rueda vuelva a zoomear (reporte del cliente,
 * 31-08). Así que acá el 360° es NATIVO —arrastrar, hotspots, la rueda scrollea la
 * ficha— y el zoom se hace a pantalla completa, en el `Vr360Modal`, donde no hay nada
 * atrás que scrollear: el chip de arriba a la derecha lo abre.
 *
 * En TÁCTIL sí va `zoom=1` + la barrita: no hay rueda que robar (el scroll se hace
 * arrastrando el bottom sheet), así que el zoom sale gratis.
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
  const kz = useKuulaZoom(iframeRef, conZoom);
  // En escritorio el chip abre el tour a pantalla completa EN UN MODAL (ahí sí hay
  // barrita de zoom). En táctil sigue siendo el fullscreen del elemento, que ya
  // funciona y evita cargar el tour dos veces.
  const [modalAbierto, setModalAbierto] = useState(false);
  // Montamos el iframe recién después del primer efecto (isTouch ya resuelto) → el src
  // se calcula una sola vez, sin doble load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // hideFullscreen: en el hero el 360° ya es 100dvh → el botón fullscreen de Kuula
  // (arriba a la derecha) sobra y se encimaba a nuestro navbar (Miro 2026-07-15).
  const iframeSrc = kuulaEmbedUrl(src, isTouch, { hideFullscreen: true, zoom: conZoom });

  const openTour = () => {
    if (!isTouch) {
      setModalAbierto(true);
      return;
    }
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
      {/* Barrita de zoom. Se dibuja sola sólo si el embed lo permite (táctil). */}
      <ZoomKuula kz={kz} className="kz--hero" />

      {/* En mobile se arrastra para mirar SIN tocar antes (el scroll de la página se hace
          arrastrando el bottom sheet). Sólo un chip chico arriba a la derecha para
          ampliar a pantalla completa; en desktop no se muestra. */}
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

      {/* Escritorio: el mismo tour a pantalla completa, con la barrita de zoom. Se
          monta recién al abrirlo (src null = no hay iframe), así no carga dos veces. */}
      <Vr360Modal
        src={modalAbierto ? src : null}
        onClose={() => setModalAbierto(false)}
        zClass="z-[170]"
      />
    </div>
  );
}
