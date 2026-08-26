"use client";

import type { Unit } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { unitArea, orientationLabel } from "@/lib/residencia";
import { STATUS_STYLES, DUPLEX_COLOR, EXPOSURE_COLOR } from "@/lib/status";

/* eslint-disable @next/next/no-img-element */

// OJO: este componente se monta también DENTRO de `.res-landing`, que trae un
// reset global `* { margin:0; padding:0 }` con la misma especificidad que las
// utilidades de Tailwind → pisaría `px-*`/`py-*`/`mt-*`. Por eso el padding y
// los márgenes van por estilo INLINE (gana siempre), no por clases.
const badgeStyle = (bg: string): React.CSSProperties => ({
  backgroundColor: bg,
  padding: "4px 10px",
});

/**
 * Tarjeta compacta de unidad — el hover/preview que se ve en TODOS lados: en el
 * exterior (polígono de una unidad), en "Planta del piso" y en "Unidades
 * Disponibles". Diseño minimalista (propuesta del cliente): plano arriba con los
 * badges (estado + dúplex) JUNTOS arriba-izquierda, y barra oscura abajo con
 * nombre + "Consultar" + una línea compacta (dorm · baño · área · orientación).
 */
export function UnitCard({ unit }: { unit: Unit }) {
  const { t } = useI18n();
  const plan = unit.floorPlan || unit.image;
  const area = unitArea(unit, t.numberLocale);
  const orient = unit.orientation ? orientationLabel(unit.orientation, t.orientations) : "";
  const stats = [
    // Ambientes y Vistas EN VIVO (Airtable): sólo si la unidad los trae.
    // Miro 2026-07-15: sin tipología (se sacó de toda la UI).
    unit.ambientes != null ? t.unitCard.rooms(unit.ambientes) : "",
    t.unitCard.beds(unit.beds),
    t.unitCard.baths(unit.baths),
    `${area.value} ${area.unit}`,
    unit.vistas ?? "",
    orient,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-56 overflow-hidden rounded-xl bg-paper shadow-2xl ring-1 ring-line">
      <div className="relative aspect-[4/3] bg-mist">
        {/* Caja de proporción FIJA + contain: todas las tarjetas miden lo mismo,
            sin importar si el plano es vertical, apaisado o dúplex. */}
        <img
          src={plan}
          alt={t.unitTooltip.planAlt(unit.residence)}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ padding: "10px" }}
        />

        {/* Badges JUNTOS, montados sobre la línea plano/barra negra: la mitad
            queda sobre el plano y la mitad sobre la franja oscura, así no tapan
            tanto el plano. `bottom-0` + translate-50% los centra en el borde; al
            estar posicionados pintan por encima de la barra `.bg-mist` siguiente. */}
        <div className="absolute inset-x-2.5 bottom-0 z-10 flex translate-y-1/2 flex-wrap items-center justify-end gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold text-white shadow"
            style={badgeStyle(STATUS_STYLES[unit.status].color)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-tier-dark/85" />
            {t.status[unit.status]}
          </span>
          {unit.duplex ? (
            <span
              className="rounded-full text-[11px] font-semibold text-white shadow"
              style={badgeStyle(DUPLEX_COLOR)}
            >
              {t.status.duplex}
            </span>
          ) : null}
          {/* Exposición (pedido del cliente, 25-08): mismo lugar y misma forma que el
              chip de dúplex. Las unidades que dan a los dos lados no traen `exposure`
              y no muestran chip. */}
          {unit.exposure ? (
            <span
              className="rounded-full text-[11px] font-semibold text-white shadow"
              style={badgeStyle(EXPOSURE_COLOR)}
            >
              {t.status[unit.exposure]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="bg-mist" style={{ padding: "12px 16px 14px" }}>
        {/* Miro 2026-07-15: sin precio en la tarjeta (se sacaron los precios). */}
        <h3 className="font-serif text-lg leading-tight tracking-wide text-cream">
          {t.common.residence(unit.residence)}
        </h3>
        <p
          className="line-clamp-2 text-[11px] leading-relaxed text-cream/55"
          style={{ marginTop: 6, minHeight: "2.2rem" }}
        >
          {stats}
        </p>
      </div>
    </div>
  );
}
