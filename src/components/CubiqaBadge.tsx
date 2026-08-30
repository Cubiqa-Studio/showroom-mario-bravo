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
      className="fixed bottom-3 right-3 z-40 grid h-9 w-9 place-items-center rounded-full bg-paper/80 shadow-md ring-1 ring-line backdrop-blur transition hover:bg-paper hover:shadow-lg"
    >
      {/* El arte del isotipo es NEGRO sobre transparente, y la pastilla es oscura
          (`--paper` = #16161A desde el rebranding): el cubo quedaba negro sobre negro
          y no se veía (reporte de Joaquim, 30-08). `brightness-0 invert` lo pasa a
          blanco puro sin necesidad de otro archivo —el PNG es tinta plana, sin medios
          tonos—, igual que el logotipo del 404. */}
      <img
        src="/isotipo_cubiqa.png"
        alt="CUBIQA Studio"
        className="h-5 w-auto brightness-0 invert"
      />
    </a>
  );
}
