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
  /** Imagen de fondo. `null` = panel tipográfico (ver `.pp--sin-media` en portada.css). */
  poster: string | null;
  /**
   * Video que corre al pasar el mouse, sólo en escritorio con puntero fino. En
   * celular y tablet nunca se baja: son tres videos y el visitante no tiene hover.
   */
  video: string | null;
}

export const PROYECTOS: Proyecto[] = [
  {
    id: "sinclair",
    nombre: "Sinclair",
    ubicacion: null,
    href: null,
    poster: null,
    video: null,
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
    poster: "/intro-poster.jpg",
    video: null,
  },
  {
    id: "avenue",
    nombre: "Avenue",
    ubicacion: null,
    href: null,
    poster: null,
    video: null,
  },
];
