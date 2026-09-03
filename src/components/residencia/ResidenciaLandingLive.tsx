"use client";

import type { SiteConfig, Unit } from "@/lib/types";
import type { UnitWithId, VistaUnidad } from "@/lib/units";
import { floorUnitsFrom, otherAvailableUnitsFrom } from "@/lib/units";
import { useLiveUnitsOrNull } from "@/hooks/useLiveUnits";
import { ResidenciaLanding } from "./ResidenciaLanding";

interface ResidenciaLandingLiveProps {
  unitId: string;
  /** Lo que horneó el build (Airtable al momento del deploy). Es el punto de partida
   *  y el fallback si el proxy no responde. */
  unit: Unit;
  others: UnitWithId[];
  floorUnits: UnitWithId[];
  site: SiteConfig;
  vistas: VistaUnidad[];
}

/**
 * Capa EN VIVO de la ficha STANDALONE (entrada directa por link, Google o F5).
 *
 * Antes la página era ISR: se revalidaba cada 60 s y el HTML salía con el estado y
 * el precio reales de Airtable. Con `output: "export"` el HTML se hornea una vez en
 * el build, así que sin esto el dato quedaría congelado hasta el próximo deploy —
 * justo lo que el cliente cambia a diario (disponibilidad y precio).
 *
 * El patrón es "horneado primero, vivo encima": se renderiza lo del build (primer
 * frame correcto, sin parpadeo ni skeleton, y es lo que leen los crawlers) y cuando
 * llega el map en vivo se re-derivan la unidad, el carrusel de otras disponibles y
 * las unidades del piso. Si el proxy está caído no se nota: queda lo horneado.
 *
 * Las derivaciones se recalculan del map traído y NO se recibe el map por props: así
 * el HTML de cada una de las 61 fichas no engorda con las 61 unidades.
 */
export function ResidenciaLandingLive({
  unitId,
  unit: unitHorneada,
  others: othersHorneados,
  floorUnits: floorUnitsHorneadas,
  site,
  vistas,
}: ResidenciaLandingLiveProps) {
  const live = useLiveUnitsOrNull();

  // `live[unitId]` puede faltar si la unidad se sacó de Airtable: en ese caso vale
  // lo horneado (nunca se queda sin datos y la ficha no se rompe).
  const unit = live?.[unitId] ?? unitHorneada;
  const others = live ? otherAvailableUnitsFrom(live, unitId) : othersHorneados;
  const floorUnits = live ? floorUnitsFrom(live, unitId) : floorUnitsHorneadas;

  return (
    <ResidenciaLanding
      unit={unit}
      unitId={unitId}
      others={others}
      site={site}
      floorUnits={floorUnits}
      vistas={vistas}
    />
  );
}
