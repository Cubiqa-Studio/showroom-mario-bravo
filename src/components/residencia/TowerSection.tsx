"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { SITE } from "@/data/site";
import type { VistaUnidad } from "@/lib/data";
import type { Unit } from "@/lib/types";
import { PARAM_VISTA } from "@/lib/residencia";
import { FILL_ALPHA, statusColor } from "@/lib/status";
import { scrollToTop } from "./landing-dom";

/* eslint-disable @next/next/no-img-element */

/**
 * "El Edificio" (sección 07, la ÚLTIMA de la landing): full-bleed, a PANTALLA
 * COMPLETA (100dvh).
 *
 * Muestra **la vista del showroom desde la que se entró a esta unidad**, con su
 * polígono señalado (idea de Joaquim, 01-09): el visitante cierra la ficha viendo
 * dónde está su departamento en el edificio. Cuál vista sale del query param
 * `?vista=` que escribe el click sobre el polígono; si falta —entró por un link
 * directo, por el buscador o saltando desde otra unidad— cae a la primera vista donde
 * la unidad esté trazada, y si no está en ninguna, al render de portada de siempre
 * (`SITE.aerialImage`), sin marca.
 *
 * El param se lee en un efecto y no durante el render para no arrastrar la ruta a
 * dinámica: la landing se hornea en el build (export estático), donde un
 * `searchParams` en el server sería directamente un error de build. Leerlo del
 * `window.location` en un efecto además cubre el caso del OVERLAY, donde la URL la
 * escribe `history.pushState` y no hay render de servidor de por medio.
 * Se puede porque esta sección es la última
 * y está muy por debajo del pliegue: la resolución ocurre mucho antes de que alguien
 * la vea y, con `loading="lazy"`, el navegador ni pide la imagen que se descarta.
 *
 * ## Por qué el encuadre se calcula acá y no con `object-fit: cover`
 *
 * El render es 16:9 y la sección ocupa la pantalla entera, así que en un teléfono
 * vertical el `cover` recorta los costados a lo bestia: medido contra la geometría
 * real, **83 de los 116 polígonos quedan (al menos en parte) fuera de cuadro** a
 * 393×727 — o sea que la unidad señalada casi nunca se vería. Por eso el lienzo se
 * dimensiona y se corre a mano: mismo tamaño que daría `cover` (nunca hay franjas
 * vacías) pero centrado en la unidad, y acotado a los bordes de la imagen. En
 * escritorio el recorte es suave y el clamp lo deja prácticamente centrado, como antes.
 */

interface Caja {
  w: number;
  h: number;
  l: number;
  t: number;
}

/** Centro del bounding box del polígono, en píxeles del render. */
function centroDe(points: string): { x: number; y: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const par of points.trim().split(/\s+/)) {
    const [xs, ys] = par.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0 };
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

export function TowerSection({
  unit,
  unitId,
  vistas,
}: {
  unit: Unit;
  unitId: string;
  vistas: VistaUnidad[];
}) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stopPedido, setStopPedido] = useState<number | null>(null);
  const [caja, setCaja] = useState<Caja | null>(null);

  useEffect(() => {
    const crudo = new URLSearchParams(window.location.search).get(PARAM_VISTA);
    const n = crudo === null ? Number.NaN : Number(crudo);
    setStopPedido(Number.isFinite(n) ? n : null);
  }, [unitId]);

  const vista = vistas.find((v) => v.stopId === stopPedido) ?? vistas[0] ?? null;
  const color = statusColor(unit.status);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !vista) {
      setCaja(null);
      return;
    }
    const centro = centroDe(vista.points);
    const recalcular = () => {
      const { width: cw, height: ch } = stage.getBoundingClientRect();
      if (!cw || !ch) return;
      const k = Math.max(cw / vista.width, ch / vista.height);
      const w = vista.width * k;
      const h = vista.height * k;
      setCaja({
        w,
        h,
        l: Math.min(0, Math.max(cw - w, cw / 2 - centro.x * k)),
        t: Math.min(0, Math.max(ch - h, ch / 2 - centro.y * k)),
      });
    };
    recalcular();
    const ro = new ResizeObserver(recalcular);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [vista]);

  return (
    <section className="frame" id="building" aria-labelledby="tower-heading">
      {/* Heading real (sr-only) para que la última sección tenga encabezado como
          el resto (02–06) y el outline h1→h2 quede completo. Visual intacto. */}
      <h2 id="tower-heading" className="sr-only">
        {t.tower.tag}
      </h2>
      {/* Miro 2026-07-15: sin el número de sección ("07 /") — quedó sólo la etiqueta. */}
      <div className="frame-tag">{t.tower.tag}</div>
      <div className="building-stage" ref={stageRef}>
        {vista ? (
          // Hasta la primera medición el lienzo llena el contenedor y el SVG usa
          // `slice`, que es exactamente el `cover` de siempre: así no hay salto.
          <div
            className="bs-lienzo"
            style={
              caja
                ? { width: caja.w, height: caja.h, left: caja.l, top: caja.t }
                : { left: 0, top: 0, width: "100%", height: "100%" }
            }
          >
            {/* Última sección de la página → lazy: no compite con el hero ni con el
                plano por el ancho de banda de la primera pantalla. */}
            <img
              className="building-aerial"
              src={vista.image}
              alt={t.tower.unitAlt(unit.residence)}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <svg
              className="building-svg"
              viewBox={`0 0 ${vista.width} ${vista.height}`}
              preserveAspectRatio={caja ? "xMidYMid meet" : "xMidYMid slice"}
              aria-hidden
            >
              <polygon
                points={vista.points}
                fill={color}
                fillOpacity={FILL_ALPHA}
                stroke="#ffffff"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              {/* Contorno que respira, el mismo recurso con el que el showroom avisa
                  "acá hay algo": sin él, un polígono quieto sobre una fachada llena de
                  ventanas iguales se pierde. */}
              <polygon
                className="unit-breathe"
                points={vista.points}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        ) : (
          <img
            className="building-aerial"
            src={SITE.aerialImage}
            alt={t.tower.aerialAlt}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}

        <button type="button" className="fab" title={t.tower.backToTop} onClick={scrollToTop}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          {t.tower.up}
        </button>
      </div>
    </section>
  );
}
