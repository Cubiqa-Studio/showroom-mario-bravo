"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useAvance } from "@/hooks/useAvance";
import { AvanceModal } from "./residencia/AvanceModal";

/** Piquito de minero (SVG). La clase `avance-pick` (globals.css) lo hace "golpear"
 *  en loop, respetando reduced-motion. Hereda el color del badge (currentColor). */
function PickaxeIcon() {
  return (
    <svg
      className="avance-pick"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* cabeza del pico (arco) + mango */}
      <path d="M4 8.5C8 5 16 5 20 8.5" />
      <path d="M12 6.5V19" />
    </svg>
  );
}

/**
 * Badge compacto de "Avance de obra" (ícono + %). Click → abre el modal con el
 * detalle (hito, fechas, nota). Mientras carga desde Airtable muestra un skeleton;
 * si no hay datos (tabla vacía / sin configurar), no se muestra nada. Pensado para
 * ir arriba a la derecha en el showroom y en el nav de la landing. En mobile es
 * sólo ícono + % (la etiqueta corta aparece desde sm).
 */
export function AvanceBadge({ className = "" }: { className?: string }) {
  const { avance, loading } = useAvance();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  // Sin datos → no ocupamos espacio.
  if (!loading && !avance) return null;

  const pct = avance ? Math.max(0, Math.min(100, Math.round(avance.percent))) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => avance && setOpen(true)}
        disabled={loading || !avance}
        aria-label={t.avance.title}
        title={t.avance.title}
        // OJO: dentro de la landing, el reset `.res-landing button { background:none;
        // color:inherit; font:inherit }` + `.res-landing * { margin:0; padding:0 }`
        // (misma especificidad que Tailwind) PISAN bg-*/text-*/font-*/px-*/py-*. Por eso
        // TODO lo crítico (layout, fondo, color, tipografía, padding) va INLINE: gana
        // siempre, en el showroom y en la landing. (Mismo criterio que UnitCard.)
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 16px",
          background: "var(--mist)",
          color: "var(--cream)",
          fontSize: 12,
          fontWeight: 600,
        }}
        className={`rounded-full shadow-lg ring-1 ring-white/15 transition hover:brightness-110 disabled:cursor-default ${className}`}
      >
        <PickaxeIcon />
        {loading ? (
          <span
            className="animate-pulse"
            aria-hidden
            style={{ height: 10, width: 28, borderRadius: 9999, background: "color-mix(in srgb, var(--cream) 30%, transparent)" }}
          />
        ) : (
          <span
            className="tabular-nums"
            style={{ display: "inline-flex", alignItems: "baseline", gap: 6, lineHeight: 1 }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gold-bright)" }}>{pct}%</span>
            {/* "Avance de obra" es más largo que el viejo "Obra": nowrap para que nunca
                parta el badge en dos líneas; en el nav de la landing (768-1180px, banda
                cargada) residencia.css oculta esta etiqueta vía .avance-short. */}
            <span
              className="avance-short hidden sm:inline"
              style={{ color: "color-mix(in srgb, var(--cream) 70%, transparent)", whiteSpace: "nowrap" }}
            >
              {t.avance.short}
            </span>
          </span>
        )}
      </button>
      {avance && <AvanceModal open={open} onClose={() => setOpen(false)} avance={avance} />}
    </>
  );
}
