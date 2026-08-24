"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";
import type { PaymentMilestone } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";

// Colores del recorrido — hex literales porque framer no interpola var() CSS.
const GOLD = "#B87D09"; // = var(--gold)
const GREEN = "#2F6B3A"; // verde semántico de "disponible" (= var(--green))
const GOLD_HALO = "0 0 0 5px rgba(184,125,9,.15), 0 2px 10px rgba(184,125,9,.45)";
const GREEN_HALO = "0 0 0 5px rgba(73,99,12,.15), 0 2px 10px rgba(73,99,12,.45)";

/**
 * "Reserva y Cronograma de Obra" (sección 6): hitos del plan de pagos (vertical,
 * línea dorada). Contenido desde el diccionario i18n (t.timeline); la nota de
 * entrega cierra la sección como línea propia.
 *
 * Scroll interactivo (pedido del cliente): la bolita baja por el riel siguiendo
 * el scroll (scroll-linked con framer-motion, sin GSAP), la línea se pinta detrás
 * de ella y cada nodo se enciende al alcanzarlo. Tras el último hito la bolita
 * sigue hasta "Tu asesor…" MUTANDO de dorado al verde del logo, y al llegar se
 * completa un check verde (dibujado con pathLength + pop con spring).
 */
export function TimelineSection({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const plan = t.timeline.plan;
  const listRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const footRef = useRef<HTMLDivElement | null>(null);

  // Geometría medida: el riel va del centro del primer nodo (24px del tope de
  // tl-items) al centro de la línea final "Tu asesor…". `stops` = posición de
  // CADA nodo dentro de ese recorrido (0..1) — el último es además donde
  // arranca el viraje a verde. Fallback pre-medición: bottom:24px vía CSS.
  const [geom, setGeom] = useState<{ rail: number; stops: number[] } | null>(null);
  useEffect(() => {
    const measure = () => {
      const items = listRef.current?.querySelectorAll<HTMLElement>(".tl-item");
      const foot = footRef.current;
      if (!items?.length || !foot) return;
      // foot.offsetTop es relativo a .timeline-v y tl-items arranca en su y=0,
      // así que ambos miden en el mismo espacio de coordenadas.
      const rail = foot.offsetTop + foot.offsetHeight / 2 - 24;
      const stops = Array.from(items, (it) => Math.min(it.offsetTop / rail, 0.999));
      setGeom({ rail, stops });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [plan.length]);
  const greenStart = geom?.stops[geom.stops.length - 1] ?? 0.66;

  // Progreso del scroll calculado A MANO (nada de useScroll): la landing scrollea
  // en window (standalone) o dentro del contenedor fixed del DetailOverlay
  // (overlay interceptado), y la resolución de offsets de framer contra un
  // container custom resultó frágil (en dev quedaba congelado, en prod medía
  // todo "ya recorrido"). En cambio getBoundingClientRect() es SIEMPRE relativo
  // al viewport — da igual quién scrollee — y el listener con capture:true
  // atrapa el scroll de cualquier contenedor (scroll no burbujea, capture sí
  // lo ve; mismo truco que el cierre del tooltip en FloorPlate).
  //
  // La bolita "persigue" una línea imaginaria al 62% del viewport mientras el
  // riel la cruza: 0 = primer nodo sobre esa línea, 1 = el check final. Como su
  // top es % DEL RIEL, coincide con cada nodo justo cuando cruza esa línea —
  // sin pinning: el contenido queda estático.
  // En el modal "El Proyecto" (embedded) el plan se muestra COMPLETO y estático:
  // no hay scroll-link (el modal casi no scrollea) → progreso fijo en 1.
  const scrollYProgress = useMotionValue(embedded ? 1 : 0);
  useEffect(() => {
    if (embedded) return; // sin scroll-link en el modal
    const update = () => {
      const rail = railRef.current;
      if (!rail) return;
      const r = rail.getBoundingClientRect();
      if (r.height <= 0) return;
      const refLine = window.innerHeight * 0.62;
      scrollYProgress.set(Math.min(1, Math.max(0, (refLine - r.top) / r.height)));
    };
    update();
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // `geom` re-dispara el update inicial cuando el riel ya tiene su altura real.
  }, [scrollYProgress, geom, embedded]);
  const ballTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const ballColor = useTransform(scrollYProgress, [0, greenStart, 1], [GOLD, GOLD, GREEN]);
  const ballHalo = useTransform(
    scrollYProgress,
    [0, greenStart, 1],
    [GOLD_HALO, GOLD_HALO, GREEN_HALO],
  );

  // Nodos y check beben del MISMO progreso que mueve la bolita: cada nodo se
  // enciende exactamente cuando la bolita pisa su centro (v ≥ su stop) y se
  // apaga al desandar; el check, al llegar al final.
  const [litCount, setLitCount] = useState(embedded ? plan.length : 0);
  const [done, setDone] = useState(embedded);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setLitCount(geom ? geom.stops.filter((s) => v >= s).length : 0);
    setDone(v >= 0.995);
  });

  if (!plan.length) return null;

  return (
    <div className="wrap">
      {/* En el modal "El Proyecto" el encabezado lo pone el propio modal ("Financiación"). */}
      {!embedded && (
        <div className="spec-head">
          <h2 className="section-title">{t.timeline.sectionTitle}</h2>
          <p className="muted center">{t.timeline.intro}</p>
        </div>
      )}

      <div className="timeline-v">
        <div className="tl-items" ref={listRef}>
          <div
            className="tl-rail"
            ref={railRef}
            style={geom ? { height: geom.rail } : undefined}
            aria-hidden
          >
            {/* La parte recorrida de la línea: alto animado por el scroll. El
                gradiente vive en un hijo de alto FIJO (el del riel completo)
                que el contenedor va revelando → no se estira al crecer. */}
            <motion.div className="tl-rail-fill" style={{ height: ballTop }}>
              <span
                className="tl-rail-fill-grad"
                style={
                  geom
                    ? {
                        height: geom.rail,
                        background: `linear-gradient(to bottom, ${GOLD} 0%, ${GOLD} ${
                          greenStart * 100
                        }%, ${GREEN} 100%)`,
                      }
                    : undefined
                }
              />
            </motion.div>

            <motion.div
              className="tl-ball"
              style={{ top: ballTop, backgroundColor: ballColor, boxShadow: ballHalo }}
            />

            {/* Check de llegada, centrado en el final del riel. En reposo es un
                nodo gris chico (la bolita lo "pisa" al llegar); al completarse
                escala con spring, se pinta verde y el tilde se dibuja. */}
            <motion.div
              className={`tl-check${done ? " done" : ""}`}
              initial={false}
              animate={
                done
                  ? { scale: 1, backgroundColor: GREEN }
                  : { scale: 0.5, backgroundColor: "#D8D8DC" }
              }
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <motion.path
                  d="M5.5 12.6l4.3 4.3L18.6 8"
                  stroke="#FBF8F1"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={done ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  transition={
                    done
                      ? { duration: 0.4, ease: "easeOut", delay: 0.12 }
                      : { duration: 0.15 }
                  }
                />
              </svg>
            </motion.div>
          </div>

          {plan.map((m, i) => (
            <TimelineItem m={m} key={i} hit={i < litCount} />
          ))}
        </div>

        <div className="timeline-delivery serif">{t.timeline.deliveryNote}</div>
        <div className="timeline-foot2" ref={footRef}>
          {t.timeline.foot}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ m, hit }: { m: PaymentMilestone; hit: boolean }) {
  return (
    <div className={`tl-item${hit ? " hit" : ""}`}>
      <div className="tl-content">
        <div className="tl-pct serif">{m.pct}</div>
        <div className="tl-when">{m.when}</div>
        {m.detail ? <p className="tl-desc">{m.detail}</p> : null}
      </div>
    </div>
  );
}
