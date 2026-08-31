"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Control del zoom de un tour de Kuula embebido, por `postMessage`.
 *
 * Kuula expone una "Player API" (https://kuula.co/help/getting-started-api) que se
 * usa cargando su `static.kuula.io/api.js`. Acá NO se carga ese script y se habla el
 * protocolo directo, por dos razones concretas:
 *
 *  1. El script de Kuula busca el iframe con
 *     `document.querySelector('iframe[src="…"]')`, o sea POR SU URL. En este sitio
 *     puede haber dos embeds con la MISMA url (el hero de una unidad y el modal del
 *     menú), y ahí le mandaría los comandos al equivocado. Comparar
 *     `event.source === iframe.contentWindow` no tiene ese problema.
 *  2. Son 2,8 KB de un tercero en una página que ya está medida al gramo.
 *
 * El protocolo (leído del propio api.js): el player postea al padre
 * `{ kuula: true, cmd, uuid, data }` y acepta de vuelta
 * `{ kuula: true, uuid, cmd: "zoom", value }`.
 *
 * ⚠ **Sólo funciona si el embed lleva `zoom=1`.** Con `zoom=0` el player acepta el
 * comando y vuelve solo a 0 en el acto (medido: pedirle 0,6 deja 5,99e-15). Ver
 * `kuulaEmbedUrl` en `src/lib/kuula.ts` para dónde se habilita y por qué no en todos
 * lados.
 */

/** Rango del zoom, tal cual lo reporta y lo acepta el player. */
export const ZOOM_MIN = -1;
export const ZOOM_MAX = 1;
/** Cuánto mueve un toque en "+" / "−". Diez pasos de punta a punta. */
export const ZOOM_PASO = 0.2;

export function useKuulaZoom(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  habilitado: boolean,
) {
  const uuid = useRef<number | null>(null);
  const [listo, setListo] = useState(false);
  const [zoom, setZoom] = useState(0);
  // Mientras el dedo está en la barrita ignoramos el eco del player: `orientation`
  // llega ~10 veces por segundo y, si lo escribiéramos siempre, pelearía contra el
  // arrastre y la barrita temblaría.
  const arrastrando = useRef(false);

  useEffect(() => {
    if (!habilitado) return;
    setListo(false);
    uuid.current = null;
    const onMensaje = (ev: MessageEvent) => {
      const d = ev.data as { kuula?: boolean; cmd?: string; uuid?: number; data?: { zoom?: number } };
      if (!d || d.kuula !== true) return;
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (d.cmd === "frameloaded" && typeof d.uuid === "number") {
        uuid.current = d.uuid;
        setListo(true);
        return;
      }
      if (d.cmd === "orientation" && !arrastrando.current && typeof d.data?.zoom === "number") {
        // Sólo si se movió de verdad: el evento llega igual aunque nadie toque nada.
        setZoom((previo) => (Math.abs(previo - d.data!.zoom!) > 0.005 ? d.data!.zoom! : previo));
      }
    };
    window.addEventListener("message", onMensaje);
    return () => window.removeEventListener("message", onMensaje);
  }, [habilitado, iframeRef]);

  const aplicar = useCallback(
    (valor: number) => {
      const ventana = iframeRef.current?.contentWindow;
      if (!ventana || uuid.current == null) return;
      const v = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor));
      setZoom(v);
      ventana.postMessage({ kuula: true, uuid: uuid.current, cmd: "zoom", value: v }, "*");
    },
    [iframeRef],
  );

  const marcarArrastre = useCallback((v: boolean) => {
    arrastrando.current = v;
  }, []);

  return { listo, zoom, aplicar, marcarArrastre };
}
