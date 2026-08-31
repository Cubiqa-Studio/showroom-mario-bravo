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
// Sirve en cualquier ruta (`/`, `/showroom`, `/residencia/402`) y el `OrigenProvider` lo
// deja escrito en la URL en cada cambio de ruta, así que viaja solo y lo que se copie de
// la barra ya lo lleva.
//
// Dentro de la MISMA pestaña el origen se sostiene aunque la URL lo pierda (alguien
// borra el parámetro a mano, o una carga completa cae en un link sin él). Se usa
// `sessionStorage` y no `localStorage` a propósito: el `localStorage` quedaba pegajoso
// —el que había abierto una vez el link de la inmobiliaria seguía viendo esa versión
// días después, entrando por un link pelado— y un link sin parámetro tiene que dar
// siempre la desarrolladora en una visita nueva.
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

/** Dónde se sostiene el origen dentro de la pestaña. */
const CLAVE_SESION = "tb:origen";

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

/** Sostiene el origen dentro de la pestaña. Silencioso si el navegador no deja
 *  escribir (incógnito estricto): se pierde el recuerdo, no la visita. */
export function guardarEnSesion(origen: Origen): void {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, origen);
  } catch {
    /* sin storage: el origen vale mientras no se recargue */
  }
}

/** Origen de esta pestaña, si hay. */
export function leerDeSesion(): Origen | null {
  try {
    return normalizarOrigen(window.sessionStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
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

