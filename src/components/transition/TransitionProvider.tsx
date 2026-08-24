"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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
