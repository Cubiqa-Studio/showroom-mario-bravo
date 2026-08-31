import type { GalleryImage } from "./types";
import { SITE } from "@/data/site";

/**
 * Los renders de ESPACIOS COMUNES, en orden de exhibición. Es el subconjunto de la
 * galería del proyecto que se muestra en la pestaña "Galería" de la hoja de
 * Amenities (pedido de Joaquim, 31-08).
 *
 * ⚠ EL FILTRO ES POR NOMBRE DE ARCHIVO, y eso es a propósito: en este proyecto el
 * nombre del render ES su orden y su contenido (ver el README, "La galería y el hero
 * de cada unidad"). No hay campo de categoría en `gallery.json` —el manifiesto sólo
 * trae rutas y tamaños— y agregarlo obligaría a re-correr `gallery:optimize` cada vez
 * que se re-clasifica una foto.
 *
 * Quedan AFUERA, a propósito: `01-fachada` y `02-esquina` (son el edificio desde la
 * calle, no un amenity) y `12`, `13`, `14` (interiores de un departamento).
 *
 * Si se renombra un original en `_media-src/gallery/`, esto deja de matchear EN
 * SILENCIO y la pestaña queda corta. El chequeo está abajo, en `AMENITIES_GALLERY`.
 */
const SLUGS_AMENITIES = [
  "03-contrafrente-pileta",
  "04-jardin",
  "05-pileta",
  "06-solarium-juegos",
  "07-parrilla-terraza",
  "08-gimnasio",
  "09-lobby",
  "10-coworking-lounge",
  "11-sum-vista-pileta",
] as const;

const slugDe = (img: GalleryImage): string =>
  img.full.split("/").pop()?.replace(/\.webp$/, "") ?? "";

/** Los renders de amenities, en el orden de `SLUGS_AMENITIES`. */
export const AMENITIES_GALLERY: GalleryImage[] = SLUGS_AMENITIES.map((slug) =>
  (SITE.gallery ?? []).find((img) => slugDe(img) === slug)
).filter((img): img is GalleryImage => Boolean(img));

// Aviso en desarrollo si un slug dejó de existir (renombre en `_media-src`). No se
// tira el build: la pestaña simplemente muestra las que sí están.
if (process.env.NODE_ENV !== "production" && AMENITIES_GALLERY.length !== SLUGS_AMENITIES.length) {
  const faltan = SLUGS_AMENITIES.filter(
    (slug) => !(SITE.gallery ?? []).some((img) => slugDe(img) === slug)
  );
  console.warn(
    `[amenities-gallery] No encontré estos renders en gallery.json: ${faltan.join(", ")}. ` +
      `¿Se renombró un original en _media-src/gallery/?`
  );
}
