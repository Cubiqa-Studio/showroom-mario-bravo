// Skeleton de /showroom: aparece AL INSTANTE al tocar "Descubrir" (boundary de
// Suspense de la ruta) mientras termina el render/precarga, en vez de dejar el
// spinner del botón trabado 6-7s en mobile. Fondo oscuro = el mismo del visor, así
// el pasaje a la vista real (que arranca con su propia precarga de la 1ª vista) es
// continuo, sin salto de color. Server component: sólo CSS, sin JS de cliente.
export default function Loading() {
  return (
    <div className="grid h-[100dvh] w-full place-items-center bg-tier-dark">
      <svg
        className="h-8 w-8 animate-spin text-white/70"
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
