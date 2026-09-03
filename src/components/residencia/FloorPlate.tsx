"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FloorPlate as FloorPlateData, Unit, Units } from "@/lib/types";
import type { UnitWithId } from "@/lib/data";
import { useI18n } from "@/i18n/LanguageProvider";
import { scrollToTop } from "./landing-dom";
import { unitFillColor } from "@/lib/status";
import { markUnitEntryPoint } from "@/lib/analytics";
import { apiPlate } from "@/lib/api";
import { useAbrirFicha, useShowroomMontado } from "@/components/transition/TransitionProvider";
import { SITE } from "@/data/site";
import { UnitCard } from "../UnitCard";

// Pisos del edificio, en orden de recorrido. Las flechas ciclan con wrap-around
// (último → primero). Sale de la config del proyecto, NO de una constante local:
// es el dato que cambia en cada showroom.
const FLOORS = SITE.floors;

/** Radio OBJETIVO del marcador de unidad, en píxeles de PANTALLA. Se convierte a
 *  unidades del plano con la escala real de render, así mide lo mismo en el Plan
 *  Maestro de escritorio y en la planta de un celular. */
const R_PANTALLA = 17;
/** Qué parte del radio ocupa el número. Subió de 0,6 a 0,76: el número es lo que hay
 *  que poder LEER, y en el disco sobraba aire (a 0,76 tres dígitos ocupan el 58% del
 *  diámetro). El público de estos showrooms compra con la vista cansada. */
const RATIO_NUMERO = 0.76;
/** Tope por CERCANÍA: el radio nunca pasa de esta fracción de la distancia entre los
 *  dos marcadores más próximos de la planta, así dos discos vecinos no se tocan
 *  (0,40 → 20% de aire entre ellos). Es el límite físico en los pisos tipo, donde las
 *  dos tiras de monoambientes tienen sus centros a 89px. */
const HOLGURA_VECINOS = 0.4;
/** Tope por BORDE PROPIO: el disco nunca pasa de esta fracción de la holgura que tiene
 *  el marcador hasta el contorno de su unidad, así no se derrama fuera del plano. */
const HOLGURA_BORDE = 0.9;

/** Lo que devuelve `/api/plate/:floor`. */
interface PlantaTraida {
  plate: FloorPlateData | null;
  units: Record<string, Unit>;
}

/* ───────────────────────────────────────────────────────────────────────────────
   CACHE DE PLANTAS, a nivel de MÓDULO.

   Antes cada cambio de piso volvía a pedir `/api/plate/:floor` y mostraba el spinner
   otra vez, incluso al VOLVER a un piso ya visto ("es super molesto y tosco de ver",
   Joaquim 30-08). Guardado acá afuera sobrevive al desmontaje del componente, así
   que la pestaña "Planta del piso" de la ficha y el Plan Maestro del menú comparten
   lo mismo: se paga una vez por piso y por sesión.

   Con el export estático el endpoint pasó a ser un ARCHIVO horneado en el build
   (out/api/plate/<piso>, ver la route con `force-static`), así que el pedido lo
   sirve Apache de disco y además entra en la cache del navegador. La cache de
   módulo sigue valiendo igual: evita el re-fetch y el re-decode de la imagen.
   ─────────────────────────────────────────────────────────────────────────────── */
const plantasResueltas = new Map<string, PlantaTraida>();
const plantasEnVuelo = new Map<string, Promise<PlantaTraida>>();
/** Imágenes de plano ya decodificadas, por URL. */
const imagenesListas = new Set<string>();
/** Objeto estable para el caso "sin unidades": si fuera un `{}` nuevo en cada render,
 *  el `useMemo` de `byId` se recalcularía siempre. */
const SIN_UNIDADES: Record<string, Unit> = {};

function traerPlanta(floor: string): Promise<PlantaTraida> {
  const ya = plantasResueltas.get(floor);
  if (ya) return Promise.resolve(ya);
  const enVuelo = plantasEnVuelo.get(floor);
  // Un pedido a la vez por piso: el precalentado del vecino y el click comparten uno.
  if (enVuelo) return enVuelo;
  const pedido = fetch(apiPlate(floor))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const datos: PlantaTraida = {
        plate: (d?.plate as FloorPlateData | null) ?? null,
        units: (d?.units as Record<string, Unit>) ?? {},
      };
      plantasResueltas.set(floor, datos);
      return datos;
    })
    // El ERROR no se cachea: si se cayó la red, el próximo intento vuelve a pedir.
    .finally(() => plantasEnVuelo.delete(floor));
  plantasEnVuelo.set(floor, pedido);
  return pedido;
}

/** Decodifica la imagen del plano ANTES de mostrarlo (si no se ve el marco vacío un
 *  instante). Resuelve al toque si esa imagen ya pasó por acá. */
function precargarImagen(src: string): Promise<void> {
  if (imagenesListas.has(src)) return Promise.resolve();
  return new Promise((listo) => {
    const img = new window.Image();
    const fin = () => {
      imagenesListas.add(src);
      listo();
    };
    img.onload = fin;
    img.onerror = fin; // ante un error igual mostramos (el <image> hará su fallback)
    img.src = src;
  });
}

/** La planta de un piso lista para DIBUJAR ya mismo (JSON + imagen decodificada), o
 *  `null` si todavía hay que ir a buscarla. */
function plantaLista(floor: string): PlantaTraida | null {
  const datos = plantasResueltas.get(floor);
  if (!datos) return null;
  if (datos.plate?.image && !imagenesListas.has(datos.plate.image)) return null;
  return datos;
}

/** Deja lista la planta de un piso SIN mostrarla: los dos vecinos al cambiar de piso,
 *  y la pastilla que el usuario está por tocar. */
function precalentarPlanta(floor: string) {
  if (plantaLista(floor)) return;
  void traerPlanta(floor)
    .then((d) => (d.plate?.image ? precargarImagen(d.plate.image) : undefined))
    .catch(() => {});
}

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
  // Lo último que trajimos por red. Ojo: NO es lo que se dibuja — eso se decide en el
  // RENDER, unas líneas más abajo. Si la planta ya está en el cache de módulo se usa
  // directo, sin pasar por un estado: así al volver a un piso ya visto no hay ni un
  // frame de spinner ni de planta vieja.
  const [traido, setTraido] = useState<{ floor: string; datos: PlantaTraida } | null>(null);
  const listo = traido?.floor === floor ? traido.datos : plantaLista(floor);
  const plate = listo?.plate ?? null;
  // Metadata de las unidades de los polígonos del plano (la trae el mismo fetch).
  // Incluye unidades de OTRO piso (los dúplex que asoman en el entrepiso de arriba).
  const plateUnits = listo?.units ?? SIN_UNIDADES;
  const loading = listo == null;

  useEffect(() => {
    let cancelado = false;
    // `traido?.floor === floor` cubre también el caso ERROR: se guarda una planta
    // vacía para este piso y no se reintenta en loop. Al volver más tarde sí reintenta.
    const yaEsta = traido?.floor === floor || plantaLista(floor) != null;
    if (!yaEsta) {
      traerPlanta(floor)
        .then(async (d) => {
          // Recién dejamos de "cargar" cuando la imagen está DECODIFICADA: al mostrar
          // TracedPlate el plano ya está, sin parpadeo.
          if (d.plate?.image) await precargarImagen(d.plate.image);
          if (!cancelado) setTraido({ floor, datos: d });
        })
        .catch(() => {
          if (!cancelado) setTraido({ floor, datos: { plate: null, units: SIN_UNIDADES } });
        });
    }
    // Los dos VECINOS, en segundo plano. Con las flechas sólo se puede ir a uno de
    // ellos, así que dejándolos listos avanzar y retroceder no vuelve a mostrar el
    // spinner nunca. No se precargan los diez a propósito: entre todos los planos son
    // 3,2 MB (la PB sola pesa 1) y en un celular eso se paga.
    const i = FLOORS.indexOf(floor);
    if (i >= 0) {
      for (const d of [1, -1]) {
        precalentarPlanta(FLOORS[(i + d + FLOORS.length) % FLOORS.length]);
      }
    }
    return () => {
      cancelado = true;
    };
  }, [floor, traido]);

  const byId = useMemo(() => {
    const m = new Map<string, UnitWithId>();
    // Para el plano TRAZADO: las unidades de SUS polígonos (incluye los dúplex que
    // vienen de otro piso). Respaldo: las del piso actual (para el esquemático).
    for (const [id, u] of Object.entries(plateUnits)) m.set(id, { id, ...u });
    for (const u of currentFloorUnits) if (!m.has(u.id)) m.set(u.id, u);
    return m;
  }, [plateUnits, currentFloorUnits]);

  // Click en una unidad de la planta → abrir ESA residencia. Misma unidad: subo al
  // hero (scroll suave). Otra unidad: `useAbrirFicha`, que resuelve el destino según
  // la superficie (overlay sobre el showroom, o navegación real desde la ficha
  // standalone) y elige replace en vez de push porque saltar entre unidades es
  // LATERAL — así "Disponibilidad"/back vuelve al exterior de un solo paso.
  const abrirFicha = useAbrirFicha();
  const showroomMontado = useShowroomMontado();
  const router = useRouter();
  const open = useCallback(
    (id: string) => {
      if (onOpenUnit) {
        onOpenUnit(id);
        return;
      }
      if (id === unitId) scrollToTop();
      else {
        markUnitEntryPoint("floor_plate", id);
        abrirFicha(id);
      }
    },
    [unitId, abrirFicha, onOpenUnit],
  );
  // Prefetch del HTML de la ficha para que el salto sea instantáneo. Sobre el
  // showroom NO hace falta: la ficha se monta desde el cliente con datos que ya
  // están en memoria, no hay nada que traer por red.
  const prefetch = useCallback(
    (id: string) => {
      if (id !== unitId && !showroomMontado) router.prefetch(`/residencia/${id}`);
    },
    [unitId, router, showroomMontado],
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
              // Las pastillas saltan a CUALQUIER piso, no sólo al vecino (que ya
              // viene precalentado). Con el hover del mouse o el `pointerdown` del
              // dedo —que llega ~100ms antes que el click— la planta arranca a
              // bajarse antes de que haga falta.
              onPointerEnter={() => precalentarPlanta(f)}
              onPointerDown={() => precalentarPlanta(f)}
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

      {/* La tarjeta toma la PROPORCIÓN REAL del plano del piso (`--plate-ar`), no una
          fija. Los planos de TIER Bravo son verticales —de 0,56:1 (PB) a 1,51:1 (8º),
          casi todos ~0,93— y la tarjeta estaba clavada en 1100/740 = 1,49 APAISADO: el
          SVG va con preserveAspectRatio="meet", así que el dibujo entraba por ALTO y
          dejaba una franja vacía a cada lado. En celular eso lo dejaba en 380x256 con el
          plano ocupando la mitad del ancho (reporte de Joaquim, 30-08: "planta de piso
          se ve muy chiquita", y lo mismo en el Plan Maestro del menú). Con la proporción
          real la tarjeta abraza el plano y el dibujo gana todo el ancho disponible.
          El tope de alto —para que no empuje la página— vive en el CSS. */}
      <div
        className="plate-stage"
        ref={stageRef}
        style={
          plate?.imageWidth && plate?.imageHeight
            ? ({ "--plate-ar": plate.imageWidth / plate.imageHeight } as React.CSSProperties)
            : loading
              ? // Todavía no sabemos la proporción (el plano llega por fetch). Se
                // reserva la del piso TIPO —los pisos 1 a 6 son 7 de 10 y todos rondan
                // 0,93— para que al llegar el plano el salto sea de unos pocos px. Con
                // el fallback del CSS (1,486, la del esquemático) el salto era de 153.
                ({ "--plate-ar": 0.93 } as React.CSSProperties)
              : // Sin plano trazado se dibuja el esquemático, que sí es 1100×740.
                undefined
        }
      >
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

/* ───────────────────────────────────────────────────────────────────────────────
   DÓNDE VA EL MARCADOR DE UNA UNIDAD.

   Iba en el CENTROIDE (centro de masa), y en las unidades en L o en T ese punto
   tiene poco aire: cae cerca del recodo, o directamente sobre el hueco que la L
   abraza. Con el disco a 34px se notaba — el marcador del 706 se derramaba fuera
   del dibujo, sobre el patio (reporte de Joaquim, 31-08: "en sí ESTÁ dentro del
   lienzo, pero justo NO HAY plano en esa parte").

   Ahora va en el POLO DE INACCESIBILIDAD: el punto INTERIOR más lejano de
   cualquier borde — lo mismo que usan los mapas para colocar la etiqueta de un
   país. Medido sobre las 8 plantas, la holgura del 706 pasa de 56 a 268 px de
   plano, y la del 702 en la azotea de 63 a 200. De paso, `holgura` sirve de tope
   de tamaño del disco (ver HOLGURA_BORDE), así que aunque mañana entre un plano
   con una unidad angosta el marcador se achica en vez de derramarse.
   ─────────────────────────────────────────────────────────────────────────────── */

type Punto = [number, number];

const parsePuntos = (points: string): Punto[] =>
  points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number) as Punto);

/** Distancia de un punto al segmento a-b. */
function distanciaASegmento(px: number, py: number, a: Punto, b: Punto): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo2 = dx * dx + dy * dy;
  const t = largo2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / largo2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** Ray casting: ¿el punto cae adentro del polígono? */
function estaAdentro(px: number, py: number, pts: Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Distancia al contorno CON SIGNO: positiva adentro, negativa afuera. */
function holguraAlBorde(px: number, py: number, pts: Punto[]): number {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    d = Math.min(d, distanciaASegmento(px, py, pts[i], pts[j]));
  }
  return estaAdentro(px, py, pts) ? d : -d;
}

/**
 * Polo de inaccesibilidad: el punto interior con más aire hasta el borde. Se
 * resuelve con una grilla que se va refinando alrededor del mejor candidato —más
 * simple que la cola de prioridad del `polylabel` clásico y de sobra para estos
 * polígonos (18ms para las ocho plantas enteras, y va memoizado por planta).
 */
function poloInterior(points: string): { x: number; y: number; holgura: number } {
  const pts = parsePuntos(points);
  if (pts.length < 3) {
    const c = centroid(points);
    return { ...c, holgura: 0 };
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  let mejor = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, holgura: -Infinity };
  let paso = Math.max(x1 - x0, y1 - y0) / 8;
  // Hasta 1px de plano: más fino no cambia nada visible (el plano se dibuja a
  // menos de la mitad de su tamaño nativo hasta en escritorio).
  while (paso > 1) {
    for (let x = x0; x <= x1; x += paso) {
      for (let y = y0; y <= y1; y += paso) {
        const h = holguraAlBorde(x, y, pts);
        if (h > mejor.holgura) mejor = { x, y, holgura: h };
      }
    }
    x0 = mejor.x - paso;
    x1 = mejor.x + paso;
    y0 = mejor.y - paso;
    y1 = mejor.y + paso;
    paso /= 4;
  }
  // Polígono degenerado (todo el barrido dio afuera): al menos no romper.
  if (mejor.holgura <= 0) {
    const c = centroid(points);
    return { ...c, holgura: Math.max(0, holguraAlBorde(c.x, c.y, pts)) };
  }
  return mejor;
}

/** Centroide (centro de masa) — respaldo del polo para polígonos degenerados. */
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

  // ── Tamaño del marcador ────────────────────────────────────────────────────
  // Antes salía de `min(w,h) * 0,019`, o sea del tamaño NATIVO del plano, y eso
  // rompía por dos lados a la vez (reporte de Joaquim, 30-08: "se ven MUY chiquitos,
  // tanto mobile como desktop"):
  //   · el mismo marcador medía 24px de diámetro en escritorio y 9 en un celular,
  //     porque el plano se dibuja mucho más chico y el marcador viaja con él;
  //   · `min(w,h)` castiga a los planos APAISADOS: la azotea (1583×1049) sacaba un
  //     radio 34% menor que el piso tipo aunque se dibuja igual de grande. Justo la
  //     planta de la captura del cliente.
  // Ahora el radio se pide en PÍXELES DE PANTALLA y se convierte con la escala real
  // de render, con un tope por cercanía para que dos vecinos nunca se toquen.
  const svgRef = useRef<SVGSVGElement>(null);
  const [escala, setEscala] = useState<number | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // `preserveAspectRatio="meet"` → la escala que manda es la MENOR de las dos.
      setEscala(Math.min(r.width / w, r.height / h));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  // Centroides una sola vez: los usan el marcador y el cálculo de cercanía.
  const marcadores = useMemo(
    () => plate.polygons.map((p) => ({ poly: p, c: poloInterior(p.points) })),
    [plate.polygons]
  );
  /** La holgura MÁS CHICA de la planta: ninguna unidad tiene más aire que eso entre
   *  su marcador y su propio borde, así que es el tope de tamaño del disco. Se toma
   *  el mínimo de toda la planta y no uno por unidad a propósito: los marcadores de
   *  un mismo plano tienen que medir todos igual. */
  const holguraMinima = useMemo(
    () => marcadores.reduce((min, m) => Math.min(min, m.c.holgura), Infinity),
    [marcadores]
  );
  /** Distancia (en unidades del plano) entre los dos marcadores más próximos de esta
   *  planta. En los pisos tipo son 189px; en el 7° y el 8°, más de 670 — por eso ahí
   *  el marcador puede crecer sin problema. */
  const vecinoMasCerca = useMemo(() => {
    let min = Infinity;
    for (let i = 0; i < marcadores.length; i++) {
      for (let j = i + 1; j < marcadores.length; j++) {
        const d = Math.hypot(
          marcadores[i].c.x - marcadores[j].c.x,
          marcadores[i].c.y - marcadores[j].c.y
        );
        if (d < min) min = d;
      }
    }
    return min;
  }, [marcadores]);

  const R = Math.min(
    // Objetivo en pantalla. Antes de la primera medición (SSR / primer paint) cae en
    // la fórmula vieja, que es un valor razonable y evita el salto de tamaño.
    escala ? R_PANTALLA / escala : Math.min(w, h) * 0.019,
    vecinoMasCerca * HOLGURA_VECINOS,
    // Y nunca más grande que el aire que tiene la unidad MÁS JUSTA de la planta.
    holguraMinima * HOLGURA_BORDE
  );
  // ¿La unidad actual está en ESTE piso? Sólo entonces atenuamos las demás para que
  // resalte fuerte (Miro 2026-07-15). En el Plan Maestro (sin currentId) o en otros
  // pisos de la landing, todas quedan con su tinte normal.
  const hasCurrent = currentId != null && plate.polygons.some((p) => p.unitId === currentId);
  return (
    <svg
      ref={svgRef}
      className={`plate-svg${hasCurrent ? " has-current" : ""}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <image href={plate.image} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
      {marcadores.map(({ poly: p, c }) => {
        const u = byId.get(p.unitId);
        // Color de la unidad: VIOLETA si es dúplex, si no verde/ámbar por disponibilidad.
        const color = u ? unitFillColor(u) : "#9ca3af";
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
                fontSize={R * RATIO_NUMERO}
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
