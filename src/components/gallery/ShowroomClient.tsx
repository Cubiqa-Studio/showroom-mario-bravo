"use client";

import type { ReactNode } from "react";
import type { FlybySegment, SiteConfig, Stop, Units } from "@/lib/types";
import { useLiveUnits } from "@/hooks/useLiveUnits";
import { ShowroomMontadoProvider } from "@/components/transition/TransitionProvider";
import { ZoomLayer } from "@/components/transition/ZoomLayer";
import { UnitDetailHost } from "@/components/residencia/UnitDetailHost";
import { FlybyViewer } from "./FlybyViewer";

interface ShowroomClientProps {
  stops: Stop[];
  /** Unidades HORNEADAS en el build (Airtable al momento del deploy). Es el punto
   *  de partida y el fallback si el proxy no responde. */
  units: Units;
  segments: FlybySegment[];
  site: SiteConfig;
  branding?: ReactNode;
}

/**
 * Costura cliente del showroom. Existe por dos razones que trajo el export estático:
 *
 * 1. DATA EN VIVO. Antes la página era ISR: el server leía Airtable y el contorno de
 *    cada unidad salía pintado con su estado real. En un export el HTML se hornea en
 *    build, así que ese estado quedaría congelado hasta el próximo deploy. Acá se
 *    refresca desde el proxy (`useLiveUnits`) arrancando de las unidades horneadas:
 *    el primer frame ya muestra un estado plausible (sin parpadeo) y a los pocos ms
 *    se repinta con el dato real. Si el proxy está caído, queda lo horneado.
 *
 * 2. LA FICHA COMO OVERLAY. La ruta interceptada `@modal` no existe con
 *    `output: "export"`, así que la ficha la monta `UnitDetailHost` mirando la URL.
 *    Tiene que ser HERMANO de <ZoomLayer>, no hijo: el overlay es `fixed`, y un
 *    `fixed` dentro de un ancestro con `transform` (el zoom) se posiciona contra ese
 *    ancestro en vez de contra el viewport.
 *
 * El mismo `units` alimenta al visor y a la ficha → los dos ven exactamente el mismo
 * estado, y saltar de unidad dentro de la ficha no re-pide nada.
 */
export function ShowroomClient({ stops, units: horneadas, segments, site, branding }: ShowroomClientProps) {
  const units = useLiveUnits(horneadas);

  return (
    // Declara que el showroom está montado debajo → todo lo que abra una ficha
    // (polígono, buscador, plan maestro, plano de la planta) lo hace como overlay
    // en vez de navegar. Ver `useAbrirFicha`.
    <ShowroomMontadoProvider>
      <ZoomLayer>
        <FlybyViewer stops={stops} units={units} segments={segments} branding={branding} />
      </ZoomLayer>
      <UnitDetailHost units={units} stops={stops} site={site} />
    </ShowroomMontadoProvider>
  );
}
