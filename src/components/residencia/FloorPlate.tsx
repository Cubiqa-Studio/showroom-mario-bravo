"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FloorPlate as FloorPlateData, Unit, Units } from "@/lib/types";
import type { UnitWithId } from "@/lib/data";
import { useI18n } from "@/i18n/LanguageProvider";
import { scrollToTop } from "./landing-dom";
import { unitFillColor } from "@/lib/status";
import { SITE } from "@/data/site";
import { UnitCard } from "../UnitCard";

// Pisos del edificio, en orden de recorrido. Las flechas ciclan con wrap-around
// (último → primero). Sale de la config del proyecto, NO de una constante local:
// es el dato que cambia en cada showroom.
const FLOORS = SITE.floors;

/**
 * "Planta del piso" — COMPONENTE AISLADO. Tiene dos caminos:
 *  1. `plate` trazado (Fase 6): imagen del plano + polígonos por unidad.
 *  2. `plate === null` (hoy): ESQUEMÁTICO honesto generado desde las unidades
 *     reales del piso (no un plano falso). Mismo tooltip en ambos.
 * El día que haya geometría real sólo cambia `getPlate()`; esto no se toca.
 * Miro 2026-06-10: flechas ‹ › para cambiar de piso (arranca en el piso de la
 * unidad, marcado "Tu residencia"); el fetch keyeado por piso recarga la plate.
 */
export function FloorPlate({
  unitId,
  floorUnits,
  allUnits,
  onOpenUnit,
  floorPills = false,
}: {
  /** Unidad "actual" (landing): marca "Tu residencia" y al click vuelve a ella.
   *  Ausente en el Plan Maestro (no hay residencia de contexto → arranca en PB). */
  unitId?: string;
  /** Vecinos del piso para el esquemático (landing). Si va `allUnits`, se ignora. */
  floorUnits?: UnitWithId[];
  /** Mapa COMPLETO de unidades (Plan Maestro): deriva los vecinos del piso ACTIVO
   *  internamente, así el esquemático es correcto en cualquier piso (no sólo el
   *  de origen como con `floorUnits`). */
  allUnits?: Units;
  /** Override del click en una unidad (el modal cierra + navega). Default: landing. */
  onOpenUnit?: (id: string) => void;
  /** Pills de acceso directo a cada piso (Plan Maestro). */
  floorPills?: boolean;
}) {
  // Piso de ESTA unidad ("207" → "2"); sin unidad (Plan Maestro) arranca en el
  // primero del edificio — no en un "0" fijo, que en un edificio sin PB habitable
  // dejaba el Plan Maestro abriendo en un piso inexistente.
  // Sin unidad (Plan Maestro) arranca en el primer piso CON UNIDADES, no en el
  // primero del selector: desde que el subsuelo y la planta baja son plantas
  // navegables, `FLOORS[0]` es la cochera — un arranque raro para un plan maestro.
  const firstResidential = useMemo(() => {
    if (!allUnits) return FLOORS[0];
    const conUnidades = new Set(
      Object.keys(allUnits).map((id) => (id.length > 2 ? id.slice(0, -2) : id)),
    );
    return FLOORS.find((f) => conUnidades.has(f)) ?? FLOORS[0];
  }, [allUnits]);
  const homeFloor = unitId
    ? unitId.length > 2
      ? unitId.slice(0, -2)
      : unitId
    : firstResidential;
  const [floor, setFloor] = useState(homeFloor);
  const { t } = useI18n();
  const floorLabel = (f: string) =>
    f === "SS" ? t.plate.basement : f === "0" ? t.plate.groundFloor : t.plate.floor(f);

  // Vecinos del piso ACTIVO: derivados de allUnits (Plan Maestro → correcto en
  // cualquier piso) o los `floorUnits` fijos del piso de origen (landing).
  const currentFloorUnits = useMemo<UnitWithId[]>(() => {
    if (allUnits) {
      return Object.entries(allUnits)
        .filter(([id]) => (id.length > 2 ? id.slice(0, -2) : id) === floor)
        .map(([id, u]) => ({ id, ...u }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    }
    return floorUnits ?? [];
  }, [allUnits, floorUnits, floor]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<{ u: UnitWithId; x: number; y: number } | null>(null);

  // Cierre del tooltip en TÁCTIL: no hay "mouseleave" al levantar el dedo, así que un tap
  // dejaría la tarjeta pegada (y `.unit-tip.show` capturaría el próximo tap). La cerramos
  // ante cualquier pointerdown/scroll nuevo; tocar OTRA unidad la reabre por el mouseenter
  // sintético. Dep booleana (no `tip`) para no re-suscribir en cada mousemove del desktop.
  const tipShown = tip !== null;
  useEffect(() => {
    if (!tipShown) return;
    const clear = () => setTip(null);
    window.addEventListener("pointerdown", clear);
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", clear);
      window.removeEventListener("scroll", clear, true);
    };
  }, [tipShown]);

  // La plate trazada se carga LAZY (este componente sólo monta al abrir la pestaña
  // "Planta del piso") → la navegación al detalle NUNCA se bloquea leyendo el Blob.
  // Mientras se resuelve el fetch mostramos un loader (NO el esquemático), así no
  // parpadea el plano genérico antes del plano real. Si el piso no tiene plano, el
  // esquemático aparece recién al saberlo (sin flash).
  const [plate, setPlate] = useState<FloorPlateData | null>(null);
  // Metadata de las unidades de los polígonos del plano (la trae el mismo fetch).
  // Incluye unidades de OTRO piso (los dúplex que asoman en el entrepiso de arriba).
  const [plateUnits, setPlateUnits] = useState<Record<string, Unit>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/plate/${floor}`)
      .then((r) => (r.ok ? r.json() : { plate: null, units: {} }))
      .then((d) => {
        if (cancelled) return;
        const p = (d?.plate as FloorPlateData | null) ?? null;
        const pu = (d?.units as Record<string, Unit>) ?? {};
        const done = () => {
          if (cancelled) return;
          setPlate(p);
          setPlateUnits(pu);
          setLoading(false);
        };
        // Precargamos la imagen del plano: recién dejamos de "cargar" cuando el JPG
        // está decodificado → al mostrar TracedPlate la imagen ya está, sin parpadeo.
        if (p?.image) {
          const img = new window.Image();
          img.onload = done;
          img.onerror = done; // ante un error igual mostramos (el <image> hará su fallback)
          img.src = p.image;
        } else {
          done();
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [floor]);

  const byId = useMemo(() => {
    const m = new Map<string, UnitWithId>();
    // Para el plano TRAZADO: las unidades de SUS polígonos (incluye los dúplex que
    // vienen de otro piso). Respaldo: las del piso actual (para el esquemático).
    for (const [id, u] of Object.entries(plateUnits)) m.set(id, { id, ...u });
    for (const u of currentFloorUnits) if (!m.has(u.id)) m.set(u.id, u);
    return m;
  }, [plateUnits, currentFloorUnits]);

  // Click en una unidad de la planta → abrir ESA residencia. Misma unidad: subo al
  // hero (scroll suave). Otra unidad: navego con el router (client-side, sin reload);
  // como las páginas son SSG y las prefetcheo en hover, el salto es instantáneo.
  // REPLACE (no push): saltar entre unidades es lateral, no apila historial. Dentro
  // del overlay interceptado, cada push intercepta una landing NUEVA sobre el home,
  // así que "Disponibilidad" (router.back) tendría que desandarlas una por una.
  // Reemplazando, el historial queda `/ → /residencia/<actual>` y un solo back vuelve
  // al exterior. Igual de instantáneo (la página destino ya está prefetcheada).
  const router = useRouter();
  const open = useCallback(
    (id: string) => {
      if (onOpenUnit) {
        onOpenUnit(id);
        return;
      }
      if (id === unitId) scrollToTop();
      else router.replace(`/residencia/${id}`);
    },
    [unitId, router, onOpenUnit],
  );
  const prefetch = useCallback(
    (id: string) => {
      if (id !== unitId) router.prefetch(`/residencia/${id}`);
    },
    [unitId, router],
  );

  const move = (u: UnitWithId | undefined, clientX: number, clientY: number) => {
    if (!u) return; // sin metadata no hay tooltip (la unidad actual se comporta igual que el resto)
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    let x = clientX - r.left + 18;
    let y = clientY - r.top + 18;
    if (x + 290 > r.width) x = clientX - r.left - 290;
    if (y + 350 > r.height) y = r.height - 360;
    setTip({ u, x, y: Math.max(10, y) });
  };

  // Cambio de piso con wrap-around; cierra el tooltip (la unidad ya no está).
  const step = (dir: 1 | -1) => {
    const i = FLOORS.indexOf(floor);
    setFloor(FLOORS[(i + dir + FLOORS.length) % FLOORS.length]);
    setTip(null);
  };

  return (
    <>
      <div className="plate-nav">
        <button type="button" className="plate-nav-btn" onClick={() => step(-1)} aria-label={t.plate.prevFloor}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="plate-nav-label">
          {floorLabel(floor)}
          {unitId && floor === homeFloor ? (
            <span className="pn-here">{t.plate.yourResidence}</span>
          ) : null}
        </div>
        <button type="button" className="plate-nav-btn" onClick={() => step(1)} aria-label={t.plate.nextFloor}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {floorPills ? (
        <div className="plate-pills">
          {FLOORS.map((f) => (
            <button
              key={f}
              type="button"
              className={`plate-pill${f === floor ? " active" : ""}`}
              aria-pressed={f === floor}
              onClick={() => {
                setFloor(f);
                setTip(null);
              }}
            >
              {f === "0" ? "PB" : `${f}°`}
            </button>
          ))}
        </div>
      ) : null}

      <div className="plate-stage" ref={stageRef}>
      {loading ? (
        <div className="plate-loading" aria-hidden />
      ) : plate ? (
        <TracedPlate
          plate={plate}
          byId={byId}
          currentId={unitId}
          onMove={move}
          onLeave={() => setTip(null)}
          onOpen={open}
          onPrefetch={prefetch}
        />
      ) : (
        <SchematicPlate
          unitId={unitId}
          floorUnits={currentFloorUnits}
          onMove={move}
          onLeave={() => setTip(null)}
        />
      )}

      {tip ? (
        <div className="unit-tip show" style={{ left: tip.x, top: tip.y }}>
          <UnitCard unit={tip.u} />
        </div>
      ) : null}
      </div>
    </>
  );
}

// ── Esquemático: las unidades del piso como celdas en una franja, núcleo al pie.
function SchematicPlate({
  unitId,
  floorUnits,
  onMove,
  onLeave,
}: {
  unitId?: string;
  floorUnits: UnitWithId[];
  onMove: (u: UnitWithId | undefined, x: number, y: number) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const W = 1100;
  const H = 740;
  const PAD = 24;
  const coreH = 64;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2 - coreH;
  const n = Math.max(floorUnits.length, 1);
  const cellW = innerW / n;

  return (
    <svg className="plate-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <rect x={PAD} y={PAD} width={innerW} height={H - PAD * 2} rx={18} className="fp2-outer" />

      {floorUnits.map((u, i) => {
        const x = PAD + i * cellW;
        const selected = u.id === unitId;
        return (
          <g
            key={u.id}
            className={selected ? "unit-selected" : "unit-shape"}
            onMouseEnter={(e) => onMove(u, e.clientX, e.clientY)}
            onMouseMove={(e) => onMove(u, e.clientX, e.clientY)}
            onMouseLeave={onLeave}
          >
            <rect
              x={x + 4}
              y={PAD + 4}
              width={cellW - 8}
              height={innerH - 8}
              rx={8}
              className={selected ? "tint-selected" : "tint-neighbor"}
            />
            <text x={x + cellW / 2} y={PAD + innerH / 2 - 6} textAnchor="middle" className="fp2-room" style={{ fontSize: 26 }}>
              {u.residence}
            </text>
            <text x={x + cellW / 2} y={PAD + innerH / 2 + 20} textAnchor="middle" className="fp2-sub">
              {u.areas?.total != null ? `${u.areas.total} m²` : t.plate.rooms(u.beds)}
            </text>
            {selected ? (
              <text x={x + cellW / 2} y={PAD + 30} textAnchor="middle" className="fp2-sub" style={{ letterSpacing: ".12em" }}>
                {t.plate.yourResidenceUpper}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Núcleo / circulación (no es una unidad). */}
      <rect x={PAD} y={H - PAD - coreH} width={innerW} height={coreH} className="core-fill" />
      <text x={W / 2} y={H - PAD - coreH / 2 + 4} textAnchor="middle" className="core-label">
        {t.plate.core}
      </text>
    </svg>
  );
}

/** Centroide (centro de masa) de un polígono "x,y x,y ..." para ubicar el marcador. */
function centroid(points: string): { x: number; y: number } {
  const pts = points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number) as [number, number]);
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(area) < 1e-6) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p[0], 0) / n, y: pts.reduce((s, p) => s + p[1], 0) / n };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

// ── Trazado real: plano del piso + polígono por unidad + MARCADOR central (círculo
//    con el número que muta a "+" en hover). Click → abre esa residencia.
//    La unidad ACTUAL (landing) va con relleno más oscuro (`pm-current`): es el
//    "plano de ubicación" acordado con Juani (Miro 2026-07-15) — el que navega ve
//    de un vistazo en qué parte del piso está parado.
function TracedPlate({
  plate,
  byId,
  currentId,
  onMove,
  onLeave,
  onOpen,
  onPrefetch,
}: {
  plate: FloorPlateData;
  byId: Map<string, UnitWithId>;
  /** Unidad actual (landing): su polígono se marca más oscuro. */
  currentId?: string;
  onMove: (u: UnitWithId | undefined, x: number, y: number) => void;
  onLeave: () => void;
  onOpen: (id: string) => void;
  onPrefetch: (id: string) => void;
}) {
  const w = plate.imageWidth ?? 1100;
  const h = plate.imageHeight ?? 740;
  const R = Math.min(w, h) * 0.019; // radio del marcador, proporcional al plano
  // ¿La unidad actual está en ESTE piso? Sólo entonces atenuamos las demás para que
  // resalte fuerte (Miro 2026-07-15). En el Plan Maestro (sin currentId) o en otros
  // pisos de la landing, todas quedan con su tinte normal.
  const hasCurrent = currentId != null && plate.polygons.some((p) => p.unitId === currentId);
  return (
    <svg
      className={`plate-svg${hasCurrent ? " has-current" : ""}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <image href={plate.image} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
      {plate.polygons.map((p) => {
        const u = byId.get(p.unitId);
        // Color de la unidad: VIOLETA si es dúplex, si no verde/ámbar por disponibilidad.
        const color = u ? unitFillColor(u) : "#9ca3af";
        const c = centroid(p.points);
        const label = u?.residence ?? p.unitId;
        return (
          <g
            key={p.unitId}
            className={`pm-group${p.unitId === currentId ? " pm-current" : ""}`}
            style={{ "--c": color } as React.CSSProperties}
            onMouseEnter={(e) => {
              onPrefetch(p.unitId);
              onMove(u, e.clientX, e.clientY);
            }}
            onMouseMove={(e) => onMove(u, e.clientX, e.clientY)}
            onMouseLeave={onLeave}
            onClick={() => onOpen(p.unitId)}
          >
            <polygon points={p.points} className="plate-poly" vectorEffect="non-scaling-stroke" />
            <g className="pm" transform={`translate(${c.x},${c.y})`}>
              <circle className="pm-disc" r={R} strokeWidth={R * 0.06} />
              <text
                className="pm-num"
                fontSize={R * 0.6}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
              <g className="pm-plus" strokeWidth={R * 0.13} strokeLinecap="round">
                <line x1={-R * 0.42} y1={0} x2={R * 0.42} y2={0} />
                <line x1={0} y1={-R * 0.42} x2={0} y2={R * 0.42} />
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
