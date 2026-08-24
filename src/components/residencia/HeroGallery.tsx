"use client";

import { useMemo, useState } from "react";
import type { Unit } from "@/lib/types";
import { unitGallery } from "@/lib/residencia";
import { useI18n } from "@/i18n/LanguageProvider";
import { Hero360 } from "./Hero360";
import { GalleryModal } from "./GalleryModal";
import { StatusPill } from "./StatusPill";

/* eslint-disable @next/next/no-img-element */

/**
 * Hero (sección 2 de la referencia): imagen principal full-bleed, badge de
 * estado, botón "Ver las N fotos" (N dinámico = tamaño de la galería) y 3 thumbs
 * superpuestos. Imágenes desde unitGallery(unit).
 *
 * "Ver las N fotos" — y un click en la imagen grande o en cualquier thumb — abren
 * el lightbox (mismo componente que la galería del menú lateral), arrancando en la
 * imagen que clickeaste.
 *
 * Excepción: si la unidad tiene `tour360` (ej. tipología E dúplex, 207/213), el
 * hero muestra el tour 360° de Kuula embebido (mismo tamaño) en vez de la galería.
 */
export function HeroGallery({ unit }: { unit: Unit }) {
  const { t } = useI18n();
  // Índice abierto en el lightbox (null = cerrado).
  const [lightbox, setLightbox] = useState<number | null>(null);

  // unitGallery devuelve una ref estable (gallery de la unidad o el const default),
  // así que el adaptador a GalleryImage se memoiza bien. Usamos el `full` también
  // como thumb: son las MISMAS imágenes que ya muestra el hero (cacheadas), y la
  // galería de una unidad es chica.
  const gallery = unitGallery(unit);
  const lightboxImages = useMemo(
    () => gallery.map((src) => ({ full: src, thumb: src })),
    [gallery],
  );

  if (unit.tour360) {
    return (
      <header className="hero">
        <div className="hero-stage">
          <div className="hero-main">
            <Hero360 src={unit.tour360} title={t.hero.tourTitle(unit.residence)} />
          </div>
          <div className="hero-badge">
            <StatusPill status={unit.status} />
          </div>
        </div>
      </header>
    );
  }

  const main = gallery[0];
  // 3 thumbs garantizados aunque la galería tenga 1-2 imágenes. Guardamos el índice
  // real de cada uno para abrir el lightbox en esa misma foto.
  const thumbs = Array.from({ length: 3 }, (_, i) => {
    const idx = gallery.length ? (i + 1) % gallery.length : 0;
    return { src: gallery[idx] ?? main, idx };
  });

  return (
    <>
      <header className="hero">
        <div className="hero-stage">
          <button
            type="button"
            className="hero-main"
            onClick={() => setLightbox(0)}
            aria-label={t.hero.seePhotos(gallery.length)}
          >
            <img src={main} alt={t.hero.photoAlt(unit.residence)} />
          </button>

          <div className="hero-badge">
            <StatusPill status={unit.status} />
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm see-all"
            onClick={() => setLightbox(0)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            {t.hero.seePhotos(gallery.length)}
          </button>

          <div className="hero-thumbs">
            {thumbs.map((th, i) => (
              <button
                type="button"
                className="hero-thumb"
                key={i}
                onClick={() => setLightbox(th.idx)}
                aria-label={t.hero.photoAltN(unit.residence, i + 2)}
              >
                <img src={th.src} alt={t.hero.photoAltN(unit.residence, i + 2)} />
              </button>
            ))}
          </div>
        </div>
      </header>

      <GalleryModal
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        images={lightboxImages}
        initialIndex={lightbox ?? 0}
      />
    </>
  );
}
