"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";
import { kuulaEmbedUrl } from "@/lib/kuula";
import { CloseIcon } from "./icons";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * Modal a (casi) pantalla completa con el recorrido 360° de Kuula embebido. Se abre
 * al tocar la bolita 360° (<VrHotspot>) del hall de entrada. A diferencia del Hero360
 * de la landing, acá el iframe ocupa todo el panel y queda 100% interactivo (no hay
 * página que scrollear detrás: el fondo se bloquea), así que no necesita "shield".
 *
 * Click en el backdrop o Escape cierran; el panel interior frena la propagación para
 * que arrastrar dentro del 360 no dispare el cierre.
 */
export function Vr360Modal({
  src,
  onClose,
  // z-index del portal. Default (z-[70]) sirve sobre el flyby del home; el SideMenu
  // (que también abre estos tours) lo sube por encima del overlay de detalle.
  zClass = "z-[70]",
}: {
  src: string | null;
  onClose: () => void;
  zClass?: string;
}) {
  const { t } = useI18n();
  const isTouch = useIsTouch();

  // Cerrar con Escape + bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [src, onClose]);

  return (
    <FloatingPortal>
      <AnimatePresence>
        {src && (
          <motion.div
            className={`fixed inset-0 ${zClass} grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-5`}
            initial={{ opacity: 0 }}
            // pointerEvents off al cerrar: si no, el backdrop full-screen —mientras se
            // desvanece en el exit— se come el primer hover sobre una unidad del showroom
            // (bug 216 breathe). "auto" en animate lo restaura si se reabre a mitad.
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            <motion.div
              className="relative h-full max-h-[94vh] w-full max-w-[1700px] overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sin giroscopio/acelerómetro: inclinar el celular no mueve el 360°
                  (sólo se mira arrastrando). Se conserva `fullscreen`. En táctil,
                  `withKuulaTouchGate` fuerza la pantalla de título (anti-lag iOS). */}
              <iframe
                className="absolute inset-0 h-full w-full border-0"
                src={kuulaEmbedUrl(src, isTouch)}
                title={t.vr.virtualTour}
                allow="fullscreen"
                allowFullScreen
              />
              {/* Cerrar: un poco más abajo y con fondo blanco para no pisar el botón
                  de pantalla completa que Kuula dibuja en la esquina superior derecha. */}
              <button
                type="button"
                aria-label={t.vr.close}
                onClick={onClose}
                className="absolute right-3 top-10 z-10 grid h-10 w-10 place-items-center rounded-full bg-tier-dark/85 text-ink shadow-lg ring-1 ring-line backdrop-blur transition hover:bg-tier-dark"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
