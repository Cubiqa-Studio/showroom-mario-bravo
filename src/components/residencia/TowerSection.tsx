"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { scrollToTop } from "./landing-dom";

/**
 * "El Edificio — vista aérea" (sección 07, la ÚLTIMA de la landing): full-bleed.
 * Antes era una imagen aérea; ahora es el video de animación del edificio
 * (autoplay muteado en bucle), igual para todas las landings. El poster (frame del
 * propio video) se ve al instante mientras decodea, y queda de red de seguridad si
 * el navegador no reproduce. El FAB "ARRIBA" se mantiene.
 */
export function TowerSection() {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // `muted` por PROPIEDAD: React no lo aplica confiable con SSR/hydration y un
    // <video> no realmente muteado tiene el autoplay bloqueado.
    v.muted = true;
    // Respeta "reduce motion": sin autoplay (queda el poster).
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) v.play().catch(() => {});
  }, []);

  return (
    <section className="frame" id="building" aria-labelledby="tower-heading">
      {/* Heading real (sr-only) para que la última sección tenga encabezado como
          el resto (02–06) y el outline h1→h2 quede completo. Visual intacto. */}
      <h2 id="tower-heading" className="sr-only">
        {t.tower.tag}
      </h2>
      {/* Miro 2026-07-15: sin el número de sección ("07 /") — quedó sólo la etiqueta. */}
      <div className="frame-tag">{t.tower.tag}</div>
      <div className="building-stage">
        <video
          ref={videoRef}
          className="building-aerial"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/landing-aerial-poster.jpg"
          aria-label={t.tower.aerialAlt}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        >
          <source src="/landing-aerial.webm" type="video/webm" />
          <source src="/landing-aerial.mp4" type="video/mp4" />
        </video>

        <button type="button" className="fab" title={t.tower.backToTop} onClick={scrollToTop}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          {t.tower.up}
        </button>
      </div>
    </section>
  );
}
