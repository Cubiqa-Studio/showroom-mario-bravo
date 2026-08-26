"use client";

import { useI18n } from "@/i18n/LanguageProvider";
import { SITE } from "@/data/site";
import { scrollToTop } from "./landing-dom";

/* eslint-disable @next/next/no-img-element */

/**
 * "El Edificio" (sección 07, la ÚLTIMA de la landing): full-bleed, a PANTALLA
 * COMPLETA (100dvh, `object-fit: cover`), con el render de la vista 01 — la fachada
 * sobre Mario Bravo, que es la misma con la que abre el showroom. Sale de
 * `SITE.aerialImage` para no hardcodear la ruta acá.
 *
 * Antes era un `<video>` de animación aérea; en TIER Bravo ese video no existe, así
 * que la sección se veía negra. El FAB "ARRIBA" se mantiene.
 */
export function TowerSection() {
  const { t } = useI18n();

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
        {/* Última sección de la página → lazy: no compite con el hero ni con el
            plano por el ancho de banda de la primera pantalla. */}
        <img
          className="building-aerial"
          src={SITE.aerialImage}
          alt={t.tower.aerialAlt}
          loading="lazy"
          decoding="async"
          draggable={false}
        />

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
