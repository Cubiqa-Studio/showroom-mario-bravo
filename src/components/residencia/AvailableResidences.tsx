"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UnitWithId } from "@/lib/data";
import { formatBaths } from "@/lib/residencia";
import { useI18n } from "@/i18n/LanguageProvider";
import { StatusPill } from "./StatusPill";
import { UnitCard } from "../UnitCard";

/**
 * "Unidades Disponibles" (sección 9): filas tipo lista editorial + mini-plano que
 * sigue el cursor. Cada fila linkea a /residencia/:id con scroll={false} (preserva
 * la transición: crossfade desde el overlay, navegación normal en standalone).
 * `replace` (no push): saltar de una unidad a otra es lateral; reemplaza la entrada
 * de historial en vez de apilarla, así "Disponibilidad" vuelve al exterior de un
 * solo click (sin desandar landing por landing). Ver nota en FloorPlate.open.
 *
 * Lista progresiva: arranca con 3 filas + "Ver más" e infinite-scroll (un centinela
 * carga la próxima tanda al acercarse). Evita el muro de ~40 filas en mobile (y de
 * paso esquiva el bug donde una sección enorme no disparaba el reveal).
 */
const INITIAL = 3;
const STEP = 6;

export function AvailableResidences({ others }: { others: UnitWithId[] }) {
  const { t } = useI18n();
  const [mini, setMini] = useState<{ u: UnitWithId; x: number; y: number } | null>(null);
  // Última unidad hovereada: el float la sigue mostrando durante el fade-out
  // (sin esto, al salir del hover la tarjeta queda blanca mientras se desvanece).
  const lastUnit = useRef<UnitWithId | null>(null);
  const [visible, setVisible] = useState(INITIAL);
  // `auto` arranca apagado: se muestran 3 y NADA se autocarga hasta el primer "Ver más"
  // (si no, con 3 filas cortas el centinela queda a la vista y cargaría solo). Tras ese
  // tap, el infinite-scroll toma el control y va cargando de a STEP al scrollear.
  const [auto, setAuto] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = visible < others.length;

  // Infinite scroll: al asomar el centinela (200px antes), cargamos otra tanda.
  useEffect(() => {
    if (!auto || !hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(v + STEP, others.length));
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, hasMore, others.length]);

  if (!others.length) return null;

  const onMove = (u: UnitWithId, clientX: number, clientY: number) => {
    let x = clientX + 26;
    const y = Math.max(80, Math.min(clientY - 98, window.innerHeight - 250));
    if (x + 280 > window.innerWidth) x = clientX - 296;
    lastUnit.current = u;
    setMini({ u, x, y });
  };

  const shown = others.slice(0, visible);
  const floatUnit = mini?.u ?? lastUnit.current;

  return (
    <>
      <div className="wrap">
        <div className="spec-head">
          <h2 className="section-title">{t.residences.sectionTitle}</h2>
          <p className="muted center">{t.residences.note}</p>
        </div>

        <div className="res-list">
          {shown.map((u) => (
            <Link
              key={u.id}
              href={`/residencia/${u.id}`}
              replace
              scroll={false}
              className="res-row"
              onMouseEnter={(e) => onMove(u, e.clientX, e.clientY)}
              onMouseMove={(e) => onMove(u, e.clientX, e.clientY)}
              onMouseLeave={() => setMini(null)}
            >
              <div className="rr-name serif">{t.common.residence(u.residence)}</div>
              <div className="rr-stats">
                {t.plate.statsLine(
                  u.beds,
                  formatBaths(u.baths, t.numberLocale),
                  u.areas?.total != null ? ` · ${u.areas.total} m²` : "",
                )}
                {/* Vistas EN VIVO (Airtable), ej. "Montaña". Sólo si la unidad la trae. */}
                {u.vistas ? ` · ${u.vistas}` : ""}
                {/* Exposición: va en la línea de stats y no como pill (el dúplex
                    tampoco tiene pill acá). Esta lista es para BARRER con la vista,
                    y frente/contrafrente es justo lo que se busca al barrer. */}
                {u.exposure ? ` · ${t.status[u.exposure]}` : ""}
              </div>
              {/* Miro 2026-07-15: sin precio en la fila (se sacaron los precios). */}
              <div className="rr-badge">
                <StatusPill status={u.status} />
              </div>
              <div className="rr-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {hasMore ? (
          <div className="res-more" ref={sentinelRef}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setVisible((v) => Math.min(v + STEP, others.length));
                setAuto(true);
              }}
            >
              {t.residences.seeMore}
              <span className="res-more-count">+{others.length - visible}</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Tarjeta flotante que sigue al cursor — misma tarjeta compacta que el
          hover del exterior y de "Planta del piso". */}
      <div
        className={`res-mini-float${mini ? " show" : ""}`}
        style={mini ? { left: mini.x, top: mini.y } : undefined}
        aria-hidden
      >
        {floatUnit ? <UnitCard unit={floatUnit} /> : null}
      </div>
    </>
  );
}
