"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SiteConfig, Unit } from "@/lib/types";
import type { UnitWithId } from "@/lib/data";
import { ResidenciaLanding } from "./ResidenciaLanding";

interface DetailOverlayProps {
  unit: Unit;
  unitId: string;
  others: UnitWithId[];
  site: SiteConfig;
  floorUnits: UnitWithId[];
}

/**
 * Wrapper del detalle cuando se abre SOBRE el home (ruta interceptada). Es un
 * overlay full-screen scrolleable, OPACO desde el primer frame: apenas llega el
 * RSC se ve (su contenido sube con un fade de ~0.45s desde el fondo blanco) — sin
 * demora artificial, así "entrás a la landing" en vez de quedar mirando el home
 * congelado. Al cerrar hace fade-out y recién ahí navega al exterior `/` (que dispara
 * el zoom-out del home vía ZoomLayer). El back del navegador y Escape cierran igual.
 * Entre unidades (carrusel) hace crossfade keyeado por unitId. El cierre lo
 * dispara la navbar (onClose).
 */
export function DetailOverlay({ unit, unitId, others, site, floorUnits }: DetailOverlayProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [closing, setClosing] = useState(false);
  // Contenedor scrolleable del overlay: lo necesitamos para resetear su scroll al cerrar.
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    if (reduce) {
      router.back();
      return;
    }
    // El cierre hace fade-out del overlay y RECIÉN ahí navega al exterior (zoom-out). Ese
    // fade muestra lo que el overlay tenga a la vista: si venías scrolleado (p. ej.
    // explorando la planta / saltando entre unidades por el plano de la tipología), se
    // veía un "flash" de esa sección baja antes del exterior. Reseteamos el scroll al
    // tope ANTES del fade → el cierre arranca desde el hero, simétrico con el zoom-in
    // (que aterriza en el hero), y nunca asoma la tipología.
    scrollRef.current?.scrollTo({ top: 0 });
    setClosing(true); // el onAnimationComplete dispara la navegación al exterior
  }, [reduce, router]);

  // Bloquear el scroll del body mientras el overlay está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Al SALTAR de unidad (carrusel / plano de la planta) el overlay NO se remonta, así
  // que su scroll quedaba donde venías (p. ej. abajo, en la planta). Lo reseteamos al
  // tope: la unidad nueva se ve desde SU hero. Cura el nav blanco (el hero queda a la
  // vista → el nav-ghost lo detecta) y el flash de la planta al dar "Disponibilidad".
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [unitId]);

  // Escape cierra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <motion.div
      ref={scrollRef}
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-white"
      // Opaco desde el primer frame: el detalle entra SIN demora artificial — apenas
      // llega el RSC se ve. El fondo blanco hace el handoff sin parpadeo desde el
      // shell de carga (también blanco). Sólo anima al CERRAR (fade-out → navegar a "/").
      initial={false}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : closing ? 0.25 : 0.3, ease: "easeOut" }}
      onAnimationComplete={() => {
        // Cerrar con router.back(): es la forma correcta de cerrar una ruta INTERCEPTADA
        // (@modal). El overlay sólo existe si llegaste navegando desde /showroom (la
        // interceptación lo exige) y los saltos entre unidades usan replace (no apilan),
        // así que el historial siempre es `/showroom → /residencia/<actual>` → un back
        // revela el showroom PRESERVADO e interactivo + dispara el zoom-out (ZoomLayer).
        // OJO: router.replace("/showroom") acá NO cierra el slot interceptado → el
        // DetailOverlay queda montado (invisible pero fixed/z-100) tapando y capturando
        // los clicks del showroom → todo "freezado" (sin scroll, sin polígonos) hasta F5.
        if (closing) router.back();
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={unitId}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: "easeOut" }}
        >
          <ResidenciaLanding
            unit={unit}
            unitId={unitId}
            others={others}
            site={site}
            floorUnits={floorUnits}
            onClose={close}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
