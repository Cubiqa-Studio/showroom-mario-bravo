"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PARAM_VISTA,
  RUTA_RESIDENCIA,
  abrirFichaSobreShowroom,
  unitIdDeRuta,
} from "@/lib/residencia";

/** Punto (en px de viewport) hacia el que hace zoom el home al abrir un detalle. */
export type Origin = { x: number; y: number } | null;

interface TransitionCtx {
  /** Origen del zoom — lo setea el click sobre la unidad antes de navegar. */
  origin: Origin;
  setOrigin: (o: Origin) => void;
  /**
   * El detalle está abriéndose/abierto. Se setea SINCRÓNICO en el click para que
   * el zoom arranque YA, sin esperar a que la ruta interceptada renderice/cargue.
   * El cierre (back/botón) lo apaga <ZoomLayer> al ver que el pathname dejó /residencia.
   */
  opening: boolean;
  setOpening: (v: boolean) => void;
  /** Atajo del click: fija el origen y arranca el zoom de inmediato. */
  beginOpen: (o: Origin) => void;
}

const Ctx = createContext<TransitionCtx | null>(null);

/**
 * Provee el ORIGEN y el ESTADO de apertura del zoom cinematográfico, compartido
 * entre el home (que hace el zoom-in/out vía <ZoomLayer>) y el click sobre una
 * unidad (que lo dispara). El zoom-IN lo gobierna `opening` (instantáneo en el
 * click); el zoom-OUT lo gobierna el ROUTER (cuando la ruta deja de ser
 * /residencia/*), así el back del navegador sigue funcionando nativo.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<Origin>(null);
  const [opening, setOpening] = useState(false);
  const beginOpen = useCallback((o: Origin) => {
    setOrigin(o);
    setOpening(true);
  }, []);
  return (
    <Ctx.Provider value={{ origin, setOrigin, opening, setOpening, beginOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTransitionOrigin(): TransitionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useTransitionOrigin debe usarse dentro de <TransitionProvider>");
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿Está el SHOWROOM montado debajo?
//
// Es la única pregunta que decide CÓMO se abre una ficha, y por eso vive acá y no
// desperdigada en cada disparador:
//   · Showroom montado (estás en /showroom) → la ficha se abre como OVERLAY encima,
//     reescribiendo la URL sin navegar (ver `abrirFichaSobreShowroom`). El visor no
//     se desmonta: al cerrar volvés a la misma cámara. Esto reemplaza a la ruta
//     interceptada @modal, que `output: "export"` no soporta.
//   · Sin showroom montado (ficha standalone, abierta por link directo o Google) →
//     navegación de verdad con el router, como siempre.
//
// El provider lo pone SÓLO la página del showroom (ver ShowroomClient). En cualquier
// otro lado el contexto vale `false` por default, así que un componente compartido
// entre las dos superficies —el buscador, el plan maestro, el plano de la planta—
// hace lo correcto en cada una sin saber dónde está montado.
// ─────────────────────────────────────────────────────────────────────────────

const ShowroomMontadoCtx = createContext(false);

export function ShowroomMontadoProvider({ children }: { children: ReactNode }) {
  return <ShowroomMontadoCtx.Provider value>{children}</ShowroomMontadoCtx.Provider>;
}

export function useShowroomMontado(): boolean {
  return useContext(ShowroomMontadoCtx);
}

export interface AbrirFichaOpts {
  /** Stop del showroom desde el que se entró (query `?vista=`). */
  vista?: number;
}

/**
 * Abre la ficha de una unidad de la forma correcta para la superficie actual.
 *
 * PUSH vs REPLACE se decide acá y no en cada disparador, mirando si YA hay una ficha
 * abierta:
 *   · Desde el exterior (showroom o portada) → PUSH. Es la entrada al detalle, y el
 *     back tiene que devolver al showroom.
 *   · Desde otra ficha (carrusel de "otras residencias", plano de la planta, plan
 *     maestro, buscador) → REPLACE. Saltar de unidad es LATERAL: reemplazando, el
 *     historial queda `showroom → /residencia/<actual>` y un solo back vuelve al
 *     exterior, en vez de tener que desandar una entrada por unidad visitada.
 *
 * Antes esa decisión estaba repartida (FloorPlate replace, MasterplanModal push,
 * buscador push) y cada componente tenía que saber desde dónde lo habían montado.
 */
export function useAbrirFicha(): (unitId: string, opts?: AbrirFichaOpts) => void {
  const router = useRouter();
  const pathname = usePathname();
  const showroomMontado = useShowroomMontado();
  const yaEnFicha = !!unitIdDeRuta(pathname);

  return useCallback(
    (unitId: string, opts: AbrirFichaOpts = {}) => {
      if (showroomMontado) {
        abrirFichaSobreShowroom(unitId, { vista: opts.vista, reemplazar: yaEnFicha });
        return;
      }
      const query = opts.vista != null ? `?${PARAM_VISTA}=${opts.vista}` : "";
      const href = `${RUTA_RESIDENCIA}${unitId}${query}`;
      if (yaEnFicha) router.replace(href);
      else router.push(href);
    },
    [router, showroomMontado, yaEnFicha],
  );
}
