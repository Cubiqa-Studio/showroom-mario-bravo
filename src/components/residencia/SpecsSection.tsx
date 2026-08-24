"use client";

import { useState } from "react";
import type { SpecPanel } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { AnimationTile } from "./AnimationTile";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "Especificaciones" (sección 5): nav de 2 columnas sticky + panel activo. El
 * contenido editorial vive en el diccionario i18n (t.specs.panels).
 */
export function SpecsSection({
  panels: panelsProp,
  embedded = false,
}: {
  /** Si se pasan, se renderizan tal cual; si no, las de la unidad: las que NO
      llevan `home` (las `home` viven en el showroom, vía ProjectModal). */
  panels?: SpecPanel[];
  /** Modal "El Proyecto": omite el encabezado de sección (lo pone el modal). */
  embedded?: boolean;
} = {}) {
  const { t } = useI18n();
  const panels = panelsProp ?? t.specs.panels.filter((p) => !p.home);
  const [active, setActive] = useState(0);
  if (!panels.length) return null;
  const total = panels.length;
  const p = panels[Math.min(active, total - 1)];

  return (
    <div className={`wrap${embedded ? " spec-embedded" : ""}`}>
      {!embedded && (
        <div className="spec-head">
          <h2 className="section-title">{t.specs.sectionTitle}</h2>
          <p className="muted center">{t.specs.intro}</p>
        </div>
      )}

      <div className="spec-2col">
        <div className="spec-nav">
          {panels.map((panel, i) => (
            <div
              key={panel.title}
              className={`spec-nav-item${i === active ? " active" : ""}`}
              onClick={() => setActive(i)}
            >
              <span className="n">{pad(i + 1)}</span>
              <span className="t">{panel.title}</span>
            </div>
          ))}
          {/* Animación vertical del proyecto bajo la lista (pedido 22/07) — sólo
              en la landing; la hoja "El Proyecto" del showroom no la lleva. */}
          {!embedded && <AnimationTile />}
        </div>

        <div className="spec-pane">
          {/* Paginador mobile (flechitas 01→03): CSS lo muestra sólo en la hoja
              embebida y en pantallas chicas; en desktop se usa la lista de la izq. */}
          {embedded && total > 1 && (
            <div className="spec-pager">
              <button
                type="button"
                className="sp-arrow"
                aria-label={t.galleryModal.prev}
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="sp-count">
                {pad(active + 1)} / {pad(total)}
              </span>
              <button
                type="button"
                className="sp-arrow"
                aria-label={t.galleryModal.next}
                onClick={() => setActive((a) => Math.min(total - 1, a + 1))}
                disabled={active === total - 1}
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
          {/* key={active} → replay de la animación viewIn al cambiar de panel. */}
          <div className="spec-panel active" key={active}>
            <div className="sp-num">
              {pad(active + 1)} / {pad(total)}
            </div>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
            {p.lists?.map((list, i) => (
              <div className="spec-list" key={list.heading ?? i}>
                {list.heading ? <h4>{list.heading}</h4> : null}
                <ul>
                  {list.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {p.grid?.length ? (
              <div className="spec-grid">
                {p.grid.map((g) => (
                  <div key={g.label}>
                    <strong>{g.label}</strong>
                    <br />
                    {g.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="sg-logo" src={g.image} alt={g.label} />
                    ) : null}
                    {g.value}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
