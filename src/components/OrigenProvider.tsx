"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { whatsappUrl } from "@/lib/contact";
import {
  COMERCIALIZADORES,
  ORIGEN_DEFECTO,
  guardarOrigen,
  leerOrigenDeUrl,
  leerOrigenGuardado,
  type Comercializador,
  type Origen,
} from "@/lib/origen";

/**
 * Quién trajo la visita: la desarrolladora o la inmobiliaria (ver src/lib/origen.ts
 * para el porqué y los links de cada uno).
 *
 * Se resuelve UNA sola vez, apenas carga la página, y de ahí lo toman el formulario
 * de contacto (a qué bandeja va el lead) y todos los botones de WhatsApp (a qué
 * teléfono). Va en el layout raíz —no en la pantalla de contacto— porque el
 * parámetro viene en la URL de ENTRADA y la navegación interna se lo lleva puesto:
 * si esperáramos a que abran "Contacto", `location.search` ya no lo tendría.
 *
 * Se resuelve en un efecto y no durante el render para no romper la hidratación (el
 * servidor no ve ni la URL del cliente ni su localStorage). El efecto es de LAYOUT, no
 * el común: React aplica el cambio de estado antes de que el navegador pinte, así que
 * la portada no llega a mostrar los tres proyectos y después sacar uno.
 */

/** `useLayoutEffect` avisa por consola si se ejecuta en el servidor; en SSR no hay
 *  nada que medir, así que ahí cae al efecto común. Patrón de siempre. */
const useEfectoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Valor {
  origen: Origen;
  comercializador: Comercializador;
}

const Ctx = createContext<Valor>({
  origen: ORIGEN_DEFECTO,
  comercializador: COMERCIALIZADORES[ORIGEN_DEFECTO],
});

export function OrigenProvider({ children }: { children: React.ReactNode }) {
  const [origen, setOrigen] = useState<Origen>(ORIGEN_DEFECTO);

  useEfectoDeLayout(() => {
    // El parámetro de la URL SIEMPRE pisa lo guardado: si alguien entra por el link
    // de la otra parte, la visita es de esa parte (última campaña, gana).
    const deUrl = leerOrigenDeUrl(window.location.search);
    if (deUrl) {
      guardarOrigen(deUrl);
      setOrigen(deUrl);
      return;
    }
    const guardado = leerOrigenGuardado();
    if (guardado) setOrigen(guardado);
  }, []);

  const valor = useMemo<Valor>(
    () => ({ origen, comercializador: COMERCIALIZADORES[origen] }),
    [origen],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useOrigen(): Valor {
  return useContext(Ctx);
}

/**
 * Arma links de WhatsApp al teléfono del comercializador que trajo la visita.
 * Se usa en lugar de `whatsappUrl` a secas en todo lo que sea un CTA de la UI.
 */
export function useWhatsappUrl(): (message?: string) => string {
  const { comercializador } = useOrigen();
  return useMemo(
    () => (message?: string) => whatsappUrl(message, comercializador.whatsapp),
    [comercializador.whatsapp],
  );
}
