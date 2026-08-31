"use client";

import "./residencia.css";
import { useI18n } from "@/i18n/LanguageProvider";

export function ZoomHero({
  valor,
  min,
  max,
  paso,
  listo,
  onCambio,
  onArrastre,
  className = "",
}: {
  valor: number;
  min: number;
  max: number;
  paso: number;
  listo: boolean;
  onCambio: (v: number) => void;
  onArrastre?: (arrastrando: boolean) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const acotar = (v: number) => Math.min(max, Math.max(min, v));
  const enTope = valor >= max - 1e-6;
  const enPiso = valor <= min + 1e-6;

  return (
    <div className={`zh ${className}`.trim()} role="group" aria-label={t.vr.zoom}>
      <button
        type="button"
        className="zh-btn"
        disabled={!listo || enTope}
        onClick={() => onCambio(acotar(valor + paso))}
        aria-label={t.vr.zoomIn}
        title={t.vr.zoomIn}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5M11 8v6M8 11h6" strokeLinecap="round" />
        </svg>
      </button>

      <span className="zh-caja">
        <input
          type="range"
          className="zh-barra"
          min={min}
          max={max}
          step="any"
          value={valor}
          disabled={!listo}
          aria-label={t.vr.zoom}
          onChange={(e) => onCambio(acotar(Number(e.target.value)))}
          onPointerDown={() => onArrastre?.(true)}
          onPointerUp={() => onArrastre?.(false)}
          onPointerCancel={() => onArrastre?.(false)}
          onBlur={() => onArrastre?.(false)}
        />
      </span>

      <button
        type="button"
        className="zh-btn"
        disabled={!listo || enPiso}
        onClick={() => onCambio(acotar(valor - paso))}
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
