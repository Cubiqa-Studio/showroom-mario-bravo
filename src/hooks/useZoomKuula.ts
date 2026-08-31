"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface EventoKuula {
  frame: number;
  element?: HTMLIFrameElement;
  data?: { zoom?: number };
}

interface PlayerAPI {
  addEventListener: (evento: string, cb: (e: EventoKuula) => void) => void;
  removeEventListener: (evento: string, cb: (e: EventoKuula) => void) => void;
  setZoom: (frame: number, valor: number) => void;
}

declare global {
  interface Window {
    KuulaPlayerAPI?: PlayerAPI;
  }
}

export const ZOOM_MIN = -1;
export const ZOOM_MAX = 1;
export const ZOOM_PASO = 0.15;

export function useZoomKuula(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  activo: boolean,
  src: string,
) {
  const [frameId, setFrameId] = useState<number | null>(null);
  const [valor, setValor] = useState(0);
  const nuestro = useRef<number | null>(null);

  useEffect(() => {
    nuestro.current = null;
    setFrameId(null);
    setValor(0);
  }, [src]);

  useEffect(() => {
    const api = typeof window === "undefined" ? undefined : window.KuulaPlayerAPI;
    if (!activo || !api) return;

    const onCargado = (e: EventoKuula) => {
      if (e.element && e.element !== iframeRef.current) return;
      nuestro.current = e.frame;
      setFrameId(e.frame);
    };
    const onOrientacion = (e: EventoKuula) => {
      if (e.frame !== nuestro.current || typeof e.data?.zoom !== "number") return;
      const v = -e.data.zoom;
      setValor((previo) => (Math.abs(previo - v) > 0.005 ? v : previo));
    };

    api.addEventListener("frameloaded", onCargado);
    api.addEventListener("orientation", onOrientacion);
    return () => {
      api.removeEventListener("frameloaded", onCargado);
      api.removeEventListener("orientation", onOrientacion);
    };
  }, [activo, iframeRef, src]);

  const aplicar = useCallback((v: number) => {
    const api = window.KuulaPlayerAPI;
    if (!api || nuestro.current == null) return;
    const acotado = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
    setValor(acotado);
    api.setZoom(nuestro.current, -acotado);
  }, []);

  return { listo: frameId !== null, valor, aplicar };
}
