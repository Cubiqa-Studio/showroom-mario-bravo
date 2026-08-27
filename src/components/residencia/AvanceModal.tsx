"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import type { AvanceObra } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";

/** Fecha ISO de Airtable ("2026-06-30…") → "30/06/2026" (es) / "06/30/2026" (en).
 *  Trabaja con el string (sin Date) para no correrse por zona horaria. */
function fmtDate(d: string | undefined, locale: string): string | undefined {
  if (!d) return undefined;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  const [, y, mo, da] = m;
  return locale.startsWith("en") ? `${mo}/${da}/${y}` : `${da}/${mo}/${y}`;
}

/**
 * Modal de "Avance de obra": un % general (barra de progreso), el hito/etapa en
 * curso, la entrega estimada, la última actualización y una nota opcional. El dato
 * llega en vivo desde Airtable (tabla "Avance de Obra"); si no hay dato, muestra
 * un estado vacío amable.
 */
export function AvanceModal({
  open,
  onClose,
  avance,
}: {
  open: boolean;
  onClose: () => void;
  avance: AvanceObra | null;
}) {
  const { t } = useI18n();

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Clamp del porcentaje a 0–100 (por si Airtable trae algo raro).
  const pct = avance ? Math.max(0, Math.min(100, Math.round(avance.percent))) : 0;
  const deliveryFmt = avance ? fmtDate(avance.delivery, t.numberLocale) : undefined;
  const dateFmt = avance ? fmtDate(avance.date, t.numberLocale) : undefined;

  return (
    <FloatingPortal>
      {/* SIEMPRE montado, pero con `pointer-events: none` cuando está cerrado. Así, al
          cerrar (mientras se desvanece), el modal NO captura el puntero y el hover de
          las unidades del exterior vuelve a andar de una — en particular la 216 que
          "respira" por default. Con AnimatePresence el backdrop seguía capturando
          durante el exit y se comía el pointerenter → el tooltip no aparecía hasta
          hoverear otra unidad. */}
      <div
        className="fixed inset-0 z-[150] grid place-items-center p-4"
        style={{ pointerEvents: open ? "auto" : "none" }}
        aria-hidden={!open}
      >
        <motion.button
          type="button"
          aria-label={t.avance.close}
          onClick={onClose}
          tabIndex={open ? 0 : -1}
          className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
          initial={false}
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        />

        <motion.div
          role="dialog"
          aria-label={t.avance.title}
          initial={false}
          animate={open ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          // max-h + scroll interno: en mobile ACOSTADO (viewport bajito) el contenido
          // no entra y antes se cortaba arriba/abajo; ahora la tarjeta se limita al alto
          // disponible y scrollea adentro.
          className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-paper shadow-2xl ring-1 ring-line"
        >
          <div className="px-7 pb-7 pt-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-gold">
                  {t.avance.eyebrow}
                </p>
                <h2 className="mt-1 font-serif text-2xl tracking-wide text-ink">
                  {t.avance.title}
                </h2>

                {avance ? (
                  <>
                    <div className="mt-6 flex items-end justify-between">
                      <span className="text-sm font-medium text-muted">
                        {t.avance.progress}
                      </span>
                      <span className="font-serif text-4xl leading-none text-ink tabular-nums">
                        {pct}
                        <span className="text-2xl text-gold">%</span>
                      </span>
                    </div>

                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-line">
                      <motion.div
                        className="h-full rounded-full bg-gold"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                      />
                    </div>

                    <div className="mt-5 space-y-1.5 text-sm">
                      {avance.milestone && (
                        <p className="text-muted">
                          {t.avance.milestone}:{" "}
                          <span className="font-medium text-ink">{avance.milestone}</span>
                        </p>
                      )}
                      {deliveryFmt && (
                        <p className="text-muted">
                          {t.avance.delivery}:{" "}
                          <span className="font-medium text-ink">{deliveryFmt}</span>
                        </p>
                      )}
                      {dateFmt && (
                        <p className="text-muted">
                          {t.avance.lastUpdate}:{" "}
                          <span className="font-medium text-ink">{dateFmt}</span>
                        </p>
                      )}
                    </div>

                    {avance.note && (
                      <p className="mt-3 text-sm leading-relaxed text-muted">{avance.note}</p>
                    )}
                  </>
                ) : (
                  <p className="mt-6 text-sm leading-relaxed text-muted">{t.avance.empty}</p>
                )}

                <div className="mt-7 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-tier-dark transition hover:opacity-90 active:scale-95"
                  >
                    {t.avance.close}
                  </button>
                </div>
          </div>
        </motion.div>
      </div>
    </FloatingPortal>
  );
}
