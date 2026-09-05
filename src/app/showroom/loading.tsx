import { getFirstStopImage } from "@/lib/data";

// Skeleton de /showroom: aparece AL INSTANTE al tocar "Descubrir" (boundary de
// Suspense de la ruta) mientras termina el render/precarga, en vez de dejar el
// spinner del botón trabado 6-7s en mobile. Server component: sólo CSS, sin JS.
//
// Muestra el still de la PRIMERA VISTA y no un fondo negro: el visor vive detrás de
// este boundary, así que hasta que React inyecta el contenido diferido lo único pintado
// era el negro. Este <img> está en el HTML inicial y comparte URL con el preload del
// <head>. Cuando el visor monta dibuja el mismo render en el mismo encuadre, así que el
// reemplazo no se ve ni mueve nada.
export default function Loading() {
  const still = getFirstStopImage();
  return (
    <div className="relative grid h-[100dvh] w-full place-items-center overflow-hidden bg-tier-dark">
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={still}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
          draggable={false}
        />
      ) : null}
      <svg
        className="relative h-8 w-8 animate-spin text-white/70 drop-shadow-lg"
        viewBox="0 0 24 24"
        fill="none"
        role="status"
        aria-label="Cargando"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" className="opacity-25" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="opacity-90"
        />
      </svg>
    </div>
  );
}
