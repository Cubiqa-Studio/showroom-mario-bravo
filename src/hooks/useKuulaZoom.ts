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
 * comando y vuelve solo a 0 en el acto (medido: pedirle 0,6 deja 5,99e-15). Tampoco
 * sirve `cmd:"orientation"` (el que Kuula usa para sincronizar players): con `zoom=0`
 * tampoco mueve el zoom. Ver `kuulaEmbedUrl` en `src/lib/kuula.ts`.
 */

/** Rango del zoom, tal cual lo reporta y lo acepta el player. */
export const ZOOM_MIN = -1;
export const ZOOM_MAX = 1;
/** Cuánto mueve un toque en "+" / "−". Diez pasos de punta a punta. */
export const ZOOM_PASO = 0.2;

/** Diferencia a partir de la cual se considera que el zoom se movió de verdad. */
const TOLERANCIA = 0.01;
/** Ventana en la que el player está yendo hacia lo que le pedimos: no se lo policía. */
const GRACIA_MS = 900;
/** Quietud necesaria para dar por terminada la animación de entrada del tour. */
const ASENTADO_MS = 900;

export type KuulaZoom = ReturnType<typeof useKuulaZoom>;

export function useKuulaZoom(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  habilitado: boolean,
  /**
   * Candado: el zoom lo maneja SÓLO la barrita. Si el player se mueve por su cuenta
   * —la rueda del mouse, que Kuula se queda sí o sí cuando el embed lleva `zoom=1`—
   * se lo devuelve al valor de la barra y se avisa subiendo `intrusos`.
   *
   * Se usa en escritorio, donde la rueda tiene que seguir siendo de la PÁGINA
   * (`EscudoRueda` se re-arma justo con ese aviso). En táctil va sin candado: ahí no
   * hay rueda, el pinch es bienvenido y la barra tiene que reflejarlo.
   */
  { candado = false }: { candado?: boolean } = {},
) {
  const uuid = useRef<number | null>(null);
  const [listo, setListo] = useState(false);
  const [zoom, setZoom] = useState(0);
  // Sube de a uno cada vez que se atajó un zoom que no pidió la barra.
  const [intrusos, setIntrusos] = useState(0);
  // Mientras el dedo está en la barrita ignoramos el eco del player: `orientation`
  // llega ~20 veces por segundo y, si lo escribiéramos siempre, pelearía contra el
  // arrastre y la barrita temblaría.
  const arrastrando = useRef(false);
  // Lo último que la barra le pidió al player.
  const esperado = useRef(0);
  const graciaHasta = useRef(0);
  // El candado no arranca hasta que el tour termina su animación de entrada (el zoom
  // viene de -0,875 a 0): si no, la atajaríamos como si fuera la rueda.
  const candadoArmado = useRef(false);
  const ultimo = useRef<number | null>(null);
  const quietoDesde = useRef(0);

  const postear = useCallback(
    (v: number) => {
      const ventana = iframeRef.current?.contentWindow;
      if (!ventana || uuid.current == null) return;
      ventana.postMessage({ kuula: true, uuid: uuid.current, cmd: "zoom", value: v }, "*");
    },
    [iframeRef],
  );

  useEffect(() => {
    if (!habilitado) return;
    setListo(false);
    uuid.current = null;
    candadoArmado.current = false;
    ultimo.current = null;

    const onMensaje = (ev: MessageEvent) => {
      const d = ev.data as { kuula?: boolean; cmd?: string; uuid?: number; data?: { zoom?: number } };
      if (!d || d.kuula !== true) return;
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (d.cmd === "frameloaded" && typeof d.uuid === "number") {
        uuid.current = d.uuid;
        setListo(true);
        return;
      }
      if (d.cmd !== "orientation" || typeof d.data?.zoom !== "number") return;
      const z = d.data.zoom;

      if (!candado) {
        // Sin candado la barra SIGUE al player (pinch en táctil, rueda en el modal).
        // Sólo si se movió de verdad: el evento llega igual aunque nadie toque nada.
        if (!arrastrando.current) setZoom((previo) => (Math.abs(previo - z) > 0.005 ? z : previo));
        return;
      }

      const ahora = performance.now();

      // Fase 1: esperar a que el tour se asiente para saber cuál es su zoom de reposo.
      if (!candadoArmado.current) {
        if (ultimo.current === null || Math.abs(z - ultimo.current) > 0.002) quietoDesde.current = ahora;
        ultimo.current = z;
        if (ahora - quietoDesde.current > ASENTADO_MS) {
          esperado.current = z;
          setZoom(z);
          candadoArmado.current = true;
        }
        return;
      }

      // Fase 2: si el zoom se corrió sin que lo pidiéramos, devolverlo y avisar.
      if (arrastrando.current || ahora < graciaHasta.current) return;
      if (Math.abs(z - esperado.current) > TOLERANCIA) {
        graciaHasta.current = ahora + GRACIA_MS;
        postear(esperado.current);
        setIntrusos((n) => n + 1);
      }
    };

    window.addEventListener("message", onMensaje);
    return () => window.removeEventListener("message", onMensaje);
  }, [habilitado, iframeRef, candado, postear]);

  const aplicar = useCallback(
    (valor: number) => {
      if (uuid.current == null) return;
      const v = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor));
      esperado.current = v;
      graciaHasta.current = performance.now() + GRACIA_MS;
      candadoArmado.current = true;
      setZoom(v);
      postear(v);
    },
    [postear],
  );

  const marcarArrastre = useCallback((v: boolean) => {
    arrastrando.current = v;
    // Al soltar, dar aire para que el player termine de llegar antes de policiarlo.
    if (!v) graciaHasta.current = performance.now() + GRACIA_MS;
  }, []);

  return { listo, zoom, aplicar, marcarArrastre, intrusos };
}
