/**
 * Los desarrollos de la marca, para la PORTADA (la raíz "/").
 *
 * Pedido de Camila (30-08): la portada deja de ser el video de un solo proyecto y
 * pasa a mostrar los TRES, divididos en la pantalla. "Sin el video hasta que te pase
 * los renders y videos que van a ir" — o sea que hoy es la estructura y los nombres,
 * y el material entra después SIN tocar componentes: se agrega acá y aparece solo.
 *
 * ⚠ LA MARCA ES "TIER", NO "TERRA". En el WhatsApp del 30-08 Camila escribió
 * "TERRA SINCLAIR / TERRA BRAVO / TERRA AVENIUE", pero el logotipo entregado, el
 * dominio, el SEO y todo el sitio dicen TIER (y "AVENIUE" es claramente un tipeo de
 * "AVENUE"). Se usa TIER porque es lo que dice el archivo del logo que va arriba de
 * los tres nombres; si el paraguas de CCM realmente cambió de nombre, hay que
 * cambiarlo en TODO el sitio, no sólo acá — está pendiente de confirmación.
 *
 * QUÉ FALTA (Camila lo va a mandar en la semana):
 *   · el video de portada de cada proyecto que tenga showroom  → `video`
 *   · un render de portada para Sinclair y Avenue              → `poster`
 *   · la galería de renders de Sinclair                        → `href`
 *   · las direcciones de Sinclair y Avenue                     → `ubicacion`
 * Mientras tanto, un panel sin `poster` NO muestra una imagen prestada de otro
 * proyecto: se dibuja tipográfico. Y uno sin `href` no es clickeable y dice
 * "Próximamente", que es la verdad.
 */
import type { Origen } from "@/lib/origen";

export interface Proyecto {
  /** Slug interno (clave de React y de los data-attributes). */
  id: string;
  /**
   * La palabra PROPIA del proyecto. "TIER" no se repite acá: va como antetítulo en
   * cada panel y como logotipo arriba de los tres, que es lo que lo vuelve un sistema
   * de marca y no tres carteles sueltos.
   */
  nombre: string;
  /** Dirección o barrio. `null` mientras no la sepamos: no se inventa. */
  ubicacion: string | null;
  /** A dónde lleva el click. `null` = el panel todavía no es clickeable. */
  href: string | null;
  /**
   * Fachada del proyecto. `null` = panel tipográfico (ver `.pp--sin-media` en
   * portada.css). Es la variante GRANDE; al lado viven `-mid` y `-thumb` con el
   * mismo nombre, que las genera `npm run proyectos:optimize` desde
   * `_media-src/proyectos/<id>.jpg`. Ver `posterMid` y `posterThumb` más abajo.
   */
  poster: string | null;
  /**
   * Dónde cae en el mapa de Ubicación de la ficha. `null` en el desarrollo que ES
   * este sitio (Bravo): ese va como PIN PRINCIPAL y sus coordenadas salen de
   * `SITE.location`, con otro dibujo (punto dorado + anillo pulsante). Acá van sólo
   * los hermanos, que el mapa marca como puntos secundarios.
   *
   * Vivir en ESTE archivo y no en `site.ts` es lo que hace que el mapa respete el
   * origen sin duplicar nada: el filtro por `comercializan` sale gratis, igual que
   * en la portada y en "El Equipo".
   */
  coords: { lat: number; lng: number } | null;
  /**
   * `true` en el desarrollo que ES este sitio. El mapa lo dibuja distinto —punto
   * dorado con anillo pulsante, el "estás acá"— pero con la MISMA tarjeta que sus
   * hermanos, así los tres se leen parejos (pedido de Joaquim, 03-09: "te falta la
   * de tier bravo, la del medio").
   */
  esEsteSitio?: boolean;
  /**
   * Video que corre al pasar el mouse, sólo en escritorio con puntero fino. En
   * celular y tablet nunca se baja: son tres videos y el visitante no tiene hover.
   */
  video: string | null;
  /**
   * Quiénes venden ESTE desarrollo. La portada muestra sólo los que comercializa el
   * dueño del link por el que entró la visita (ver src/lib/origen.ts): la inmobiliaria
   * no tiene por qué exhibir un proyecto que no vende.
   *
   * Camila, 31-08: "solo bravo y avenue va a comercializar esta inmobiliaria".
   */
  comercializan: Origen[];
}

export const PROYECTOS: Proyecto[] = [
  // ⚠ LAS DIRECCIONES Y COORDENADAS DE ESTOS DOS SIGUEN SIN CONFIRMAR. Venían del
  // bloque `pois` de site.ts (que ahora vive acá) y su nota original decía:
  //   Geocodificadas contra OpenStreetMap con match A NIVEL DE ALTURA (no de calle)
  //   y código postal de CABA:
  //     Sinclair 3087             → Palermo Pacífico, C1425GMN
  //     Av. Estado de Israel 4338 → Almagro, C1430BXU
  //   Que "Avenue" sea el de Estado de Israel es DEDUCCIÓN POR DESCARTE (TIER tiene
  //   tres desarrollos, Bravo es éste y Sinclair coincide con su calle). Confirmarlo.
  // Ahora pesa más que antes: la dirección ya no se ve sólo en el mapa, también en la
  // portada y en "El Equipo". Hay que preguntarle a Camila.
  {
    id: "sinclair",
    nombre: "Sinclair",
    ubicacion: "Sinclair 3087 · Palermo",
    href: null,
    poster: "/proyectos/sinclair.webp",
    coords: { lat: -34.574206, lng: -58.422938 },
    video: null,
    comercializan: ["desarrolladora"],
  },
  {
    // El único que hoy tiene showroom: es ESTE sitio.
    id: "bravo",
    nombre: "Bravo",
    ubicacion: "Mario Bravo 955 · Palermo",
    href: "/showroom",
    // El mismo still que usaba la vieja portada de un solo proyecto (fachada al
    // atardecer). Cuando llegue el video de portada, se suma en `video` y este poster
    // pasa a ser su primer frame.
    //
    // Camila mandó también una fachada de Bravo el 03-09 y está procesada en
    // `/proyectos/bravo.webp`, pero acá NO se usa: Joaquim pidió dejar la portada
    // como está ("la de bravo ya la tenemos"). La variante `-thumb` sí se usa en el
    // popup del mapa, para que los tres hermanos se vean parejos ahí.
    poster: "/intro-poster.jpg",
    // `null` A PROPÓSITO: dónde cae en el mapa lo manda `SITE.location` (es la
    // dirección del edificio, dato del sitio, y ya estaba ahí). Poner una copia acá
    // sería un segundo lugar donde equivocarse. Su TARJETA sí se arma desde este
    // archivo, igual que la de los hermanos — ver `proyectoDeEsteSitio`.
    coords: null,
    esEsteSitio: true,
    video: null,
    comercializan: ["desarrolladora", "inmobiliaria"],
  },
  {
    id: "avenue",
    ubicacion: "Av. Estado de Israel 4338 · Almagro",
    nombre: "Avenue",
    href: null,
    poster: "/proyectos/avenue.webp",
    coords: { lat: -34.598167, lng: -58.427095 },
    video: null,
    comercializan: ["desarrolladora", "inmobiliaria"],
  },
];

/**
 * Las variantes chicas de la fachada, derivadas del nombre de la grande. Las emite
 * `npm run proyectos:optimize` con el mismo slug, así no hay tres campos que se
 * puedan desincronizar.
 *
 * `null` si el proyecto todavía no tiene fachada, o si su poster NO salió de ese
 * script — es el caso de Bravo, que usa `/intro-poster.jpg`: ahí se cae a la
 * fachada por id, que sí existe en `/proyectos/`.
 */
function variante(p: Proyecto, sufijo: "-mid" | "-thumb"): string | null {
  const base = p.poster?.startsWith("/proyectos/")
    ? p.poster.replace(/\.webp$/, "")
    : `/proyectos/${p.id}`;
  return p.poster ? `${base}${sufijo}.webp` : null;
}

/** Fachada para una tarjeta mediana (el portfolio de "El Equipo"). */
export function posterMid(p: Proyecto): string | null {
  return variante(p, "-mid");
}

/** Fachada en miniatura (el popup del mapa de Ubicación). */
export function posterThumb(p: Proyecto): string | null {
  return variante(p, "-thumb");
}

/**
 * El paraguas de marca que llevan los tres delante. Vive acá —al lado de los
 * proyectos— porque estaba escrito a mano en dos lugares (el antetítulo de la
 * portada y los nombres de los puntos del mapa), y ya hubo una confusión de nombre
 * con esta marca (ver la nota de TIER/TERRA arriba): cuantas menos copias, mejor.
 *
 * OJO que NO es `SITE.brandName`: eso vale "TIER Bravo" (la marca de ESTE edificio),
 * y usarlo acá producía "TIER Bravo Sinclair".
 */
export const MARCA = "TIER";

/** Cómo se nombra el desarrollo entero: "TIER Sinclair". */
export function nombreCompleto(p: Proyecto): string {
  return `${MARCA} ${p.nombre}`;
}

/** Un proyecto del que YA sabemos dónde cae en el mapa. */
export type ProyectoUbicado = Proyecto & { coords: NonNullable<Proyecto["coords"]> };

/**
 * Los OTROS desarrollos que el mapa de Ubicación marca: los que tienen coordenadas
 * —o sea, todos menos el de ESTE sitio, que va como pin principal desde
 * `SITE.location`— y que comercializa quien trajo la visita.
 *
 * Ese último filtro es el punto: antes el mapa leía una lista aparte en `site.ts` sin
 * noción de origen, y con `?v=inmobiliaria` seguía mostrando el cartel de un
 * desarrollo que esa inmobiliaria NO vende (y encima pegado en pantalla, porque el
 * popup del mapa está siempre abierto por pedido del cliente). Ahora sale de la MISMA
 * lista que la portada y "El Equipo", así que los tres lugares no se pueden
 * desincronizar.
 */
export function proyectosEnMapa(origen: Origen): ProyectoUbicado[] {
  return PROYECTOS.filter(
    (p): p is ProyectoUbicado => p.coords !== null && p.comercializan.includes(origen),
  );
}

/**
 * El desarrollo que ES este sitio, para armarle al pin principal del mapa la misma
 * tarjeta que a sus hermanos. Sus coordenadas NO salen de acá (ver `coords`).
 */
export function proyectoDeEsteSitio(): Proyecto | undefined {
  return PROYECTOS.find((p) => p.esEsteSitio);
}

/**
 * Orden del portfolio para "El Equipo" — el mismo con el que la marca se nombra a sí
 * misma ("Bravo, Avenue y Sinclair conforman su portfolio") y el del mockup del
 * cliente. La PORTADA usa otro orden a propósito: ahí Bravo va al medio.
 */
export const ORDEN_PORTFOLIO = ["bravo", "avenue", "sinclair"];
