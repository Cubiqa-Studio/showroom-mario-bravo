"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { whatsappUrl } from "@/lib/contact";
import {
  COMERCIALIZADORES,
  ORIGEN_DEFECTO,
  PARAM_ORIGEN,
  guardarEnSesion,
  leerDeSesion,
  leerOrigenDeUrl,
  type Comercializador,
  type Origen,
} from "@/lib/origen";

/**
 * Quién trajo la visita: la desarrolladora o la inmobiliaria (ver src/lib/origen.ts
 * para el porqué y los links de cada uno).
 *
 * De acá lo toman el formulario de contacto (a qué bandeja va el lead) y todos los
 * botones de WhatsApp (a qué teléfono). Va en el layout raíz —no en la pantalla de
 * contacto— porque el parámetro viene en la URL de ENTRADA y la navegación interna se
 * lo lleva puesto: si esperáramos a que abran "Contacto", `location.search` ya no lo
 * tendría.
 *
 * Se resuelve en un efecto y no durante el render para no romper la hidratación (el
 * servidor no ve ni la URL del cliente ni su localStorage). El efecto es de LAYOUT, no
 * el común: React aplica el cambio de estado antes de que el navegador pinte, así que
 * la portada no llega a mostrar los tres proyectos y después sacar uno.
 *
 * Además **deja el parámetro escrito en la URL**, siempre y en todas las rutas: si
 * entrás a "/" pelado, la barra pasa a decir "/?v=desarrolladora". Se hace en cada
 * cambio de ruta con `history.replaceState` —sin navegar, sin entrada nueva en el
 * historial— en vez de agregarle el parámetro a mano a cada `<Link>` y a cada
 * `router.push`: así lo agarra TODA la navegación, incluidos el back/forward y los
 * links que se agreguen mañana. Se conserva `history.state` porque ahí guarda el
 * router de Next lo suyo.
 *
 * ⚠ El `<link rel="canonical">` lo emite el servidor SIN parámetro (ver src/lib/seo.ts),
 * así que esto no le abre a Google una URL duplicada por comercializador.
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
  // Sostiene el origen entre rutas: la navegación interna llega sin el parámetro (el
  // href del link no lo lleva) y recién después se lo escribimos a la URL. La sesión
  // cubre el otro caso: una carga COMPLETA con la URL pelada dentro de la misma pestaña
  // (alguien borra el parámetro a mano, o un link interno que se resuelve en el server).
  const ultimo = useRef<Origen>(ORIGEN_DEFECTO);
  const pathname = usePathname();

  useEfectoDeLayout(() => {
    const deUrl = leerOrigenDeUrl(window.location.search);
    const actual = deUrl ?? leerDeSesion() ?? ultimo.current;
    ultimo.current = actual;
    guardarEnSesion(actual);
    setOrigen(actual);

    const url = new URL(window.location.href);
    if (url.searchParams.get(PARAM_ORIGEN) !== actual) {
      url.searchParams.set(PARAM_ORIGEN, actual);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [pathname]);

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
