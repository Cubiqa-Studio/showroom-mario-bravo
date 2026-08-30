"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { SITE } from "@/data/site";
import type { GalleryImage } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";
import { lockBodyScroll } from "@/lib/scroll-lock";

/* eslint-disable @next/next/no-img-element */

// site.ts es client-safe (sólo importa tipos) → leemos la galería del proyecto
// directo, sin prop-drilling (igual que MasterplanModal con units.json). Es el
// default; el hero de cada landing le pasa SU propia galería por prop.
const SITE_IMAGES: GalleryImage[] = SITE.gallery ?? [];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Galería lightbox a pantalla completa: imagen grande (object-contain), flechas
 * ‹ ›, contador, y tira de miniaturas abajo con la activa resaltada en dorado.
 * Teclado: Esc cierra, ← → navegan.
 *
 * Reutilizable: por defecto muestra la galería del PROYECTO (menú lateral, en el
 * exterior y la landing). El hero de la landing la abre con SUS imágenes (`images`)
 * y arranca en la que clickeaste (`initialIndex`).
 */
export function GalleryModal({
  open,
  onClose,
  images = SITE_IMAGES,
  initialIndex = 0,
}: {
  open: boolean;
  onClose: () => void;
  /** Imágenes a mostrar (full + thumb). Default: la galería del proyecto. */
  images?: GalleryImage[];
  /** Índice inicial al abrir (ej. la foto clickeada en el hero). Default 0. */
  initialIndex?: number;
}) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const n = images.length;
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  const go = (d: number) => setI((p) => (p + d + n) % n);

  // Reset a la imagen pedida al abrir + navegación por teclado + lock del scroll.
  useEffect(() => {
    if (!open) return;
    setI(n ? Math.max(0, Math.min(initialIndex, n - 1)) : 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((p) => (p + 1) % n);
      else if (e.key === "ArrowLeft") setI((p) => (p - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose, n, initialIndex]);

  // Centrá la miniatura activa al cambiar de imagen.
  useEffect(() => {
    const strip = thumbsRef.current;
    const active = strip?.querySelector<HTMLElement>(`[data-idx="${i}"]`);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [i]);

  // Precargá el full de la siguiente y la anterior: el visor sólo monta la imagen
  // actual (AnimatePresence mode="wait"), así que sin esto cada flecha dispararía
  // una descarga en frío. La tira ya carga sólo thumbs (~6-9 KB c/u, lazy), de modo
  // que abrir la galería pesa ~1 full + thumbs en vez de los 9 renders completos.
  useEffect(() => {
    if (!open || n < 2) return;
    for (const idx of [(i + 1) % n, (i - 1 + n) % n]) {
      const img = new window.Image();
      img.src = images[idx].full;
    }
  }, [open, i, n, images]);

  if (!n) return null;

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[160] flex flex-col"
            // Mismo lenguaje translúcido que el Masterplan: deja ver el render/
            // landing de atrás difuminado, sobre el negro de marca.
            style={{
              background: "var(--glass)",
              backdropFilter: "blur(14px) saturate(115%)",
              WebkitBackdropFilter: "blur(14px) saturate(115%)",
            }}
            initial={{ opacity: 0 }}
            // pointerEvents off al cerrar (bug 216 breathe): el overlay full-screen que se
            // desvanece no debe capturar el puntero. "auto" en animate lo restaura.
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Barra superior: contador + cerrar */}
            <header className="flex items-center justify-between px-5 py-4 sm:px-8">
              <span className="font-mono text-xs tracking-[0.24em] tabular-nums">
                <span className="text-gold">{pad(i + 1)}</span>
                <span className="text-muted"> / {pad(n)}</span>
              </span>
              <button
                type="button"
                aria-label={t.galleryModal.close}
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-tier-dark/80 text-muted transition hover:border-gold hover:text-gold"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </header>

            {/* Escenario: flechas + imagen grande */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
              <NavArrow dir="left" label={t.galleryModal.prev} onClick={() => go(-1)} />

              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={i}
                  src={images[i].full}
                  alt={t.galleryModal.alt(i + 1)}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                  decoding="async"
                  fetchPriority="high"
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  draggable={false}
                />
              </AnimatePresence>

              <NavArrow dir="right" label={t.galleryModal.next} onClick={() => go(1)} />
            </div>

            {/* Miniaturas — centradas: contenedor scrolleable + tira `w-max`
                con `mx-auto`. Si no llenan el ancho → centradas; si sobran →
                scrollean sin recortar los extremos (a diferencia de justify-center). */}
            <div ref={thumbsRef} className="overflow-x-auto px-5 py-5 sm:px-8">
              <div className="mx-auto flex w-max items-center gap-2.5">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    data-idx={idx}
                    type="button"
                    onClick={() => setI(idx)}
                    aria-label={t.galleryModal.alt(idx + 1)}
                    aria-current={idx === i}
                    className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md transition ${
                      idx === i
                        ? "ring-2 ring-gold ring-offset-2 ring-offset-white"
                        : "opacity-60 ring-1 ring-line hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}

function NavArrow({
  dir,
  label,
  onClick,
}: {
  dir: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-tier-dark/80 text-ink shadow-lg ring-1 ring-line backdrop-blur transition hover:bg-tier-dark ${
        dir === "left" ? "left-3 sm:left-6" : "right-3 sm:right-6"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={22} height={22}>
        {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}
