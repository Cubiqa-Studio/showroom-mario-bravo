"use client";

import type { SiteConfig } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { LocationMap } from "./LocationMap";

/**
 * "Ubicación" (sección 7): cabecera + mapa MapLibre full-bleed (card de dirección
 * y pills incluidos en <LocationMap>). Datos desde site (location/addressBase/pois).
 */
export function LocationSection({ site }: { site: SiteConfig }) {
  const { t } = useI18n();
  return (
    <>
      <div className="wrap">
        <div className="spec-head" style={{ marginBottom: 36 }}>
          <h2 className="section-title">{t.location.sectionTitle}</h2>
          <p className="muted center">{t.location.intro}</p>
        </div>
      </div>

      <LocationMap site={site} />
    </>
  );
}
