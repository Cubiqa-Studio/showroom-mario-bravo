"use client";

import { useEffect, useState } from "react";

/**
 * `true` en dispositivos táctiles (punteros gruesos: celulares, tablets). Es la
 * señal que decide el comportamiento "mobile" del showroom: el arrastre PANEA la
 * vista actual (en vez de saltar de stop), y entrar a una unidad pide DOS toques.
 *
 * SSR-safe: arranca en `false` (el server no tiene `matchMedia`) y se sincroniza
 * en el efecto, en cliente. Escucha cambios (ej.: conectar un mouse a una tablet).
 */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setTouch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return touch;
}
