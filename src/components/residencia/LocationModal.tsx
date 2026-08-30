"use client";

// Reusa el CSS scopeado del mapa (`.res-landing .map-*`, `#map`) y la "hoja"
// `.sheet-*`: se abre desde el SHOWROOM, donde la landing no está montada. SITE es
// client-safe (sólo tipos + datos), igual que en GalleryModal.
import "./residencia.css";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { SITE } from "@/data/site";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";
import { LocationMap } from "./LocationMap";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * "Ubicación" — modal del showroom con el MISMO mapa interactivo de las landings de
 * /residencia (LocationMap: marker dorado, POIs, pills, tarjeta de dirección). El mapa
 * llena el cuerpo de la hoja (sin scroll interno; el mapa maneja sus gestos).
 */
export function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
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
                <h2 className="sheet-title">{t.location.sectionTitle}</h2>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label={t.project.close}
                  onClick={onClose}
                >
                  <CloseIcon width={22} height={22} />
                </button>
              </header>

              <div className="sheet-body sheet-body--map">
                <LocationMap site={SITE} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
