"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useTransitionOrigin } from "./TransitionProvider";

/**
 * Envuelve el showroom (FlybyViewer). Reacciona al PATHNAME: cuando la ruta es
 * /residencia/* (hay una ficha abierta como overlay encima), hace zoom-in leve
 * hacia el punto clickeado + oscurece; al cerrar (back del navegador o botón),
 * zoom-out a escala 1. Como depende del pathname, el back nativo dispara el
 * zoom-out solo — sin estado suelto. El showroom NUNCA se desmonta, así que al
 * volver queda exactamente donde estaba (cámara/scroll preservados).
 *
 * Sigue funcionando sin cambios después de sacar la ruta interceptada: la ficha
 * ahora se abre reescribiendo la URL con `history.pushState`, que Next parchea para
 * mantener `usePathname()` en sincronía (ver src/lib/residencia.ts). O sea que este
 * componente ve exactamente lo mismo que veía antes.
 *
 * prefers-reduced-motion → sin zoom ni overlay (navegación directa).
 */
export function ZoomLayer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { origin, opening, setOpening } = useTransitionOrigin();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Apagá `opening` SÓLO cuando la ruta YA estuvo en el detalle y luego salió
  // (cierre con botón o back del navegador) → dispara el zoom-out. Nunca se apaga
  // entre el click y el commit de la navegación (ahí el pathname todavía es "/").
  const wasDetail = useRef(false);
  useEffect(() => {
    const isDetail = pathname?.startsWith("/residencia") ?? false;
    if (isDetail) {
      wasDetail.current = true;
    } else if (wasDetail.current) {
      wasDetail.current = false;
      setOpening(false);
    }
  }, [pathname, setOpening]);

  // FAILSAFE del velo. `opening` se prende SINCRÓNICO en el click y lo apaga el
  // bloque de arriba cuando la ruta VUELVE del detalle. Si la navegación nunca llega
  // —RSC lento o caído en una red móvil floja, el usuario que cancela—, el pathname
  // nunca fue /residencia, `wasDetail` sigue en false y NADIE apagaba `opening`: el
  // showroom se quedaba con el velo negro al 50% encima, "todo oscuro", hasta
  // refrescar (reporte de Joaquim, 30-08). Si a los 8 s seguimos afuera, lo soltamos.
  // Si la ruta finalmente llega, el velo lo sostiene el pathname (y para entonces el
  // detalle, opaco, ya está por encima), así que soltarlo acá no se ve.
  useEffect(() => {
    if (!opening) return;
    if (pathname?.startsWith("/residencia")) return;
    const t = window.setTimeout(() => setOpening(false), 8000);
    return () => window.clearTimeout(t);
  }, [opening, pathname, setOpening]);

  // Zoom-IN instantáneo: arranca con `opening` (seteado sincrónico en el click),
  // sin esperar a que monte la ficha. El pathname lo sostiene abierto.
  const open = opening || (pathname?.startsWith("/residencia") ?? false);
  // Mobile: zoom más sutil (~1.04). Desktop: ~1.07.
  const targetScale = open && !reduce ? (isMobile ? 1.04 : 1.07) : 1;
  const transformOrigin = origin ? `${origin.x}px ${origin.y}px` : "50% 50%";

  return (
    <>
      {/* El `overflow-hidden` recorta el zoom. Sin él, al abrir un detalle el home
          escalado (1,04 en celular · 1,07 en escritorio) se pasa del ancho del
          viewport —412 × 1,04 = 428— y ESO le agrega scroll HORIZONTAL al documento:
          con la ficha abierta se podía arrastrar la página al costado y aparecía una
          franja negra. El velo de abajo es `fixed`, así que no necesita recorte, y el
          contenido del home ya vive en una caja de 100dvh: no hay nada que scrollear
          acá adentro. Los modales van por portal al body, fuera de este contenedor. */}
      <div className="overflow-hidden">
        <motion.div
          className="h-[100dvh] w-full"
          style={{ transformOrigin }}
          animate={{ scale: targetScale }}
          transition={
            reduce
              ? { duration: 0 }
              : open
                ? // Forward (zoom-in al abrir): ~1.5s, para que se vea el "avance".
                  { duration: 1.5, ease: [0.4, 0, 0.2, 1] }
                : // Reverse (zoom-out al cerrar): ágil, como estaba.
                  { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {children}
        </motion.div>
      </div>

      {/* Velo translúcido que acompaña el zoom (encima del home, debajo del detalle).
          En el negro de marca: "lava" hacia la ficha oscura a la que se entra. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 bg-tier-dark"
        initial={false}
        animate={{ opacity: open && !reduce ? 0.5 : 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: open ? 1.0 : 0.45, ease: "easeOut" }
        }
      />
    </>
  );
}
