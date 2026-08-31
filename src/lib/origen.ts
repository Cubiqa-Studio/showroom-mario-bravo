// ─────────────────────────────────────────────────────────────────────────────
// QUIÉN TRAJO LA VISITA — un showroom, dos comercializadores.
//
// El proyecto lo venden dos: la DESARROLLADORA y la INMOBILIARIA. Las dos querían
// su formulario, y dos formularios en la misma pantalla es un problema de
// usabilidad (¿a cuál le escribo?) que además no resuelve el de fondo: un
// interesado que llegó por la publicidad de una puede terminar escribiéndole a la
// otra.
//
// La solución (idea de Joaquim, 31-08): **el formulario es uno solo, y el
// destinatario lo decide el LINK por el que entró la persona.** Cada uno publicita
// el suyo:
//
//   https://…/            → desarrolladora (default)
//   https://…/?v=inmobiliaria
//   https://…/?v=desarrolladora        (explícito, por si lo quieren simétrico)
//
// Sirve en cualquier ruta (`/`, `/showroom`, `/residencia/402`) y se guarda apenas
// entra, así que el parámetro puede desaparecer de la URL —navegación interna,
// links compartidos— sin perder de vista de dónde vino la visita.
//
// Es ATRIBUCIÓN, no seguridad: el parámetro está a la vista y cualquiera puede
// cambiarlo. Alcanza y sobra para lo que hace falta (que cada campaña alimente su
// propia bandeja); no lo uses para nada que necesite ser infalsificable.
// ─────────────────────────────────────────────────────────────────────────────

import { WHATSAPP_NUMBER, WHATSAPP_NUMBER_INMOBILIARIA } from "./contact";

export type Origen = "desarrolladora" | "inmobiliaria";

/** Sin parámetro (link pelado, tráfico orgánico, buscadores) manda la desarrolladora. */
export const ORIGEN_DEFECTO: Origen = "desarrolladora";

/** Parámetro corto de los links de campaña: `?v=inmobiliaria`. */
export const PARAM_ORIGEN = "v";

/** Dónde se guarda, y por cuánto. 30 días es la ventana de atribución habitual:
 *  el que entró por un aviso y vuelve a la semana sigue contando para el mismo. */
const CLAVE = "tb:origen";
const VENTANA_MS = 30 * 24 * 60 * 60 * 1000;

export interface Comercializador {
  /** Cómo se nombra en el mail del lead y en el asunto. */
  nombre: string;
  /** WhatsApp destino: internacional, sólo dígitos. Vacío = sin número cargado. */
  whatsapp: string;
}

/**
 * ⚠ PLACEHOLDER — falta el nombre y el WhatsApp de la inmobiliaria (y el de ventas
 * de la desarrolladora sigue vacío desde el principio, ver `contact.ts`). Con el
 * string vacío el botón de WhatsApp abre el selector de contactos en vez de un chat.
 * A propósito NO cae al número de la otra: es preferible que se vea que falta un
 * número a mandarle callado el lead de una al teléfono de la otra.
 */
export const COMERCIALIZADORES: Record<Origen, Comercializador> = {
  desarrolladora: { nombre: "TIER Desarrollos", whatsapp: WHATSAPP_NUMBER },
  inmobiliaria: { nombre: "Inmobiliaria", whatsapp: WHATSAPP_NUMBER_INMOBILIARIA },
};

/** Alias aceptados, para que un link tipeado a mano por un tercero no se pierda
 *  callado. Se compara en minúsculas y sin acentos. */
const ALIAS: Record<string, Origen> = {
  desarrolladora: "desarrolladora",
  desarrollador: "desarrolladora",
  desarrollo: "desarrolladora",
  tier: "desarrolladora",
  dev: "desarrolladora",
  inmobiliaria: "inmobiliaria",
  inmo: "inmobiliaria",
  comercializacion: "inmobiliaria",
  comercializadora: "inmobiliaria",
};

function pelar(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Devuelve el origen si el valor es uno conocido; `null` si no. */
export function normalizarOrigen(valor: string | null | undefined): Origen | null {
  if (!valor) return null;
  return ALIAS[pelar(valor)] ?? null;
}

/**
 * Lee el origen de un query string. Además de `?v=`, acepta `?utm_source=` y
 * `?ref=`: los gestores de campañas agregan `utm_source` solos, y así el mismo
 * aviso queda atribuido aunque se les escape el `v`.
 */
export function leerOrigenDeUrl(search: string): Origen | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  for (const clave of [PARAM_ORIGEN, "utm_source", "ref"]) {
    const encontrado = normalizarOrigen(params.get(clave));
    if (encontrado) return encontrado;
  }
  return null;
}

/** Guarda el origen con su fecha. Silencioso si el navegador no deja escribir
 *  (modo incógnito estricto, cookies bloqueadas): se pierde la persistencia, no
 *  la visita. */
export function guardarOrigen(origen: Origen): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ origen, ts: Date.now() }));
  } catch {
    /* sin storage: el origen vale sólo para esta página */
  }
}

/** Origen guardado, si no venció. */
export function leerOrigenGuardado(): Origen | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const { origen, ts } = JSON.parse(crudo) as { origen?: string; ts?: number };
    if (typeof ts !== "number" || Date.now() - ts > VENTANA_MS) return null;
    return normalizarOrigen(origen);
  } catch {
    return null;
  }
}
