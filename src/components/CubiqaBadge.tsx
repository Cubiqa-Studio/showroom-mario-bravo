/* eslint-disable @next/next/no-img-element */

/**
 * Crédito de estudio: isotipo de CUBIQA fijo abajo a la derecha, en TODAS las
 * pantallas (montado en el layout raíz). Linkea al sitio del estudio. z-40 →
 * por encima del contenido base, por debajo de los modales (z-140+), así no
 * tapa sus controles.
 */
export function CubiqaBadge() {
  return (
    <a
      href="https://www.cubiqastudio.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Sitio de CUBIQA Studio"
      title="Por CUBIQA Studio"
      className="fixed bottom-3 right-3 z-40 grid h-9 w-9 place-items-center rounded-full bg-white/80 shadow-md ring-1 ring-black/10 backdrop-blur transition hover:bg-white hover:shadow-lg"
    >
      <img src="/isotipo_cubiqa.png" alt="CUBIQA Studio" className="h-5 w-auto" />
    </a>
  );
}
