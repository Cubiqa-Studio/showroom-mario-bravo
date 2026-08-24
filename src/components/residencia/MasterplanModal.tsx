"use client";

// Importa los estilos scopeados `.res-landing .plate-*` (planta, polígonos,
// tooltip, etc.): el modal puede abrirse desde el EXTERIOR, donde la landing —y
// por ende su CSS— no está montada. Es CSS scopeado, no filtra nada global.
import "./residencia.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import unitsData from "@/data/units.json";
import type { Units } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { useLiveUnits } from "@/hooks/useLiveUnits";
import { CloseIcon } from "../gallery/icons";
import { FloorPlate } from "./FloorPlate";

// Fallback estático (bundleado, seguro en cliente). El estado/precio EN VIVO sale
// de Airtable: si el padre nos pasa `units` (el showroom ya las tiene en vivo) las
// usamos directo; si no (la landing), las traemos lazy de /api/unidades al abrir.
const UNITS = unitsData as unknown as Units;

/**
 * "Plan Maestro" — modal a pantalla completa con la planta del piso GRANDE
 * (pedido del cliente: que tome protagonismo) y switch de piso (flechas + pills
 * PB/1°/2°/3°). Reutiliza <FloorPlate> tal cual lo de la landing; click en una
 * unidad cierra el modal y abre esa residencia (desde el home, con el zoom).
 * Vive en el SideMenu compartido, así funciona en el exterior y en la landing.
 */
export function MasterplanModal({
  open,
  onClose,
  units,
}: {
  open: boolean;
  onClose: () => void;
  /** Unidades EN VIVO ya mergeadas (las pasa el showroom). Sin esto, el modal las
   *  trae solo de /api/unidades al abrirse (caso landing). */
  units?: Units;
}) {
  const router = useRouter();
  const { t } = useI18n();
  // Si el padre no las pasó, fetch lazy al abrir; si las pasó, usamos esas.
  const fetched = useLiveUnits(UNITS, open && !units);
  const allUnits = units ?? fetched;

  // Cerrar con Escape + bloquear el scroll del fondo mientras está abierto.
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

  const openUnit = (id: string) => {
    onClose();
    router.push(`/residencia/${id}`);
  };

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="masterplan-overlay"
            initial={{ opacity: 0 }}
            // pointerEvents off al cerrar (bug 216 breathe): el overlay que se desvanece
            // no debe capturar el puntero. "auto" en animate lo restaura al reabrir.
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            // Cortar el drag del flyby si se abre desde el exterior.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="res-landing masterplan-scope">
              <header className="masterplan-head">
                <div>
                  <p className="mp-eyebrow">{t.masterplan.eyebrow}</p>
                  <h2 className="mp-title serif">{t.masterplan.title}</h2>
                </div>
                <button
                  type="button"
                  className="mp-close"
                  aria-label={t.masterplan.close}
                  onClick={onClose}
                >
                  <CloseIcon width={22} height={22} />
                </button>
              </header>

              <div className="masterplan-body">
                <FloorPlate allUnits={allUnits} onOpenUnit={openUnit} floorPills />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
