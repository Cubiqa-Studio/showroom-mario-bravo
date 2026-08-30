"use client";

// Reusa la "hoja" compartida (`.sheet-*`) y el scope `.res-landing`: se abre desde
// el SHOWROOM (exterior) y desde la landing. CSS scopeado, no filtra nada global.
import "./residencia.css";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";
import { CaviahueCarousel } from "./CaviahueCarousel";
import { lockBodyScroll } from "@/lib/scroll-lock";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "Conocé Caviahue" — modal que resalta los puntos más importantes de la villa
 * (centro de esquí, termas de Copahue, Salto del Agrio, lago, centro comercial…).
 * Usa la "hoja" del showroom (header fijo + cuerpo con scroll): arriba la galería
 * auto-avanzante (fotos + videos del cliente, reemplazó al video CapCut 22/07),
 * abajo el índice editorial. El contenido (por idioma) vive en `t.caviahue`.
 * Cierra con Escape o backdrop; bloquea el scroll del fondo mientras está abierto.
 */
export function CaviahueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
                  <p className="sheet-eyebrow">{t.caviahue.eyebrow}</p>
                  <h2 className="sheet-title">{t.caviahue.title}</h2>
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
                <div className="wrap">
                  {/* La galería sólo monta con el modal abierto → no descarga nada
                      hasta que el usuario entra (los videos pesan). */}
                  <CaviahueCarousel />
                  <p className="muted center caviahue-intro">{t.caviahue.intro}</p>
                  <ol className="caviahue-list">
                    {t.caviahue.points.map((pt, i) => (
                      <li className="caviahue-item" key={pt.title}>
                        <span className="cv-no">{pad(i + 1)}</span>
                        <div className="cv-body">
                          <h3>{pt.title}</h3>
                          <p>{pt.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
