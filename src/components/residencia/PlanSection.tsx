"use client";

import { useState } from "react";
import type { Unit } from "@/lib/types";
import type { UnitWithId } from "@/lib/data";
import { formatBaths } from "@/lib/residencia";
import { BROCHURE_URL } from "@/lib/contact";
import { captureCta } from "@/lib/analytics";
import { useI18n } from "@/i18n/LanguageProvider";
import { FloorPlate } from "./FloorPlate";

/* eslint-disable @next/next/no-img-element */

type Tab = "plan" | "plate";

/**
 * Sección "Plano de la unidad / Planta del piso" (sección 4). Tabs in-place. El
 * plano de la unidad es la imagen `floorPlan` con watermark del número; la planta
 * delega en <FloorPlate> (esquemático hoy, polígonos trazados en Fase 6). El
 * aside "Resumen" sale de areas/beds/baths/orientación.
 */
export function PlanSection({
  unit,
  unitId,
  floorUnits,
}: {
  unit: Unit;
  unitId: string;
  floorUnits: UnitWithId[];
}) {
  const [tab, setTab] = useState<Tab>("plan");
  const a = unit.areas;
  const { t } = useI18n();
  // Piso de la unidad = su id sin los dos últimos dígitos ("101" → "1", "001" → "0" = PB).
  const floor = unitId.length > 2 ? unitId.slice(0, -2) : unitId;

  return (
    <div className="wrap">
      {/* Miro 2026-07-15: sin el kicker numerado ("02") — el cliente pidió sacar los
          números de sección. El título queda como primer elemento. */}
      <h2 className="section-title center" style={{ marginBottom: 18 }}>
        {t.plan.sectionTitle}
      </h2>

      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === "plan" ? " active" : ""}`}
          onClick={() => setTab("plan")}
        >
          {t.plan.tabUnit}
        </button>
        <button
          type="button"
          className={`tab${tab === "plate" ? " active" : ""}`}
          onClick={() => setTab("plate")}
        >
          {t.plan.tabFloor}
        </button>
      </div>

      {/* Se sacaron el banner de orientación al paisaje y la leyenda
          "Camino del Volcán" (el cliente preguntó qué eran → sacarlos directamente). */}
      {tab === "plate" ? (
        /* Miro 2026-06-10 (2.ª pasada): la planta del piso ocupa el ancho COMPLETO de
           la sección — el que comparten plano + resumen en la otra tab — sin logo ni
           aside (como el FLOOR SELECTOR de la referencia). El remount re-dispara la
           animación viewIn. */
        <div className="plate-col" key="plate">
          <div className="plan-view entering">
            <FloorPlate unitId={unitId} floorUnits={floorUnits} />
          </div>
        </div>
      ) : (
      <div className="plan-layout" key="plan">
        {/* Miro 2026-06-10: logo de la marca a la izquierda del plano (ref. 123 Ocean). */}
        <div className="plan-logo">
          <img src="/logo.png" alt={t.plan.logoAlt} />
        </div>
        <div className="stage-col">
          <div className="plan-view entering">
            <div className="plan-stage">
              <div className="plan-watermark">{unit.residence}</div>
              <div className="entry-arrow">
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                {t.plan.access}
              </div>
              <img
                className="floorplan-img"
                src={unit.floorPlan}
                alt={t.plan.planAlt(unit.residence)}
              />
            </div>
          </div>

        </div>

        <aside className="overview">
          <h3>{t.plan.overviewTitle}</h3>
          {a?.total != null ? (
            <div className="ov-row">
              <span className="lbl">{t.plan.totalArea}</span>
              <span className="lead" />
              <span className="val big">{a.total} m²</span>
            </div>
          ) : null}
          <div className="ov-group-gap" />
          <div className="ov-row">
            <span className="lbl">{t.plan.bedrooms}</span>
            <span className="lead" />
            <span className="val">{unit.beds}</span>
          </div>
          <div className="ov-row">
            <span className="lbl">{t.plan.bathrooms}</span>
            <span className="lead" />
            <span className="val">{formatBaths(unit.baths, t.numberLocale)}</span>
          </div>
          {unit.toilette ? (
            <div className="ov-row">
              <span className="lbl">{t.plan.toilette}</span>
              <span className="lead" />
              <span className="val">{unit.toilette}</span>
            </div>
          ) : null}
          {/* Vistas EN VIVO (Airtable). Sólo si la unidad la trae. */}
          {unit.vistas ? (
            <div className="ov-row">
              <span className="lbl">{t.plan.vistas}</span>
              <span className="lead" />
              <span className="val">{unit.vistas}</span>
            </div>
          ) : null}
          <div className="ov-row">
            <span className="lbl">{t.plan.floor}</span>
            <span className="lead" />
            <span className="val">{t.plan.floorValue(floor)}</span>
          </div>
          <div className="ov-group-gap" />
          <div className="ov-row">
            <span className="lbl">{t.plan.amenities}</span>
            <span className="lead" />
            <span className="val">{t.plan.amenitiesValue}</span>
          </div>
          {/* Juani 2026-07-16: la fila "Entrega — 24 a 30 meses" se sacó (quedaba
              desactualizada con el tiempo); el avance real vive en el modal
              "Avance de obra" que el cliente actualiza desde Airtable. */}
          {/* "Ver PDF" = descarga el MISMO brochure del proyecto que el sidebar y la
              DataBar (BROCHURE_URL). Es un <a download> con estilo de botón (`.btn`
              aplica igual en anchors), no un <button> mudo — antes no hacía nada.
              Se oculta si todavía no hay brochure cargado (BROCHURE_URL null). */}
          {BROCHURE_URL && (
            <a
              className="btn btn-gold"
              style={{ marginTop: 36 }}
              href={BROCHURE_URL}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => captureCta("brochure", "residence_plan")}
            >
              <span className="btn-label">{t.plan.seePdf}</span>
            </a>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}
