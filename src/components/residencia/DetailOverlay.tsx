"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SiteConfig, Unit } from "@/lib/types";
import type { UnitWithId, VistaUnidad } from "@/lib/data";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { ResidenciaLanding } from "./ResidenciaLanding";

interface DetailOverlayProps {
  unit: Unit;
  unitId: string;
  others: UnitWithId[];
  site: SiteConfig;
  floorUnits: UnitWithId[];
  vistas: VistaUnidad[];
}

/**
 * Wrapper del detalle cuando se abre SOBRE el showroom. Lo monta `UnitDetailHost`
 * mirando la URL (ver src/lib/residencia.ts para por qué ya no es una ruta
 * interceptada). Es un overlay full-screen scrolleable, OPACO desde el primer
 * frame: se ve de una — los datos ya están en memoria, no hay RSC que esperar —
 * y su contenido sube con un fade de ~0.45s. Al cerrar hace fade-out y recién ahí
 * vuelve al exterior (que dispara el zoom-out del showroom vía ZoomLayer). El back
 * del navegador y Escape cierran igual. Entre unidades (carrusel) hace crossfade
 * keyeado por unitId. El cierre lo dispara la navbar (onClose).
 */
export function DetailOverlay({ unit, unitId, others, site, floorUnits, vistas }: DetailOverlayProps) {
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

  // Bloquear el scroll del body mientras el overlay está abierto. Va por el lock
  // COMPARTIDO (contador): encima del overlay se abren galería/360/buscador, que
  // bloquean también, y con el save/restore a mano el orden de limpieza dejaba el
  // body en "hidden" al salir al exterior (showroom sin scroll hasta refrescar).
  useEffect(() => lockBodyScroll(), []);

  // Al SALTAR de unidad (carrusel / plano de la planta) el overlay NO se remonta, así
  // que su scroll quedaba donde venías (p. ej. abajo, en la planta). Lo reseteamos al
  // tope: la unidad nueva se ve desde SU hero. Cura el nav blanco (el hero queda a la
  // vista → el nav-ghost lo detecta) y el flash de la planta al dar "Disponibilidad".
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [unitId]);

  // FAILSAFE del cierre. `closing` deja el overlay en opacity 0 y recién el
  // onAnimationComplete hace el router.back(). Si ese back NO nos saca del detalle
  // —quedó otra /residencia en el historial (buscador y masterplan navegan con push)—
  // el overlay se queda montado, INVISIBLE y `fixed z-100`: se ve el showroom
  // apagado por el velo del zoom y no responde a nada. Si a los 1,5 s seguimos acá,
  // devolvemos el overlay a la vista en vez de dejar ese vidrio.
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => setClosing(false), 1500);
    return () => window.clearTimeout(t);
  }, [closing]);

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
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-tier-dark"
      // Opaco desde el primer frame: el detalle entra SIN demora artificial — apenas
      // llega el RSC se ve. El lienzo oscuro hace el handoff sin parpadeo desde el
      // shell de carga (también oscuro). Sólo anima al CERRAR (fade-out → navegar a "/").
      initial={false}
      // `pointerEvents` acompaña al fade: mientras se va, el overlay no debe comerse
      // el primer toque sobre el showroom que ya se ve por detrás.
      animate={{ opacity: closing ? 0 : 1, pointerEvents: closing ? "none" : "auto" }}
      transition={{ duration: reduce ? 0 : closing ? 0.25 : 0.3, ease: "easeOut" }}
      onAnimationComplete={() => {
        // Cerrar con router.back() y no navegando a una URL. El overlay lo monta
        // `UnitDetailHost` a partir del PATHNAME, y la entrada /residencia/<id> se
        // apiló con history.pushState sobre la del showroom; los saltos entre
        // unidades usan replace (no apilan), así que el historial siempre es
        // `/showroom → /residencia/<actual>`. Un back deja el pathname en /showroom
        // → el host desmonta el overlay y ZoomLayer dispara el zoom-out, con el
        // showroom PRESERVADO e interactivo debajo (nunca se desmontó).
        //
        // Un `router.replace("/showroom")` acá sería peor: es una navegación de
        // verdad, así que además de cerrar el overlay REMONTARÍA el showroom y se
        // perdería la cámara — justo lo que todo este arreglo existe para conservar.
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
            vistas={vistas}
            onClose={close}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
