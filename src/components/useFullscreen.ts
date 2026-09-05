"use client";

import { useCallback, useEffect, useState } from "react";
import {
  alternarFullscreen,
  elementoEnFullscreen,
  EVENTOS_FULLSCREEN,
  fullscreenDisponible,
} from "@/lib/fullscreen";

/**
 * Estado de pantalla completa para la UI. Devuelve `disponible` además de `activo`:
 * quien dibuje el botón tiene que ESCONDERLO si no está disponible, porque en iOS la
 * API no existe y el botón no puede hacer nada (ver `@/lib/fullscreen`).
 *
 * `disponible` arranca en `false` y se resuelve después de montar, a propósito: estas
 * páginas se prerenderizan (export estático), así que el primer render del cliente
 * tiene que dar igual que el HTML servido. Preguntarle al `document` durante el render
 * rompería la hidratación. El costo es que el botón aparece un instante después de
 * cargar, en los equipos donde sí anda.
 */
export function useFullscreen() {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    setDisponible(fullscreenDisponible());
    const sync = () => setActivo(Boolean(elementoEnFullscreen()));
    sync();
    for (const ev of EVENTOS_FULLSCREEN) document.addEventListener(ev, sync);
    return () => {
      for (const ev of EVENTOS_FULLSCREEN) document.removeEventListener(ev, sync);
    };
  }, []);

  const alternar = useCallback(() => alternarFullscreen(), []);
  return { disponible, activo, alternar };
}
