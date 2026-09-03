"use client";

// Reusa el CSS scopeado `.res-landing` + la "hoja" `.sheet-*` (mismo chasis que
// ProjectModal): este modal se abre desde el SHOWROOM y desde la landing de unidad.
import "./residencia.css";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useOrigen } from "@/components/OrigenProvider";
import { ORDEN_PORTFOLIO, PROYECTOS, posterMid } from "@/data/proyectos";
import type { TeamPartner } from "@/lib/types";
import { CloseIcon } from "../gallery/icons";
import { lockBodyScroll } from "@/lib/scroll-lock";

/* eslint-disable @next/next/no-img-element */

/**
 * "El Equipo" — modal propio del menú general. Dos bloques, según el mockup que pasó
 * el cliente (31-08):
 *
 *  1. **Quiénes están detrás** — las dos empresas del proyecto (la desarrolladora y el
 *     estudio de arquitectura), cada una con su logo, su rol y qué hizo.
 *  2. **Los desarrollos de TIER** — el portfolio de la marca. Sale de `PROYECTOS`, la
 *     MISMA fuente que la portada: así el día que lleguen los renders y las direcciones
 *     de Avenue y Sinclair, aparecen en los dos lados sin tocar componentes.
 *
 * El mockup traía un "Ver el sitio" debajo de cada empresa; el cliente lo tachó, así
 * que no está. Y donde falta material no se inventa: un proyecto sin render se dibuja
 * tipográfico (igual que en la portada) y sin dirección dice "Próximamente".
 */
export function TeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  // Mismo criterio que la portada: no se le muestra a la inmobiliaria un desarrollo
  // que no comercializa (Juani, 31-08). Sin parámetro en la URL, se ven los tres.
  const { origen } = useOrigen();
  const obras = PROYECTOS.filter((p) => p.comercializan.includes(origen)).sort(
    (a, b) => ORDEN_PORTFOLIO.indexOf(a.id) - ORDEN_PORTFOLIO.indexOf(b.id),
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="res-landing sheet">
              <header className="sheet-head">
                <div>
                  <p className="sheet-eyebrow">{t.team.eyebrow}</p>
                  <h2 className="sheet-title">{t.team.title}</h2>
                </div>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label={t.team.close}
                  onClick={onClose}
                >
                  <CloseIcon width={22} height={22} />
                </button>
              </header>

              <div className="sheet-body">
                <div className="team-wrap">
                  <section className="team-bloque">
                    <h3 className="team-h">{t.team.behindTitle}</h3>
                    <p className="team-intro">{t.team.behindIntro}</p>
                    <div className="team-socios">
                      {t.team.partners.map((p) => (
                        <TarjetaSocio key={p.name} socio={p} />
                      ))}
                    </div>
                  </section>

                  <section className="team-bloque">
                    <header className="team-bloque-head">
                      <h3 className="team-h team-h--fila">{t.team.worksTitle}</h3>
                      <p className="team-nota">{t.team.worksNote}</p>
                    </header>
                    <div className="team-obras">
                      {obras.map((o) => (
                        <article className="team-obra" key={o.id}>
                          <div className="team-obra-media">
                            {posterMid(o) ? (
                              // La variante `-mid` (720px, ~146 KB) y no la grande
                              // (~305 KB): la tarjeta se ve a ~360px de ancho, así que
                              // la grande sería tirar la mitad del peso a la basura.
                              // Para Bravo esto además usa su fachada propia en vez
                              // del still de la portada, y así los tres del portfolio
                              // se ven parejos.
                              <img
                                src={posterMid(o)!}
                                alt=""
                                aria-hidden
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              // Sin render todavía: panel tipográfico, no una foto
                              // prestada de otro proyecto (mismo criterio que la portada).
                              <span className="team-obra-sinmedia" aria-hidden>
                                TIER
                              </span>
                            )}
                            {/* El proyecto de ESTE showroom, marcado. Es el único que
                                hoy lleva a algún lado (`href`). */}
                            {o.href ? (
                              <span className="team-obra-chip">{t.team.thisShowroom}</span>
                            ) : null}
                          </div>
                          <div className="team-obra-pie">
                            <p className="team-role">TIER</p>
                            <h4 className="team-obra-nombre">{o.nombre}</h4>
                            <p className="team-obra-dato">{o.ubicacion ?? t.team.soon}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}

/** Una empresa: rol arriba, logo (o el nombre en texto si no hay archivo), filete,
 *  nombre y qué hizo. */
function TarjetaSocio({ socio }: { socio: TeamPartner }) {
  return (
    <article className="team-card">
      <p className="team-role">{socio.role}</p>
      {/* Con logo, el nombre va debajo del filete. SIN logo, el nombre ocupa el
          lugar del logo y no se repite abajo (si no queda dos veces seguidas). */}
      <div className="team-marca">
        {socio.logo ? (
          <img className="team-logo" src={socio.logo} alt={socio.name} />
        ) : (
          <span className="team-marca-texto">{socio.name}</span>
        )}
      </div>
      <span className="team-filete" aria-hidden />
      {socio.logo ? <h4 className="team-name">{socio.name}</h4> : null}
      <p className={`team-desc${socio.logo ? "" : " team-desc--solo"}`}>{socio.desc}</p>
    </article>
  );
}
