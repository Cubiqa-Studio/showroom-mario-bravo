"use client";

// Reusa el CSS scopeado `.res-landing .spec-*` (specs) y la "hoja" `.sheet-*`. Se
// activa SÓLO desde el sidebar del showroom (no desde la bolita 360° del exterior,
// que abre el Vr360Modal pelado).
import "./residencia.css";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import type { SpecPanel } from "@/lib/types";
import { AMENITIES_360 } from "@/lib/vr-hotspots";
import { kuulaEmbedUrl } from "@/lib/kuula";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";
import { CloseIcon } from "../gallery/icons";

/**
 * "Amenities" — recorrido 360° de Kuula de los amenities ARRIBA + TODAS las
 * especificaciones de amenities ABAJO, con scroll interno en la hoja. `panel` es el
 * SpecPanel `id:"amenities"` (su body + listas). El iframe ocupa una altura fija para
 * que las specs queden visibles/alcanzables debajo (incluso en mobile).
 */
export function AmenitiesModal({
  open,
  onClose,
  panel,
}: {
  open: boolean;
  onClose: () => void;
  panel: SpecPanel | null;
}) {
  const { t } = useI18n();
  const isTouch = useIsTouch();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="sheet-overlay"
            initial={{ opacity: 0 }}
            // pointerEvents off al cerrar (bug 216 breathe): el overlay que se desvanece
            // no debe capturar el puntero. "auto" en animate lo restaura al reabrir.
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="res-landing sheet">
              <header className="sheet-head">
                <div>
                  <p className="sheet-eyebrow">{t.vr.tour}</p>
                  <h2 className="sheet-title">{t.sideMenu.amenities}</h2>
                </div>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label={t.project.close}
                  onClick={onClose}
                >
                  <CloseIcon width={22} height={22} />
                </button>
              </header>

              <div className="sheet-body">
                {/* El 360 de amenities sólo si existe: TIER Bravo todavía no lo tiene
                    (ver src/lib/vr-hotspots.ts) y un iframe sin src queda en blanco.
                    Mientras tanto la hoja muestra sólo las specs. */}
                {AMENITIES_360 && (
                  <div className="sheet-amenities-360">
                    {/* Sin giroscopio/acelerómetro: inclinar el celular no mueve el 360°
                        (sólo se mira arrastrando). Se conserva `fullscreen`. En táctil,
                        `withKuulaTouchGate` fuerza la pantalla de título (anti-lag iOS). */}
                    <iframe
                      src={kuulaEmbedUrl(AMENITIES_360, isTouch)}
                      title={t.vr.virtualTour}
                      allow="fullscreen"
                      allowFullScreen
                    />
                  </div>
                )}

                {panel && (
                  <div className="sheet-amenities-specs">
                    {/* `.spec-panel active` para heredar el estilo scopeado de listas. */}
                    <div className="spec-panel active">
                      <p className="am-lead">{panel.body}</p>
                      {panel.lists?.length ? (
                        <div className="amenities-lists">
                          {panel.lists.map((list, i) => (
                            <div className="spec-list" key={list.heading ?? i}>
                              {list.heading ? <h4>{list.heading}</h4> : null}
                              <ul>
                                {list.items.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
