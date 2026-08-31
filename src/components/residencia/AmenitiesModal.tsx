"use client";

// Reusa el CSS scopeado `.res-landing .spec-*` (specs) y la "hoja" `.sheet-*`. Se
// activa SÓLO desde el sidebar del showroom (no desde la bolita 360° del exterior,
// que abre el Vr360Modal pelado).
import "./residencia.css";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { AMENITIES_360 } from "@/lib/vr-hotspots";
import { AMENITIES_GALLERY } from "@/lib/amenities-gallery";
import { kuulaEmbedUrl } from "@/lib/kuula";
import { useZoomKuula, ZOOM_MAX, ZOOM_MIN, ZOOM_PASO } from "@/hooks/useZoomKuula";
import { ZoomHero } from "./ZoomHero";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";
import { CloseIcon } from "../gallery/icons";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { GalleryModal } from "./GalleryModal";

/* eslint-disable @next/next/no-img-element */

type Pestana = "360" | "galeria";

/**
 * "Amenities" — recorrido 360° de Kuula de los amenities ARRIBA + el detalle de
 * amenities ABAJO, con scroll interno en la hoja. El iframe ocupa una altura fija para
 * que el texto quede visible/alcanzable debajo (incluso en mobile).
 *
 * El texto sale de `t.amenitiesSheet`, NO del panel de Amenities de "El Proyecto":
 * el cliente entregó dos versiones distintas (26-08), una narrativa para esta hoja y
 * otra más corta para el acordeón del proyecto.
 */
export function AmenitiesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const sheet = t.amenitiesSheet;
  const isTouch = useIsTouch();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const kuula = useZoomKuula(iframeRef, open, AMENITIES_360 ?? "");
  // Pestañas de la hoja. Sólo se muestran si HAY las dos cosas: sin tour queda la
  // galería sola, sin renders queda el tour solo — y en los dos casos sin barra.
  const hayTour = Boolean(AMENITIES_360);
  const hayGaleria = AMENITIES_GALLERY.length > 0;
  const [pestana, setPestana] = useState<Pestana>(hayTour ? "360" : "galeria");
  // Índice de la foto abierta en el lightbox; `null` = cerrado.
  const [foto, setFoto] = useState<number | null>(null);

  // Al cerrar la hoja, volver a la pestaña inicial y soltar el lightbox: si no,
  // reabrirla te deja donde estabas y el visor grande queda colgado detrás.
  useEffect(() => {
    if (open) return;
    setFoto(null);
    setPestana(hayTour ? "360" : "galeria");
  }, [open, hayTour]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Con el lightbox abierto, Escape cierra PRIMERO la foto (el visor tiene su
      // propio listener). Sin esto, un Escape cerraba las dos cosas de una.
      if (e.key === "Escape" && foto === null) onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose, foto]);

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="sheet-overlay"
            initial={{ opacity: 0 }}
            // pointerEvents off al cerrar (bug 216 breathe): el overlay que se desvanece
            // no debe capturar el puntero. "auto" en animate lo restaura al reabrir.
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="res-landing sheet">
              <header className="sheet-head">
                <div>
                  <p className="sheet-eyebrow">{t.vr.tour}</p>
                  <h2 className="sheet-title">{t.sideMenu.amenities}</h2>
                </div>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label={t.project.close}
                  onClick={onClose}
                >
                  <CloseIcon width={22} height={22} />
                </button>
              </header>

              <div className="sheet-body">
                {/* Barra de pestañas: el recorrido 360° y los renders. Sólo aparece si
                    hay las DOS cosas — con una sola no hay nada que elegir. */}
                {hayTour && hayGaleria && (
                  <div className="am-tabs" role="tablist" aria-label={t.sideMenu.amenities}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={pestana === "360"}
                      className={`am-tab${pestana === "360" ? " active" : ""}`}
                      onClick={() => setPestana("360")}
                    >
                      {t.vr.tour}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={pestana === "galeria"}
                      className={`am-tab${pestana === "galeria" ? " active" : ""}`}
                      onClick={() => setPestana("galeria")}
                    >
                      {t.sideMenu.gallery}
                    </button>
                  </div>
                )}

                {/* El 360 de amenities sólo si existe (ver src/lib/vr-hotspots.ts): un
                    iframe sin src queda en blanco. El iframe NO se desmonta al cambiar
                    de pestaña —se esconde— porque volver a montarlo recarga el tour
                    entero de Kuula y en táctil obliga a pasar otra vez por su pantalla
                    de título. */}
                {hayTour && (
                  <div className="sheet-amenities-360" hidden={pestana !== "360"}>
                    {/* Sin giroscopio/acelerómetro: inclinar el celular no mueve el 360°
                        (sólo se mira arrastrando). Se conserva `fullscreen`. En táctil,
                        `withKuulaTouchGate` fuerza la pantalla de título (anti-lag iOS). */}
                    <iframe
                      ref={iframeRef}
                      src={kuulaEmbedUrl(AMENITIES_360!, isTouch, { zoom: true })}
                      title={t.vr.virtualTour}
                      allow="fullscreen"
                      allowFullScreen
                    />
                    <ZoomHero
                      valor={kuula.valor}
                      min={ZOOM_MIN}
                      max={ZOOM_MAX}
                      paso={ZOOM_PASO}
                      listo={kuula.listo}
                      onCambio={kuula.aplicar}
                    />
                  </div>
                )}

                {/* Galería: mosaico de renders; al tocar uno abre el mismo visor
                    grande que la galería del proyecto (con flechas, contador y
                    miniaturas), ya acotado a los amenities. */}
                {hayGaleria && pestana === "galeria" && (
                  <div className="am-galeria">
                    {AMENITIES_GALLERY.map((img, i) => (
                      <button
                        key={img.full}
                        type="button"
                        className="am-foto"
                        onClick={() => setFoto(i)}
                        aria-label={t.galleryModal.alt(i + 1)}
                      >
                        <img
                          src={img.thumb}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {sheet && (
                  <div className="sheet-amenities-specs">
                    {/* `.spec-panel active` para heredar el estilo scopeado de listas. */}
                    <div className="spec-panel active">
                      <p className="am-lead">{sheet.body}</p>
                      {sheet.lists?.length ? (
                        <div className="amenities-lists">
                          {sheet.lists.map((list, i) => (
                            <div className="spec-list" key={list.heading ?? i}>
                              {list.heading ? <h4>{list.heading}</h4> : null}
                              <ul>
                                {list.items.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visor grande, con las MISMAS imágenes de la pestaña. Va a z-160, por encima
          de la hoja (z-150), así que se abre sobre ella sin cerrarla. */}
      <GalleryModal
        open={foto !== null}
        onClose={() => setFoto(null)}
        images={AMENITIES_GALLERY}
        initialIndex={foto ?? 0}
      />
    </FloatingPortal>
  );
}
