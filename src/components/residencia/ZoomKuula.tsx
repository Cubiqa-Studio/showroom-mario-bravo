"use client";

// El CSS del control (`.kz*`) vive en residencia.css. Se importa acá y no en cada
// consumidor porque el Vr360Modal vive en el árbol del showroom y no lo trae.
import "./residencia.css";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_PASO, type KuulaZoom } from "@/hooks/useKuulaZoom";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Barrita de zoom del 360°, al costado del tour (pedido del cliente vía Juani, 31-08:
 * "quiere hacerle zoom out y no se puede… agregar como si fuese una barrita").
 *
 * Es la lupa arriba, la barra vertical con el pulsador, y el "−" abajo. Los dos
 * botones son el camino para dedo grande y para teclado; la barra, para el que quiere
 * puntería. Se dibuja recién cuando el player hizo el handshake (`listo`), así nunca
 * queda un control muerto en pantalla.
 *
 * El estado lo maneja `useKuulaZoom`, que llama el componente de arriba: el mismo hook
 * lo comparte con el `EscudoRueda`, que necesita enterarse cuando alguien zoomeó con
 * la rueda para volver a taparle el paso.
 *
 * ⚠ La barra es un `<input type="range">` HORIZONTAL rotado 90°, no un range vertical.
 * `writing-mode: vertical-*` y `-webkit-appearance: slider-vertical` se comportan
 * distinto en cada motor (y el segundo está deprecado); rotar uno horizontal anda
 * igual en todos, incluido el WebKit de iPhone, y conserva el arrastre y las flechas
 * del teclado que da el navegador gratis.
 */
export function ZoomKuula({ kz, className = "" }: { kz: KuulaZoom; className?: string }) {
  const { t } = useI18n();
  const { listo, zoom, aplicar, marcarArrastre } = kz;

  if (!listo) return null;

  return (
    <div className={`kz ${className}`.trim()} role="group" aria-label={t.vr.zoom}>
      <button
        type="button"
        className="kz-btn"
        onClick={() => aplicar(zoom + ZOOM_PASO)}
        aria-label={t.vr.zoomIn}
        title={t.vr.zoomIn}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5M11 8v6M8 11h6" strokeLinecap="round" />
        </svg>
      </button>

      {/* La caja da el tamaño REAL (angosto y alto); el range va adentro, absoluto y
          rotado. Sin ella el range rotado seguiría ocupando su caja horizontal y la
          pastilla salía de 104px de ancho en vez de 44 (medido). */}
      <span className="kz-barra-caja">
        <input
          type="range"
          className="kz-barra"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.02}
          value={zoom}
          aria-label={t.vr.zoom}
          onChange={(e) => aplicar(Number(e.target.value))}
          onPointerDown={() => marcarArrastre(true)}
          onPointerUp={() => marcarArrastre(false)}
          onPointerCancel={() => marcarArrastre(false)}
          onBlur={() => marcarArrastre(false)}
        />
      </span>

      <button
        type="button"
        className="kz-btn"
        onClick={() => aplicar(zoom - ZOOM_PASO)}
        aria-label={t.vr.zoomOut}
        title={t.vr.zoomOut}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5M8 11h6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
