"use client";

// Reusa el CSS scopeado `.res-landing .spec-*` (contenido) y la "hoja" `.sheet-*`
// (chrome): este modal se abre desde el SHOWROOM (exterior), donde la landing —y por
// ende su CSS— no está montada. Es CSS scopeado, no filtra nada global.
import "./residencia.css";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import type { SpecPanel } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";
import { SpecsSection } from "./SpecsSection";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * "El Proyecto" — modal del showroom con las secciones de proyecto que se sacaron
 * del acordeón por unidad y van "aparte en el inicio": Amenities, Calidad y
 * Tecnología, El Equipo, Financiación y Beneficios. Son los paneles `home` de
 * `t.specs.panels` → se renderizan como tabs del acordeón embebido (SpecsSection).
 * Usa la "hoja" del showroom: header FIJO (con la X siempre visible) + cuerpo con
 * scroll INTERNO. En mobile el acordeón se pagina con flechas (ver SpecsSection).
 * Cierre por Escape o backdrop; bloquea el scroll del fondo.
 */
export function ProjectModal({
  open,
  onClose,
  panels,
}: {
  open: boolean;
  onClose: () => void;
  panels: SpecPanel[];
}) {
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
            // Cortar el drag del flyby (se abre desde el exterior).
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="res-landing sheet">
              <header className="sheet-head">
                <div>
                  <p className="sheet-eyebrow">{t.project.eyebrow}</p>
                  <h2 className="sheet-title">{t.project.title}</h2>
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
                <SpecsSection panels={panels} embedded />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
