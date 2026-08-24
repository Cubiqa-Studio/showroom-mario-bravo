"use client";

import "./residencia.css";
import { useEffect, useRef } from "react";
import type { SiteConfig, Unit } from "@/lib/types";
import type { UnitWithId } from "@/lib/data";
import { formatBaths } from "@/lib/residencia";
import { useI18n } from "@/i18n/LanguageProvider";
import { LandingNav } from "./LandingNav";
import { HeroGallery } from "./HeroGallery";
import { PlanSection } from "./PlanSection";
import { SpecsSection } from "./SpecsSection";
import { LocationSection } from "./LocationSection";
import { ContactSection } from "./ContactSection";
import { AvailableResidences } from "./AvailableResidences";
import { TowerSection } from "./TowerSection";
import { Reveal } from "./Reveal";

export interface ResidenciaLandingProps {
  unit: Unit;
  unitId: string;
  others: UnitWithId[];
  site: SiteConfig;
  /** Unidades del mismo piso (pestaña "Planta del piso"). */
  floorUnits: UnitWithId[];
  /** En overlay cierra el detalle (router.back vía DetailOverlay). Sin esto, la
   *  nav usa links a "/" (modo standalone). */
  onClose?: () => void;
}

/**
 * Landing de detalle de unidad (Fase 3, rediseño /design-reference). El markup y
 * los nombres de clase replican la referencia; el estilo vive en residencia.css
 * (scopeado bajo `.res-landing`). 100% data-driven por unidad/proyecto.
 */
export function ResidenciaLanding({
  unit,
  unitId,
  others,
  site,
  floorUnits,
  onClose,
}: ResidenciaLandingProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  // Al MONTAR esta unidad (apertura directa, o salto entre unidades por el plano/lista)
  // arrancá desde el hero: subí al tope el contenedor scrolleable (el overlay
  // interceptado, o la ventana en standalone). Corre cuando la unidad NUEVA ya está en
  // el DOM —después del crossfade de AnimatePresence (mode="wait")—, por eso pega donde
  // un reset en el overlay keyeado por unitId no llegaba (se disparaba sobre la unidad
  // saliente). Cura el nav blanco sobre el 360 y el flash de la planta al dar "Disponibilidad".
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let el = root.parentElement;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        el.scrollTop = 0;
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo(0, 0);
  }, [unitId]);

  return (
    <div ref={rootRef} className={`res-landing${unit.tour360 ? " has-360" : ""}`}>
      <LandingNav site={site} unit={unit} onClose={onClose} />

      <HeroGallery unit={unit} />

      {/* Cuerpo de la landing. En unidades con 360° (mobile) forma la "hoja" opaca que
          sube tapando el kuula fijo detrás (ver residencia.css → .has-360 .landing-body).
          En desktop y sin 360° es un contenedor plano, sin estilo → no cambia nada. */}
      <div className="landing-body">
        {/* Miro 2026-07-15/16: de la vieja sección 1 (DataBar) sólo vuelve el TÍTULO,
            visible y renombrado ("DEPARTAMENTO N.º") — corrección del cliente: no había
            que sacarlo, sólo cambiar la palabra. Precio, chips, descripción, dirección
            y botones siguen eliminados; el párrafo descriptivo ÚNICO por unidad
            (SEO/thin content) sigue saliendo en el HTML del server como sr-only. */}
        <section className="unit-head">
          <h1 className="unit-title serif">{t.common.residence(unit.residence)}</h1>
        </section>
        <p className="sr-only">
          {t.dataBar.blurb({
            beds: unit.beds,
            baths: formatBaths(unit.baths, t.numberLocale),
            toilette: unit.toilette,
            area: unit.areas?.total != null ? String(unit.areas.total) : undefined,
            floor: unit.residence.length > 2 ? unit.residence.slice(0, -2) : unit.residence,
            duplex: unit.duplex,
            vistas: unit.vistas,
          })}
        </p>

        <Reveal as="section" className="section-pad">
          <PlanSection unit={unit} unitId={unitId} floorUnits={floorUnits} />
        </Reveal>

        <Reveal as="section" className="section-pad">
          <SpecsSection />
        </Reveal>

        <Reveal as="section" className="section-pad section-bordered-2">
          <LocationSection site={site} />
        </Reveal>

        <Reveal as="section" className="section-pad section-bordered">
          <ContactSection unit={unit} unitId={unitId} site={site} />
        </Reveal>

        <Reveal as="section" className="section-pad section-bordered">
          <AvailableResidences others={others} />
        </Reveal>

        <TowerSection />
      </div>
    </div>
  );
}
