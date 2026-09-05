"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { FlybySegment, Stop, Units } from "@/lib/types";
import { InteractiveOverlay } from "./InteractiveOverlay";
import { ShowroomToolbar } from "./ShowroomToolbar";
import { SideMenu } from "./SideMenu";
import { MasterplanModal } from "../residencia/MasterplanModal";
import { ContactModal } from "../residencia/ContactModal";
import { GalleryModal } from "../residencia/GalleryModal";
import { VolverAPortada } from "./VolverAPortada";
import { AvanceBadge } from "../AvanceBadge";
import { UnitFinderModal } from "./UnitFinderModal";
import { SearchIcon } from "./icons";
import { VrHotspot } from "./VrHotspot";
import { Vr360Modal } from "./Vr360Modal";
import { VR_HOTSPOTS } from "@/lib/vr-hotspots";
import { useWhatsappUrl } from "@/components/OrigenProvider";
import { useI18n } from "@/i18n/LanguageProvider";
import { useIsTouch } from "@/hooks/useIsTouch";

interface FlybyViewerProps {
  /** Todos los stops disponibles (geometría + still por vista). */
  stops: Stop[];
  /** Metadata de las unidades (compartida entre stops). */
  units: Units;
  /** Transiciones pre-renderizadas entre stops. */
  segments: FlybySegment[];
  /** Branding flotante arriba a la izquierda. */
  branding?: ReactNode;
}

type Phase = "parked" | "transitioning" | "scrubbing";
type Dir = "forward" | "reverse";

/** Duración de una transición completa (ms). Las parciales (soltar a mitad) escalan. */
const TRANSITION_MS = 650;
/** Píxeles a arrastrar antes de considerar que es un drag (y no un click). Calibrado
 *  para MOUSE (desktop: decide click-en-unidad vs drag-scrub del flyby). */
const DRAG_DEADZONE = 6;
/** Deadzone del PANEO táctil. Un tap de dedo real "tiembla" 5-15px; con el umbral de
 *  mouse (6px) ese temblor se clasificaba como paneo → suppressClick se comía el click
 *  sintetizado → tocar una unidad A VECES no abría su tarjeta (había que tocar 2-3 veces).
 *  12px queda por encima del temblor típico y por debajo del slop de supresión de click
 *  de Chromium (~15px): así todo lo que la app considera "tap" el navegador también lo
 *  sintetiza como click. El slop real de dispositivo (Android ≈8, iOS ≈10) puede dejar
 *  una franja angosta donde el navegador ya no emite click; eso lo cubre el limpiado de
 *  suppressClickRef en cada pointerdown (un tap nuevo nunca hereda supresión vieja). */
const TOUCH_PAN_DEADZONE = 12;
/** Fracción del ancho del escenario que equivale a recorrer todo el segmento. */
const DRAG_RANGE_FACTOR = 0.55;
/** Al soltar: si avanzaste más que esto, completá hasta el destino; si no, volvé. */
const COMMIT_PROGRESS = 0.1;
/** Frames (en orden de reproducción) que gatean el ARRANQUE de una transición. Sólo
 *  estos se esperan decodificados; el resto decodifica en paralelo mientras la
 *  animación corre (el decoder rinde ~10-20ms/frame y el consumo es ~22ms/frame,
 *  así que nunca lo alcanza). Gatear los 30 metía ~150-300ms mudos tras el tap. */
const RUN_GATE_FRAMES = 6;
/** Cuánto tiene que DURAR la espera de los frames para que valga la pena explicarla con
 *  el pill "Cargando recorrido…". `warmSegs` arranca vacío en cada montaje, así que la
 *  condición se cumple SIEMPRE por un instante — incluso con todo en la cache del disco
 *  (F5, volver de una ficha) o viniendo del precalentado de la intro, donde los frames
 *  resuelven en decenas de ms. Sin este retardo el pill parpadeaba en cada carga,
 *  siempre en "0%", que es exactamente cuando no tenía nada para informar. */
const NAV_PILL_DELAY_MS = 600;
/** Y si llegó a mostrarse, se queda al menos esto. Un cartel que aparece y se va en
 *  100ms se lee como un glitch, no como información. */
const NAV_PILL_MIN_MS = 500;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampN = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
/** transform del "stage" de paneo (mobile): centra el sobre-tamaño y le suma el offset. */
const STAGE_TRANSFORM = (x: number, y: number) =>
  `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0)`;
/** Índice de frame para un progreso 0→1 (forward: 0→N-1; reverse: N-1→0). */
const frameAtProgress = (n: number, dir: Dir, p: number) =>
  dir === "forward" ? Math.round(p * (n - 1)) : Math.round((1 - p) * (n - 1));
/** Clave estable de un segmento (para el set de segmentos ya "calentados"). */
const segKey = (s: FlybySegment) => `${s.from}-${s.to}`;
/** Resuelve cuando el <img> terminó de BAJAR (load o error), sin exigir decode. */
const loaded = (img: HTMLImageElement): Promise<void> =>
  img.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });

/** Unidad MÁS CENTRAL de un stop: el polígono cuyo centroide queda más cerca del
 *  centro del render. Fallback para la unidad que "respira" cuando la 216 no está
 *  en esta vista, así siempre se resalta una unidad bien visible. */
function mostCentralUnitId(stop: Stop | undefined): string | null {
  const polys = stop?.polygons ?? [];
  if (!polys.length) return null;
  const cx = (stop?.imageWidth ?? 1920) / 2;
  const cy = (stop?.imageHeight ?? 1080) / 2;
  let bestId = polys[0].unitId;
  let bestD = Infinity;
  for (const poly of polys) {
    let sx = 0,
      sy = 0,
      n = 0;
    for (const pair of poly.points.trim().split(/\s+/)) {
      const [x, y] = pair.split(",").map(Number);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        sx += x;
        sy += y;
        n++;
      }
    }
    if (!n) continue;
    const d = (sx / n - cx) ** 2 + (sy / n - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      bestId = poly.unitId;
    }
  }
  return bestId;
}

/** Estado mutable de un arrastre en curso (vive en un ref: no dispara renders). */
interface DragState {
  startX: number;
  range: number;
  pointerId: number;
  forward: FlybySegment | null;
  back: FlybySegment | null;
  /** Hacia dónde apunta el chevron de "volver" (el avance del back es al revés). */
  backDir: "left" | "right" | null;
  decided: boolean;
  seg: FlybySegment | null;
  dir: Dir;
  /** Sentido de drag que AVANZA hacia el destino del movimiento elegido. */
  advanceDir: "left" | "right";
}

/**
 * Visor del flyby (Fase 2). Reemplaza a BuildingGallery en la home: muestra el
 * still del stop actual con su capa de polígonos interactiva (PARADO), y al tocar
 * una flecha —o al arrastrar la imagen— reproduce los frames del segmento como una
 * animación (EN TRANSICIÓN / SCRUBBING), con el overlay apagado. Al terminar queda
 * parado en el stop destino.
 *
 * La alineación de los polígonos NO depende de la resolución de los frames: el
 * `viewBox` del overlay se fija SIEMPRE al espacio nativo del stop parado, así el
 * still nítido (5000px) y los frames livianos (1080p) comparten el mismo encuadre.
 */
export function FlybyViewer({
  stops,
  units,
  segments,
  branding,
}: FlybyViewerProps) {
  const stopsById = useMemo(() => {
    const m = new Map<number, Stop>();
    for (const s of stops) m.set(s.id, s);
    return m;
  }, [stops]);

  const [phase, setPhase] = useState<Phase>("parked");
  const [currentStopId, setCurrentStopId] = useState<number>(stops[0]?.id ?? 0);
  const [showAvailability, setShowAvailability] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [masterplanOpen, setMasterplanOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  // URL del tour 360° abierto en el modal grande (null = cerrado).
  const [vr360Url, setVr360Url] = useState<string | null>(null);
  const { t } = useI18n();
  // WhatsApp del comercializador que trajo la visita (ver src/lib/origen.ts).
  const waUrl = useWhatsappUrl();
  // Ruta actual: cambia a /residencia/:id cuando se abre la ficha como overlay
  // con el showroom vivo debajo → sirve para re-primar frames al volver.
  const pathname = usePathname();
  // "Preparando" = el HEAD del segmento (RUN_GATE_FRAMES) no está decodificado a los
  // ~350ms del tap (feedback honesto en vez de un freeze mudo). Con el gate parcial el
  // head frío resuelve en ~50-120ms, así que en la práctica sólo asoma si los frames
  // ni siquiera terminaron de BAJAR (primera visita con red lenta).
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  // Espejo de `phase` para chequear DESPUÉS de un await (el closure tendría el valor viejo).
  const phaseRef = useRef<Phase>("parked");

  // Segmento en curso (transición o scrubbing); null = parado.
  const [activeSegment, setActiveSegment] = useState<FlybySegment | null>(null);

  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Suelta de una los listeners de window del gesto en curso (move/up/cancel).
  const dragAbortRef = useRef<AbortController | null>(null);
  // Mantiene el último frame montado un toque tras aterrizar, para el crossfade.
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El <img> de frames y el índice actual viven en REFS: el scrub pinta el frame
  // moviendo el `src` IMPERATIVAMENTE (sin setState), para NO re-renderizar todo el
  // árbol (overlay + hotspot + toolbar animado) en cada pointermove — ese re-render
  // por-frame saturaba el main thread y "congelaba" el scrub hasta soltar.
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const frameIdxRef = useRef(0);

  // <video> de la VISTA PARADA (cinemagraph). Es UN solo elemento persistente (sin
  // `key` por stop) para conservar el fade de opacidad del aterrizaje; al cambiar de
  // vista se recargan sus fuentes imperativamente (ver efecto más abajo).
  const parkedVideoRef = useRef<HTMLVideoElement | null>(null);
  // ¿Hay ya un listener de "reintentar play al primer gesto" armado? Red de seguridad
  // anti frame-0 (ver el efecto del video parado).
  const gestureArmedRef = useRef(false);

  // ── Mobile (táctil): el arrastre PANEA la vista actual en vez de saltar de stop;
  //    se avanza con las flechas. El render es apaisado y de alta resolución, así que
  //    en vertical entra "cortado": panear deja recorrerlo entero con el dedo. ───────
  const isTouch = useIsTouch();
  const isTouchRef = useRef(false);
  useEffect(() => {
    isTouchRef.current = isTouch;
  }, [isTouch]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Offset del paneo (px desde el centro). Vive en un ref y se aplica IMPERATIVAMENTE
  // al transform del stage (sin re-render por cada pointermove, como el scrub).
  const panRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    maxX: number;
    maxY: number;
    /** Dedo que originó el gesto: ignoramos moves/ups de OTROS punteros (multi-touch),
     *  así un segundo dedo (agarre del teléfono, palma) no dispara un pan fantasma. */
    pointerId: number;
  } | null>(null);
  const panClampRef = useRef({ maxX: 0, maxY: 0 });
  const didPanRef = useRef(false);
  // Tras panear, comemos el "click" que sintetiza el navegador para que no
  // seleccione/entre a una unidad por accidente al soltar. El timer que lo re-habilita
  // vive en un ref para poder CANCELARLO en el próximo pointerdown: si el navegador no
  // llegó a sintetizar el click del pan (se movió más que su slop), la supresión quedaba
  // armada 350ms y se comía el SIGUIENTE tap limpio → el síntoma de "2-3 toques".
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Señal para que el overlay descarte la unidad seleccionada (al empezar a panear).
  const [selResetKey, setSelResetKey] = useState(0);

  // ── Preload de TODO lo que se pinta ANTES de habilitar el flyby: los STILLS
  // nítidos de cada vista (pesados, ~5000px) Y los frames de las transiciones.
  // Clave: `decode()` resuelve cuando la imagen está DECODEADA (lista para pintar
  // sin jank), no sólo bajada — así el primer salto a una vista nueva no tiene el
  // "hitch" del último frame → still (el decode del 5000px era lo que se colaba).
  const preloadSrcs = useMemo(() => {
    const first = stops[0];
    const fwd = first ? segments.find((s) => s.from === first.id) : undefined; // 0→1
    // Con la cadena LINEAL del 27-08 no hay tramo que vuelva al primer stop, así que
    // esto queda undefined; se conserva porque el motor sí soporta anillo.
    const back = first ? segments.find((s) => s.to === first.id) : undefined;
    // El próximo avance tras el primer salto (1→2): el flujo dominante es seguir
    // girando hacia adelante, así que va ANTES que los stills lejanos y el resto de
    // segmentos — si no, al aterrizar en el stop 1 con red lenta la flecha de avanzar
    // espera detrás de ~2MB de stills que todavía no se necesitan.
    const nextFwd = fwd ? segments.find((s) => s.from === fwd.to) : undefined; // 1→2
    const reachStills = [
      fwd && stopsById.get(fwd.to)?.image,
      back && stopsById.get(back.from)?.image,
    ].filter((v): v is string => typeof v === "string");
    // ORDEN = lo que se toca primero, primero: [1] still inicial, [2] frames de los
    // segmentos alcanzables, [3] sus stills destino, [4] el próximo segmento forward,
    // [5] el resto. El Set dedup-ea y conserva el orden natural → la fase-2 (fondo)
    // baja antes lo más probable de tocar.
    return Array.from(
      new Set([
        ...(first ? [first.image] : []),
        ...(fwd ? fwd.frames : []),
        ...(back ? back.frames : []),
        ...reachStills,
        ...(nextFwd ? nextFwd.frames : []),
        ...stops.map((s) => s.image),
        ...segments.flatMap((s) => s.frames),
      ]),
    );
  }, [stops, segments, stopsById]);
  // Cache de Image() por URL: lo llena el preload y lo REUSA `ensureDecoded` para
  // re-primar bajo demanda. Clave anti-teletransporte: el navegador purga el bitmap
  // decodificado de estas imágenes (no están en el compositor) en sesiones largas;
  // re-llamar `decode()` antes de cada transición lo vuelve a dejar caliente.
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // Decodifica (o re-decodifica) UN frame reusando el Image() cacheado. Nunca rechaza.
  const decodeFrame = useCallback((src: string): Promise<void> => {
    const cache = imgCacheRef.current;
    let img = cache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      cache.set(src, img);
    }
    const p = img.decode?.();
    return p
      ? p.then(
          () => {},
          () => {},
        )
      : Promise.resolve();
  }, []);
  // Gate de REVELADO: la UI se habilita apenas la VISTA INICIAL está decodificada,
  // NO tras los ~18 MB completos. El resto (stills lejanos + 120 frames) se precarga
  // en segundo plano. El gate por-transición de run() (ensureDecoded + "Preparando")
  // cubre cualquier segmento aún frío al tocar una flecha, así que revelar antes es
  // seguro y NO reintroduce el "teletransporte".
  const [firstReady, setFirstReady] = useState(false);
  const ready = firstReady || preloadSrcs.length === 0;
  // Segmentos con TODOS sus frames ya BAJADOS (fase-2 del preload; en desktop además
  // decodificados). En táctil, las flechas aparecen recién cuando sus segmentos están
  // acá: en la PRIMERA visita los frames todavía están bajando por red cuando el
  // usuario ya ve la vista (el reveal sólo espera el still inicial), y tocar la flecha
  // en ese hueco clavaba "Preparando la vista…" esperando la red. Bajado-once alcanza:
  // después los bytes quedan locales y el decode del head entra en la espera muda del
  // gate de run(). SIN timeouts de "seguridad": mentían en redes lentas (flecha
  // visible con frames a medio bajar = tap-trampa). Desktop no aplica (intacto).
  const [warmSegs, setWarmSegs] = useState<ReadonlySet<string>>(new Set());
  const markWarm = useCallback((s: FlybySegment) => {
    setWarmSegs((prev) => {
      if (prev.has(segKey(s))) return prev;
      const next = new Set(prev);
      next.add(segKey(s));
      return next;
    });
  }, []);
  // Frames ya BAJADOS por segmento (para el pill de progreso "Cargando recorrido…").
  const [warmCounts, setWarmCounts] = useState<ReadonlyMap<string, number>>(
    new Map(),
  );
  const bumpWarmCount = useCallback((s: FlybySegment) => {
    setWarmCounts((prev) => {
      const next = new Map(prev);
      const k = segKey(s);
      next.set(k, Math.min(s.frames.length, (next.get(k) ?? 0) + 1));
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFirstReady(false);
    setWarmCounts(new Map());
    const cache = imgCacheRef.current;
    // Soltá lo que ya no está en preloadSrcs (cambio de datos), conservá el resto.
    const wanted = new Set(preloadSrcs);
    for (const key of [...cache.keys()])
      if (!wanted.has(key)) cache.delete(key);
    // En táctil la fase de fondo sólo BAJA los bytes, sin decode(): el budget móvil
    // de bitmaps decodificados evicta esos 120 decodes igual (trabajo tirado), y la
    // cola que armaban BLOQUEABA el head del próximo tap durante los primeros
    // segundos (el pill "Preparando" con los frames ya bajados). El decode fino lo
    // hacen keep-hot (segmentos alcanzables, interleaved) + onPrime + el gate de run.
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    // Baja (y opcionalmente decodifica) una fuente reusando el Image() cacheado.
    // Nunca rechaza; resuelve cuando el recurso está local (o decodificado).
    const warm = (
      src: string,
      priority: "high" | "low",
      decode: boolean,
    ): Promise<void> => {
      let img = cache.get(src);
      if (!img) {
        img = new Image();
        img.fetchPriority = priority; // ANTES de src: la vista inicial gana el ancho de banda
        img.src = src;
        cache.set(src, img);
      }
      if (!decode) return loaded(img);
      const p = img.decode?.();
      return p
        ? p.then(
            () => {},
            () => {},
          )
        : loaded(img);
    };
    const firstSrc = stops[0]?.image; // la vista que se pinta primero = el único gate
    // FASE 1 — sólo la vista inicial destraba el reveal: 1 decode (no 4) y sin
    // competir por ancho de banda con las 120 frames. Ésta SÍ decodifica siempre
    // (se pinta ya mismo).
    const gate = firstSrc ? warm(firstSrc, "high", true) : Promise.resolve();
    void gate.then(() => {
      if (cancelled) return;
      setFirstReady(true);
      // FASE 2 — el resto en segundo plano, SIN bloquear (en táctil: sólo bytes).
      for (const src of preloadSrcs)
        if (src !== firstSrc) void warm(src, "low", !coarse);
      // Bookkeeping por segmento: cada frame bajado suma progreso (pill "Cargando
      // recorrido…") y el segmento completo habilita su flecha en táctil. SIN races
      // de timeout: una flecha visible GARANTIZA que sus frames están locales — los
      // timeouts "de seguridad" mostraban flechas antes de tiempo en redes lentas y
      // el tap clavaba "Preparando la vista…" esperando la RED (el pill de progreso
      // es ahora el feedback honesto mientras tanto). Reusa los mismos Image() del
      // warm de arriba (coalescen, cero red extra).
      for (const seg of segments) {
        void Promise.all(
          seg.frames.map((src) =>
            warm(src, "low", !coarse).then(() => {
              if (!cancelled) bumpWarmCount(seg);
            }),
          ),
        )
          .then(() => {
            // Antes de habilitar la flecha, decodificá los DOS heads del segmento
            // (forward pinta 1→6, reverse pinta 30→25): recién-bajado, el decoder
            // está congestionado (keep-hot + stills) y un tap EN EL INSTANTE en que
            // aparece la flecha podía pasarse de los 350ms del gate → pill. Con el
            // head ya decodificado, "flecha visible" garantiza arranque instantáneo
            // (medido: decode de 6 heads en plena congestión ~630ms; caliente ~1ms).
            const heads = [
              ...seg.frames.slice(0, RUN_GATE_FRAMES),
              ...seg.frames.slice(-RUN_GATE_FRAMES).reverse(),
            ];
            return Promise.all(heads.map(decodeFrame));
          })
          .then(() => {
            if (!cancelled) markWarm(seg);
          });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [preloadSrcs, stops, segments, markWarm, bumpWarmCount, decodeFrame]);

  // Re-decodifica (re-prima) TODOS los frames de un segmento, EN ORDEN DE REPRODUCCIÓN
  // (`dir`): el decoder atiende los decode() más o menos en orden de llegada, así los
  // frames que la animación pinta primero se calientan primero. Sin esto, la flecha de
  // "volver" (que reproduce el segmento al revés, 29→0) esperaba justo los frames que
  // quedaban al FINAL de la cola. Resuelve cuando están todos; si el navegador los
  // purgó, los re-decodifica de los bytes ya cacheados (sin red). Nunca rechaza.
  const ensureDecoded = useCallback(
    (seg: FlybySegment, dir: Dir = "forward"): Promise<void> => {
      const ordered =
        dir === "forward" ? seg.frames : [...seg.frames].reverse();
      return Promise.all(ordered.map(decodeFrame)).then(() => undefined);
    },
    [decodeFrame],
  );

  // Re-decodifica UN still (la vista PARADA). Igual que ensureDecoded pero para una sola
  // imagen. La capa parada de arriba hace crossfade al aterrizar; si su bitmap está frío
  // (el navegador lo purgó, como con los frames), el <img> —que no tiene `key`— sigue
  // pintando el bitmap del stop ANTERIOR mientras decodifica el nuevo (5000px) → se ve un
  // "flashazo" del render viejo por ~0.45s. Manteniéndolo caliente, el swap de src
  // encuentra el bitmap listo y el crossfade entra directo al destino. Nunca rechaza.
  const ensureStillDecoded = useCallback((src?: string): Promise<void> => {
    if (!src) return Promise.resolve();
    const cache = imgCacheRef.current;
    let img = cache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      cache.set(src, img);
    }
    const p = img.decode?.();
    return p ? p.catch(() => {}) : Promise.resolve();
  }, []);

  // Cancelar cualquier animación pendiente al desmontar.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleRef.current) clearTimeout(settleRef.current);
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      dragAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Segmentos disponibles desde el stop actual.
  const forwardSeg = useMemo(
    () => segments.find((s) => s.from === currentStopId),
    [segments, currentStopId],
  );
  const backwardSeg = useMemo(
    () => segments.find((s) => s.to === currentStopId),
    [segments, currentStopId],
  );

  const currentStop = stopsById.get(currentStopId) ?? stops[0];
  // Video (cinemagraph) de la vista parada, si la vista lo tiene.
  const currentStopVideo = currentStop?.video;
  // Dimensiones nativas del render del stop (viewBox del overlay + stage de paneo).
  const imgW = currentStop?.imageWidth ?? 1920;
  const imgH = currentStop?.imageHeight ?? 1080;

  // Stage de paneo (mobile): el render se escala con "cover" sobre el contenedor y se
  // puede trasladar dentro de ese sobre-ancho/alto (clamp), sin dejar huecos al borde.
  const coverScale =
    containerSize.w > 0 && containerSize.h > 0
      ? Math.max(containerSize.w / imgW, containerSize.h / imgH)
      : 1;
  const stageW = imgW * coverScale;
  const stageH = imgH * coverScale;
  const maxPanX = Math.max(0, (stageW - containerSize.w) / 2);
  const maxPanY = Math.max(0, (stageH - containerSize.h) / 2);

  // Medí el contenedor (para el cover/clamp del paneo); se re-mide en resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyPan = useCallback((x: number, y: number) => {
    const s = stageRef.current;
    if (s) s.style.transform = STAGE_TRANSFORM(x, y);
  }, []);

  const resetPan = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    // Sólo tocamos el transform en táctil: en desktop el stage es inset-0 (sin
    // translate) y escribirle un transform lo descuadraría.
    if (isTouchRef.current && stageRef.current) {
      stageRef.current.style.transform = STAGE_TRANSFORM(0, 0);
    }
  }, []);

  const onPanMove = useCallback(
    (e: PointerEvent) => {
      const d = panStartRef.current;
      if (!d || e.pointerId !== d.pointerId) return; // sólo el dedo que inició el gesto
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!didPanRef.current) {
        if (Math.hypot(dx, dy) < TOUCH_PAN_DEADZONE) return; // todavía es un tap
        didPanRef.current = true;
        setSelResetKey((k) => k + 1); // empezar a panear descarta la selección/tooltip
        // Re-baseline: el paneo arranca desde la posición ACTUAL del dedo, sin
        // aplicar de golpe los px acumulados dentro del deadzone (con un umbral
        // más alto, ese salto inicial se notaría).
        d.startX = e.clientX;
        d.startY = e.clientY;
        return;
      }
      const nx = clampN(d.baseX + dx, -d.maxX, d.maxX);
      const ny = clampN(d.baseY + dy, -d.maxY, d.maxY);
      panRef.current = { x: nx, y: ny };
      applyPan(nx, ny);
    },
    [applyPan],
  );

  const onPanEnd = useCallback((e: PointerEvent) => {
    const d = panStartRef.current;
    if (d && e.pointerId !== d.pointerId) return; // up/cancel de otro dedo → no cierra
    dragAbortRef.current?.abort();
    dragAbortRef.current = null;
    const panned = didPanRef.current;
    didPanRef.current = false;
    panStartRef.current = null;
    if (panned) {
      suppressClickRef.current = true;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => {
        suppressClickRef.current = false;
        suppressTimerRef.current = null;
      }, 350);
    }
  }, []);

  const onPanStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (panStartRef.current) return; // ya hay un dedo activo → ignorá el segundo
      const { maxX, maxY } = panClampRef.current;
      if (maxX <= 0 && maxY <= 0) return; // nada para panear → el tap sigue funcionando
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: panRef.current.x,
        baseY: panRef.current.y,
        maxX,
        maxY,
        pointerId: e.pointerId,
      };
      didPanRef.current = false;
      dragAbortRef.current?.abort();
      const ac = new AbortController();
      dragAbortRef.current = ac;
      window.addEventListener("pointermove", onPanMove, { signal: ac.signal });
      window.addEventListener("pointerup", onPanEnd, { signal: ac.signal });
      window.addEventListener("pointercancel", onPanEnd, { signal: ac.signal });
    },
    [onPanMove, onPanEnd],
  );

  // Mantené el clamp al día y re-encuadrá si el contenedor cambió de tamaño.
  useEffect(() => {
    panClampRef.current = { maxX: maxPanX, maxY: maxPanY };
    if (!isTouchRef.current) return;
    const nx = clampN(panRef.current.x, -maxPanX, maxPanX);
    const ny = clampN(panRef.current.y, -maxPanY, maxPanY);
    if (nx !== panRef.current.x || ny !== panRef.current.y) {
      panRef.current = { x: nx, y: ny };
      applyPan(nx, ny);
    }
  }, [maxPanX, maxPanY, applyPan]);

  // A PROPÓSITO no reseteamos el paneo al cambiar de vista: la transición arranca y
  // aterriza en el encuadre donde el usuario dejó la imagen (ver `run`). El efecto de
  // clamp de arriba lo reencuadra a los límites de la vista nueva si hiciera falta.

  // Logo / "volver al inicio": primera vista, centrada, sin menúes abiertos.
  const goToStart = useCallback(() => {
    setMenuOpen(false);
    if (phaseRef.current !== "parked") return;
    resetPan();
    const first = stops[0];
    if (first) setCurrentStopId(first.id);
  }, [resetPan, stops]);

  // ¿Hay un overlay PESADO encima del visor? El modal 360° (iframe Kuula), la galería
  // de renders full, el masterplan o la FICHA de unidad como overlay (la URL pasa a
  // /residencia/:id con el showroom vivo debajo). Todos presionan la memoria y el
  // navegador purga los bitmaps decodificados de los frames del flyby.
  const heavyOverlayOpen =
    !!vr360Url ||
    galleryOpen ||
    masterplanOpen ||
    finderOpen ||
    (pathname?.includes("/residencia") ?? false);

  // Mantené CALIENTES los segmentos alcanzables desde el stop actual: re-primá su decode
  //   (1) al aterrizar en una vista nueva (forwardSeg/backwardSeg cambian), y
  //   (2) cuando el visor VUELVE al frente al cerrarse un overlay pesado.
  // Sin (2), tras salir del 360° o de una unidad los frames quedaban fríos → la próxima
  // flecha disparaba "Preparando la vista…" y un arranque tosco (~0.25s). Al re-primar
  // en cuanto se cierra el overlay, la transición vuelve a arrancar instantánea.
  useEffect(() => {
    if (!ready || heavyOverlayOpen) return;
    // Decode INTERLEAVADO: primero el HEAD de cada dirección (lo que un tap inmediato
    // pinta ya), después el resto. Encolar 30+30 lineales dejaba el head de "volver"
    // al fondo de la cola del decoder y un tap rápido tras aterrizar lo esperaba.
    // (Las flechas en táctil ya las habilita la fase-2 del preload vía markWarm.)
    const fwdFrames = forwardSeg?.frames ?? [];
    const bkFrames = backwardSeg ? [...backwardSeg.frames].reverse() : [];
    const queue = [
      ...fwdFrames.slice(0, RUN_GATE_FRAMES),
      ...bkFrames.slice(0, RUN_GATE_FRAMES),
      ...fwdFrames.slice(RUN_GATE_FRAMES),
      ...bkFrames.slice(RUN_GATE_FRAMES),
    ];
    for (const src of queue) void decodeFrame(src);
    // Además de los frames, mantené caliente el STILL del stop al que aterriza cada
    // segmento (forward → .to, back → .from): evita el "flashazo" del render anterior.
    if (forwardSeg)
      void ensureStillDecoded(stopsById.get(forwardSeg.to)?.image);
    if (backwardSeg)
      void ensureStillDecoded(stopsById.get(backwardSeg.from)?.image);
  }, [
    ready,
    heavyOverlayOpen,
    forwardSeg,
    backwardSeg,
    decodeFrame,
    ensureStillDecoded,
    stopsById,
  ]);

  // Al volver la pestaña a foreground, re-primá: estuvo en background y el navegador
  // es MÁS agresivo purgando decodes de tabs ocultas.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !ready) return;
      if (forwardSeg) {
        void ensureDecoded(forwardSeg, "forward");
        void ensureStillDecoded(stopsById.get(forwardSeg.to)?.image);
      }
      if (backwardSeg) {
        void ensureDecoded(backwardSeg, "reverse");
        void ensureStillDecoded(stopsById.get(backwardSeg.from)?.image);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [
    ready,
    forwardSeg,
    backwardSeg,
    ensureDecoded,
    ensureStillDecoded,
    stopsById,
  ]);

  // Reproducción del <video> de la vista parada al montar y al cambiar de stop.
  //
  // Cambiar los <source> por React NO recarga el elemento (seguiría mostrando el video
  // de la vista anterior), así que llamamos `load()` a mano. PERO `load()` aborta con
  // AbortError cualquier `play()` pendiente y resetea readyState a 0: llamar play()
  // sincrónicamente justo después es una carrera que en PRODUCCIÓN (latencia de red +
  // sin el doble-invoke de StrictMode que sí hay en dev) pierde → el video queda
  // congelado en el poster (frame 0). Por eso disparamos play() recién cuando hay datos
  // ('loadeddata'/'canplay' o readyState>=2). Elemento persistente (sin key) → conserva
  // el fade de opacidad del aterrizaje.
  useEffect(() => {
    const v = parkedVideoRef.current;
    if (!v || !currentStopVideo) return;

    const ac = new AbortController();

    // `muted` por PROPIEDAD (no sólo atributo JSX): React no lo aplica confiable con
    // SSR/hydration, y un <video> no realmente muteado tiene el autoplay bloqueado.
    v.muted = true;
    v.style.visibility = ""; // limpiar un hide previo (onError de otra vista)

    // Reintento al primer gesto del usuario: red de seguridad para que NUNCA quede
    // trabado en el frame 0 aunque un navegador rechace el primer play() programático.
    const armGestureFallback = () => {
      if (gestureArmedRef.current) return;
      gestureArmedRef.current = true;
      const onGesture = () => {
        window.removeEventListener("pointerdown", onGesture);
        window.removeEventListener("keydown", onGesture);
        gestureArmedRef.current = false;
        const cur = parkedVideoRef.current; // el elemento vivo, no un `v` viejo
        if (cur) {
          cur.muted = true;
          cur.play().catch(() => {});
        }
      };
      // Sin el signal del efecto: debe SOBREVIVIR a su cleanup (al cambiar de stop).
      window.addEventListener("pointerdown", onGesture);
      window.addEventListener("keydown", onGesture);
    };

    const tryPlay = () => {
      const p = v.play();
      if (!p) return;
      p.catch((err: unknown) => {
        // AbortError = otra navegación interrumpió este play(): esperado, ignorar.
        if (err instanceof DOMException && err.name === "AbortError") return;
        armGestureFallback();
      });
    };

    v.load();
    // Con un frame ya disponible, play() no corre contra buffer vacío; si no, esperar.
    if (v.readyState >= 2) {
      tryPlay();
    } else {
      v.addEventListener("loadeddata", tryPlay, {
        once: true,
        signal: ac.signal,
      });
      v.addEventListener("canplay", tryPlay, { once: true, signal: ac.signal });
    }

    // Al cambiar de stop/desmontar: soltar los listeners de readiness de ESTE efecto,
    // así un play() viejo no se dispara sobre la fuente nueva.
    return () => ac.abort();
  }, [currentStopId, currentStopVideo]);

  // Pinta un frame del scrub/transición SIN pasar por React: mueve el `src` del
  // <img> y guarda el índice en un ref. Fuera del camino de React → sin re-render.
  const paintFrame = useCallback((seg: FlybySegment, idx: number) => {
    const img = frameImgRef.current;
    if (img && idx !== frameIdxRef.current) {
      const src = seg.frames[idx];
      if (src) img.src = src;
    }
    frameIdxRef.current = idx;
  }, []);

  // ── Animación (rAF) entre dos progresos. La usan el chevron (0→1) y el soltar
  //    del drag (progreso actual → 1 si commit, → 0 si se cancela). ───────────────
  const animate = useCallback(
    (
      segment: FlybySegment,
      dir: Dir,
      fromP: number,
      toP: number,
      settleStop: number,
    ) => {
      const N = segment.frames.length;
      if (N === 0) return;
      // Pre-decodificá el STILL del stop de ATERRIZAJE ahora (arranca en paralelo a la
      // animación de ~650ms) → cuando aterrizamos, el crossfade de la vista parada ya
      // tiene su bitmap listo y NO muestra el render del stop anterior (el "flashazo").
      // Va acá (no sólo en run) para cubrir TAMBIÉN el aterrizaje por drag (onWindowEnd).
      void ensureStillDecoded(stopsById.get(settleStop)?.image);
      // Preseteá el índice inicial: si el <img> monta ahora (chevron), arranca en el
      // frame correcto (su `src` del JSX lee este ref) sin parpadeo del frame previo.
      frameIdxRef.current = frameAtProgress(N, dir, fromP);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleRef.current) {
        clearTimeout(settleRef.current);
        settleRef.current = null;
      }
      setActiveSegment(segment);
      setPhase("transitioning");

      const dist = Math.abs(toP - fromP);
      const dur = Math.max(90, TRANSITION_MS * dist); // proporcional a lo que falta
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const t = dist === 0 ? 1 : Math.min(1, (ts - start) / dur);
        paintFrame(segment, frameAtProgress(N, dir, fromP + (toP - fromP) * t));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          paintFrame(segment, frameAtProgress(N, dir, toP));
          setCurrentStopId(settleStop);
          setPhase("parked");
          // Mantené el último frame un toque más mientras el still nítido hace
          // crossfade encima (tapa el re-decode del 5000px la 1ª vez); después soltalo.
          settleRef.current = setTimeout(() => {
            setActiveSegment(null);
            settleRef.current = null;
          }, 480);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [paintFrame, ensureStillDecoded, stopsById],
  );

  const run = useCallback(
    (segment: FlybySegment, dir: Dir) => {
      if (phase !== "parked" || !ready || preparingRef.current) return;
      // NO reseteamos el paneo: la transición arranca (y aterriza) en el MISMO encuadre
      // donde el usuario dejó la vista, en vez de forzar el centro (se sentía tosco).
      const dest = dir === "forward" ? segment.to : segment.from;
      // GATE anti-teletransporte, ahora PARCIAL: sólo se esperan los primeros
      // RUN_GATE_FRAMES en orden de reproducción (los que se pintan ya); el resto
      // queda decodificando EN PARALELO mientras la animación corre, y le lleva
      // ventaja siempre (ver nota de RUN_GATE_FRAMES). Gatear los 30 frames metía
      // un hueco mudo de ~150-300ms entre el tap y el arranque en mobile (donde el
      // budget de bitmaps decodificados no retiene un segmento de ~250MB RGBA).
      // "Preparando" queda como fallback honesto si ni el head está a los 350ms
      // (primera bajada con red lenta), con respaldo a 2.5s para no colgarse nunca.
      const ordered =
        dir === "forward" ? segment.frames : [...segment.frames].reverse();
      preparingRef.current = true;
      const slow = setTimeout(() => setPreparing(true), 350);
      const head = Promise.all(
        ordered.slice(0, RUN_GATE_FRAMES).map(decodeFrame),
      );
      // El resto en vuelo, mismo orden de reproducción, sin gatear el arranque.
      for (const src of ordered.slice(RUN_GATE_FRAMES)) void decodeFrame(src);
      void Promise.race([
        head,
        new Promise<void>((r) => setTimeout(r, 2500)),
      ]).then(() => {
        clearTimeout(slow);
        setPreparing(false);
        preparingRef.current = false;
        if (phaseRef.current !== "parked") return; // dejó de estar parado mientras tanto
        animate(segment, dir, 0, 1, dest);
      });
    },
    [phase, ready, animate, decodeFrame],
  );

  // ── Drag para scrubbear los frames a mano (mouse + touch). El move/up/cancel se
  //    escuchan en WINDOW (no en el contenedor): así el scrub SIGUE al mouse aunque
  //    el gesto arranque sobre un polígono u otro hijo, sin depender del
  //    pointer-events de los hijos ni de setPointerCapture (que encima rompería el
  //    click sobre la unidad). Los listeners se sueltan con un AbortController. ─────
  const onWindowMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaX = e.clientX - d.startX;

      if (!d.decided) {
        if (Math.abs(deltaX) < DRAG_DEADZONE) return; // todavía es un click, no un drag
        // "Agarrá y tirá" (panorama): arrastrar mueve la escena con el cursor, así que
        // la cámara va al lado CONTRARIO. Para avanzar un movimiento cuyo chevron apunta
        // a la IZQUIERDA (ej.: ir a view 2) se arrastra hacia la DERECHA, y viceversa.
        let seg: FlybySegment | null = null;
        let dir: Dir = "forward";
        let advanceDir: "left" | "right" = "right";
        if (deltaX > 0) {
          // drag a la derecha → cámara a la izquierda → movimiento con chevron "left"
          if (d.forward && d.forward.dir === "left") {
            seg = d.forward;
            dir = "forward";
            advanceDir = "right";
          } else if (d.back && d.backDir === "left") {
            seg = d.back;
            dir = "reverse";
            advanceDir = "right";
          }
        } else {
          // drag a la izquierda → cámara a la derecha → movimiento con chevron "right"
          if (d.forward && d.forward.dir === "right") {
            seg = d.forward;
            dir = "forward";
            advanceDir = "left";
          } else if (d.back && d.backDir === "right") {
            seg = d.back;
            dir = "reverse";
            advanceDir = "left";
          }
        }
        if (!seg) return; // ese sentido de drag no lleva a ninguna vista
        d.decided = true;
        d.seg = seg;
        d.dir = dir;
        d.advanceDir = advanceDir;
        // Si el salto anterior sigue en su ventana de "settle" (frames montados, a punto
        // de soltarse a los 480ms), CANCELÁ ese timeout. Si no, dispara a mitad de ESTE
        // scrub y hace setActiveSegment(null) → desmonta los frames → el drag se "rompe".
        // Esto es lo que pasaba al re-arrastrar rápido sin esperar a que aterrice el salto.
        if (settleRef.current) {
          clearTimeout(settleRef.current);
          settleRef.current = null;
        }
        setActiveSegment(seg);
        setPhase("scrubbing");
      }

      if (d.decided && d.seg) {
        const along = d.advanceDir === "left" ? -deltaX : deltaX;
        const p = clamp01(along / d.range);
        paintFrame(d.seg, frameAtProgress(d.seg.frames.length, d.dir, p));
      }
    },
    [paintFrame],
  );

  const onWindowEnd = useCallback(
    (e: PointerEvent) => {
      dragAbortRef.current?.abort();
      dragAbortRef.current = null;
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.decided || !d.seg) return; // fue un click, no un drag
      const deltaX = e.clientX - d.startX;
      const along = d.advanceDir === "left" ? -deltaX : deltaX;
      const p = clamp01(along / d.range);
      const seg = d.seg;
      const dir = d.dir;
      const dest = dir === "forward" ? seg.to : seg.from;
      const origin = dir === "forward" ? seg.from : seg.to;
      // Soltaste avanzando → completá hasta el destino; casi sin moverte → volvé.
      if (p >= COMMIT_PROGRESS) animate(seg, dir, p, 1, dest);
      else animate(seg, dir, p, 0, origin);
    },
    [animate],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (phase !== "parked" || !ready) return;
      // Un gesto NUEVO borra cualquier supresión de click que dejó el anterior: si un
      // pan previo se movió más que el slop del navegador, este NUNCA sintetizó el click
      // que la supresión esperaba comer, y el flag quedaba armado 350ms comiéndose el
      // próximo tap limpio (el síntoma de "2-3 toques"). El click del gesto anterior ya
      // se disparó (o no) antes de este pointerdown, así que limpiar acá es seguro.
      if (suppressTimerRef.current) {
        clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = null;
      }
      suppressClickRef.current = false;
      // No secuestres gestos que arrancan sobre un control (botón, link, toggle) ni sobre
      // la TARJETA flotante de la unidad ([role='button']): sin exceptuarla, un pointerdown
      // sobre la tarjeta armaba el pan tracker y, si el dedo rodaba, se deseleccionaba la
      // unidad y la tarjeta se desmontaba bajo el dedo (el tap de "entrar" moría).
      // El pre-prime del tap sobre una FLECHA vive en la flecha misma (onPrime):
      // primar acá LOS DOS segmentos encolaba 60 decodes con forward siempre primero,
      // y el gate de la flecha de volver quedaba esperando detrás de la cola ajena.
      if (
        (e.target as Element).closest?.(
          "button, a, [role='switch'], [role='button']",
        )
      )
        return;
      // Mobile: el arrastre PANEA la vista (no salta de stop). Se avanza con flechas.
      if (isTouch) {
        onPanStart(e);
        return;
      }
      const fwd =
        forwardSeg && forwardSeg.frames.length > 0 ? forwardSeg : null;
      const bk =
        backwardSeg && backwardSeg.frames.length > 0 ? backwardSeg : null;
      if (!fwd && !bk) return;
      // Pre-primá los frames apenas tocás: para cuando sueltes el drag ya están listos.
      if (fwd) void ensureDecoded(fwd, "forward");
      if (bk) void ensureDecoded(bk, "reverse");
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX,
        range: Math.max(120, rect.width * DRAG_RANGE_FACTOR),
        pointerId: e.pointerId,
        forward: fwd,
        back: bk,
        backDir: bk ? (bk.dir === "left" ? "right" : "left") : null,
        decided: false,
        seg: null,
        dir: "forward",
        advanceDir: "left",
      };
      // Mientras dure ESTE gesto, el move/up van a window (scrub siempre dinámico).
      dragAbortRef.current?.abort();
      const ac = new AbortController();
      dragAbortRef.current = ac;
      window.addEventListener("pointermove", onWindowMove, {
        signal: ac.signal,
      });
      window.addEventListener("pointerup", onWindowEnd, { signal: ac.signal });
      window.addEventListener("pointercancel", onWindowEnd, {
        signal: ac.signal,
      });
    },
    [
      phase,
      ready,
      isTouch,
      onPanStart,
      forwardSeg,
      backwardSeg,
      onWindowMove,
      onWindowEnd,
      ensureDecoded,
    ],
  );

  // ── Disponibilidad de las flechas y el pill de carga.
  //
  // Va ANTES del early return de abajo porque de acá cuelga un hook, y los hooks tienen
  // que correr siempre en el mismo orden. Nada de esto depende de `currentStop`.

  // Una flecha "existe" si su segmento tiene frames (datos sanos).
  const expectBack = !!backwardSeg && backwardSeg.frames.length > 0;
  const expectForward = !!forwardSeg && forwardSeg.frames.length > 0;
  // Las flechas del stop aparecen JUNTAS recién cuando sus segmentos están BAJADOS y
  // con el head decodificado (`warmSegs`, sin timeouts de seguridad: mentían en redes
  // lentas). Mientras tanto el pill "Cargando recorrido… %" es el feedback honesto.
  //
  // El gate era SÓLO táctil (`!isTouch ||`). En desktop las flechas salían apenas
  // decodificaba el still inicial —el reveal gatea 0,4 MB— con los ~3,9 MB de frames
  // del tramo todavía bajando: un click apenas entrás a /showroom caía en ese hueco y
  // se comía medio segundo de "Preparando la vista…" esperando la RED (reportado el
  // 27-08 en el 0→1, que es justo el caso: primera vista, primer click). Ahora aplica
  // en los dos: flecha visible ⇒ frames locales y head caliente ⇒ arranque instantáneo.
  const navWarm =
    (!expectBack || warmSegs.has(segKey(backwardSeg!))) &&
    (!expectForward || warmSegs.has(segKey(forwardSeg!)));
  const navLoading =
    phase === "parked" && ready && (expectBack || expectForward) && !navWarm;

  // El pill sale recién si la espera DURA (ver NAV_PILL_DELAY_MS), y una vez visible se
  // queda un mínimo. `navLoading` es la condición CRUDA —true por un instante en cada
  // montaje, porque `warmSegs` arranca vacío, incluso con todo en la cache del disco—;
  // `navPill` es la que se pinta.
  const [navPill, setNavPill] = useState(false);
  const navPillAtRef = useRef(0);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    if (navLoading) {
      id = setTimeout(() => {
        navPillAtRef.current = Date.now();
        setNavPill(true);
      }, NAV_PILL_DELAY_MS);
    } else {
      // Si nunca llegó a aparecer (`navPillAtRef` en 0) se apaga ya, sin parpadeo.
      const visibleDesde = navPillAtRef.current;
      const resto = visibleDesde
        ? NAV_PILL_MIN_MS - (Date.now() - visibleDesde)
        : 0;
      id = setTimeout(
        () => {
          navPillAtRef.current = 0;
          setNavPill(false);
        },
        Math.max(0, resto),
      );
    }
    return () => clearTimeout(id);
  }, [navLoading]);

  if (!currentStop) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-tier-dark text-faint">
        <p>stops.json vacío — sin vistas para mostrar.</p>
      </div>
    );
  }

  const parked = phase === "parked";

  // viewBox del overlay = espacio nativo del stop parado (imgW/imgH, ya calculados).
  const vbWidth = imgW;
  const vbHeight = imgH;

  // Unidad que "respira" (contorno pulsante, pista de interacción). Decisión con el
  // cliente: SÓLO en la vista principal (stop 0, la primera que ve el usuario) y sobre
  // la 216 (existe en la geometría de PROD/Netlify aunque no en el seed local; si no
  // está —ej. local— caemos a la más CENTRAL). En las demás vistas no respira nada.
  const isStartStop = currentStopId === stops[0]?.id;
  const breathingUnitId = !isStartStop
    ? null
    : currentStop.polygons.some((p) => p.unitId === "216")
      ? "216"
      : mostCentralUnitId(currentStop);

  // Stage de paneo: en táctil (ya medido) el render se sobre-dimensiona y se traslada;
  // en desktop ocupa todo el contenedor (inset-0) sin transform, como siempre.
  const useStage = isTouch && containerSize.w > 0 && containerSize.h > 0;
  const stageClassName = useStage ? "absolute" : "absolute inset-0";
  const stageStyle: CSSProperties | undefined = useStage
    ? {
        width: stageW,
        height: stageH,
        left: "50%",
        top: "50%",
        transform: STAGE_TRANSFORM(panRef.current.x, panRef.current.y),
        willChange: "transform",
      }
    : undefined;

  // Hotspot 360° de la vista actual (si tiene). Se apaga durante el movimiento.
  const hotspot = VR_HOTSPOTS[currentStop.id];

  const showBack = parked && ready && expectBack && navWarm;
  const showForward = parked && ready && expectForward && navWarm;
  const canDrag = showBack || showForward;
  // Progreso de descarga de los segmentos de ESTE stop (para el pill).
  const navTotal =
    (expectForward ? forwardSeg!.frames.length : 0) +
    (expectBack ? backwardSeg!.frames.length : 0);
  const navDone = Math.min(
    navTotal,
    (expectForward ? (warmCounts.get(segKey(forwardSeg!)) ?? 0) : 0) +
      (expectBack ? (warmCounts.get(segKey(backwardSeg!)) ?? 0) : 0),
  );
  const navPct = navTotal > 0 ? Math.round((100 * navDone) / navTotal) : 100;

  // ── Hacia qué lado apunta cada flecha.
  //
  // El chevron sale del `dir` del SEGMENTO —hacia dónde manda la cámara ese movimiento—,
  // que es el mismo dato que decide el sentido del arrastre. Antes el chevron estaba
  // HARDCODEADO (forward siempre "left") e ignoraba `dir`, así que podía contradecir al
  // drag; ahora los dos leen lo mismo y no pueden desincronizarse.
  //
  // En TIER Bravo avanzar mueve la cámara a la DERECHA, así que avanzar es la flecha
  // derecha (corrección de Juani, 27-08). La prueba está en el propio render: al pasar
  // de la vista 1 a la 2 quedás por DETRÁS de la puerta del garaje, no por delante —si
  // la cámara fuera hacia la izquierda sería al revés—, y medido sobre los frames el
  // contenido barre hacia la izquierda, que es lo mismo dicho al revés.
  const fwdChevron: "left" | "right" =
    forwardSeg?.dir === "right" ? "right" : "left";
  // Volver es reproducir su segmento AL REVÉS: la cámara va al lado contrario de su `dir`.
  const backChevron: "left" | "right" =
    backwardSeg?.dir === "right" ? "left" : "right";
  const arrowFwd =
    showForward && forwardSeg ? (
      <FlybyArrow
        dir={fwdChevron}
        label={t.flyby.forwardToView(forwardSeg.to)}
        onClick={() => run(forwardSeg, "forward")}
        onPrime={() => void ensureDecoded(forwardSeg, "forward")}
      />
    ) : null;
  const arrowBack =
    showBack && backwardSeg ? (
      <FlybyArrow
        dir={backChevron}
        label={t.flyby.backToView(backwardSeg.from)}
        onClick={() => run(backwardSeg, "reverse")}
        onPrime={() => void ensureDecoded(backwardSeg, "reverse")}
      />
    ) : null;
  // Y la POSICIÓN acompaña al chevron: la que apunta a la izquierda va a la izquierda
  // del rótulo "Girar". Se reparte por slot y no por rol (avanzar/volver) porque en las
  // puntas de la cadena hay una sola flecha y tiene que caer del lado que mira.
  const arrowSlots: Record<"left" | "right", ReactNode> = {
    left: null,
    right: null,
  };
  if (arrowFwd) arrowSlots[fwdChevron] = arrowFwd;
  if (arrowBack) arrowSlots[backChevron] = arrowBack;

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full touch-none select-none overflow-hidden bg-tier-dark"
      style={{
        cursor: isTouch
          ? "default"
          : phase === "scrubbing"
            ? "grabbing"
            : canDrag
              ? "grab"
              : "default",
      }}
      onPointerDown={onPointerDown}
      // Tras un paneo (mobile) comemos el click que sigue, para que no
      // seleccione/entre a una unidad sin querer.
      onClickCapture={(e) => {
        if (!suppressClickRef.current) return;
        // Dejá pasar los CONTROLES (flechas, menú, switch) y la TARJETA de la unidad
        // ([role='button']): el supresor sólo evita que el "click" sintético tras un pan
        // seleccione/entre a una unidad sin querer, no que se pueda tocar "entrar".
        if (
          (e.target as Element).closest?.(
            "button, a, [role='switch'], [role='button']",
          )
        )
          return;
        suppressClickRef.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {/* Stage: agrupa las capas del render + el overlay de polígonos + el hotspot,
          para que el PANEO (mobile) las traslade JUNTAS y sigan alineadas. En desktop
          es inset-0 (todo el contenedor), sin transform. */}
      <div ref={stageRef} className={stageClassName} style={stageStyle}>
        {/* Capa de FONDO permanente: el still del stop actual, SIEMPRE opaco y sin
          animación. Es la red de seguridad anti-negro: durante el SCRUB, cuando el
          <img> de frames (recién montado, o re-decodificando al cambiar de src en
          cada pointermove) tarda un tick en pintar, lo que se ve por debajo es este
          still nítido —NO el bg-tier-dark—. Usa el mismo encuadre/clases que el
          still de arriba, así queda pixel-perfect detrás y NO toca el crossfade de
          aterrizaje (que sigue haciéndose entre la capa de frames y el still de arriba). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentStop.image}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />

        {/* Frames de la transición (capa media). Quedan montados un toque tras
          aterrizar para que el still de arriba haga crossfade encima sin corte. */}
        {activeSegment && (
          // El src inicial lo lee del ref (frame correcto al montar); a partir de ahí
          // `paintFrame` mueve el src imperativamente, sin re-render. `decoding="sync"`
          // evita el lag del decode asíncrono al cambiar de frame durante el scrub.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={frameImgRef}
            src={activeSegment.frames[frameIdxRef.current] ?? currentStop.image}
            alt={t.flyby.frameAlt}
            className="absolute inset-0 h-full w-full object-cover"
            decoding="sync"
            draggable={false}
          />
        )}

        {/* Vista PARADA (capa de arriba). Fade-OUT instantáneo al arrancar (sin
          fantasma) y fade-IN suave al aterrizar: tapa el "pop" frame→vista de la
          primera vez. Si el stop trae `video` (cinemagraph), la vista parada es el
          video en loop muteado; si no, el still. Ambos comparten clases/encuadre y
          la MISMA lógica de opacidad, así el crossfade de aterrizaje no cambia. El
          poster (= image = frame 0 del video) se ve al instante mientras decodea. */}
        {currentStopVideo ? (
          <video
            // Elemento persistente (sin key): el efecto de arriba le hace load() al
            // cambiar de stop. Sin key, la opacidad transiciona 0→1 al aterrizar (fade),
            // en vez de aparecer de golpe como haría un remount.
            ref={parkedVideoRef}
            poster={currentStop.image}
            aria-hidden="true"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover transition-opacity ease-out"
            style={{
              opacity: parked ? 1 : 0,
              transitionDuration: parked ? "450ms" : "0ms",
            }}
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          >
            {/* webm primero (más liviano donde se soporta), mp4 de fallback (Safari/iOS).
              El webm es hermano del mp4 (mismo nombre) — lo produce stops:optimize. */}
            <source
              src={currentStopVideo.replace(/\.mp4$/, ".webm")}
              type="video/webm"
            />
            <source src={currentStopVideo} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentStop.image}
            alt={t.flyby.stillAlt(currentStop.id)}
            className="absolute inset-0 h-full w-full object-cover transition-opacity ease-out"
            style={{
              opacity: parked ? 1 : 0,
              transitionDuration: parked ? "450ms" : "0ms",
            }}
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        )}

        <InteractiveOverlay
          stop={currentStop}
          units={units}
          width={vbWidth}
          height={vbHeight}
          active={parked}
          showAvailability={showAvailability}
          isTouch={isTouch}
          // Sólo respira cuando la vista YA cargó (`ready`) y está parada: así el
          // contorno aparece junto con el render, no sobre la pantalla negra de carga.
          breathingUnitId={parked && ready ? breathingUnitId : null}
          resetKey={selResetKey}
        />

        {hotspot && (
          <VrHotspot
            stop={currentStop}
            x={hotspot.x}
            y={hotspot.y}
            scale={hotspot.scale}
            active={parked}
            previewImage={hotspot.previewImage}
            previewImages={hotspot.previewImages}
            previewKind={hotspot.previewKind}
            isTouch={isTouch}
            resetKey={selResetKey}
            // La fila ‹ GIRAR › aparece DESPUÉS que la bolita (recién cuando los
            // frames del stop están bajados). La bolita tiene que volver a medir
            // cuando eso pasa: si no, se ubicó cuando no había nada que esquivar y
            // se queda quieta mientras los controles le crecen encima.
            controlesVisibles={(showBack || showForward) && !preparing}
            onOpen={
              hotspot.kuulaUrl
                ? () => setVr360Url(hotspot.kuulaUrl!)
                : undefined
            }
          />
        )}
      </div>
      {/* /stage */}

      {branding && (
        // ≥560px (tablets/desktop): el logo va suelto ARRIBA A LA IZQUIERDA, al lado
        // de la barra de acciones. `top-7` y no `top-4` (pedido del cliente, 26-08:
        // "un poco más bajo"): el lockup quedaba pegado al borde y desalineado.
        // <560px NO se pinta acá: viaja DENTRO de la barra de acciones (que en
        // teléfonos es una fila de borde a borde), así el logo deja de necesitar una
        // banda propia sobre el render.
        <div className="absolute left-4 top-7 z-20 hidden max-w-[80vw] items-center gap-3 min-[560px]:flex">
          {/* Salida a la portada de TIER. Acá hay lugar de sobra, así que va visible
              al lado del logotipo; en teléfono vive en la segunda fila (ver
              VolverAPortada). ⚠ NO se puede reusar el logotipo para esto: su click
              ya es "volver a la primera vista", que es la única forma de resetear el
              recorrido (el item "Inicio" del menú sólo cierra el menú). */}
          <VolverAPortada className="h-10 w-10 bg-tier-dark/80 shadow-lg ring-1 ring-line backdrop-blur" />
          {/* El logo SIEMPRE vuelve al inicio (primera vista, centrada). */}
          <button
            type="button"
            onClick={goToStart}
            aria-label={t.flyby.home}
            title={t.flyby.home}
            className="block cursor-pointer transition active:scale-95"
          >
            {branding}
          </button>
        </div>
      )}

      <ShowroomToolbar
        showAvailability={showAvailability}
        onToggleAvailability={setShowAvailability}
        consultHref={waUrl(t.wa.general)}
        branding={branding}
        onBrandingClick={goToStart}
        brandingLabel={t.flyby.home}
        onOpenMenu={() => {
          // Cerrar el hover/selección de unidad (mobile): su tarjeta vive en un portal
          // por encima del panel y, si no, queda tapando el sidebar al abrirlo.
          setSelResetKey((k) => k + 1);
          setMenuOpen(true);
        }}
      />

      {/* Debajo de la toolbar: la LUPA del buscador de unidades + el badge de avance
          de obra. La lupa va a la IZQUIERDA del avance (pedido del cliente).
          En teléfonos comparte renglón con el switch "Disponibilidad" (que va a la
          izquierda de esa misma banda) en vez de bajar a una tercera fila. */}
      <div
        className="absolute right-3 top-[66px] z-30 flex h-10 items-center gap-2 min-[560px]:right-4 min-[560px]:h-auto min-[560px]:top-[76px]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            setFinderOpen(true);
          }}
          aria-label={t.finder.open}
          title={t.finder.open}
          className="finder-lupa grid h-full w-9 place-items-center rounded-xl bg-tier-dark/80 text-ink shadow-lg ring-1 ring-line backdrop-blur transition hover:bg-tier-dark min-[560px]:h-9 sm:h-10 sm:w-10"
        >
          <span className="finder-sonar-ring" aria-hidden />
          <SearchIcon width={20} height={20} className="finder-lupa-glyph" />
        </button>
        {/* `h-full`: la fila mide 40px en teléfonos y el badge, con su padding
            inline, se quedaba en 32 — más bajo que la lupa de al lado. De 560px
            para arriba la fila no tiene alto fijo y esto no hace nada. */}
        <AvanceBadge className="h-full" />
      </div>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelectAvailability={() => setShowAvailability(true)}
        onMasterplan={() => setMasterplanOpen(true)}
        onContact={() => setContactOpen(true)}
        onGallery={() => setGalleryOpen(true)}
        consultHref={waUrl(t.wa.general)}
        // El acceso al editor de polígonos se dejó fuera del front de producción.
        // El editor sigue EN EL CÓDIGO (herramienta interna reutilizable en futuros
        // showrooms) pero no se expone por ninguna URL: para reactivarlo, setear
        // ENABLE_POLYGON_EDITOR=true y volver a pasar `polygonEditorHref` acá.
        showProjectSections
      />

      <MasterplanModal
        open={masterplanOpen}
        onClose={() => setMasterplanOpen(false)}
        units={units}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <GalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      {/* Buscador de unidades: recibe las unidades EN VIVO (ya mergeadas con Airtable)
          para no re-fetchear; la lupa de arriba y el item del menú lo abren. */}
      <UnitFinderModal
        open={finderOpen}
        onClose={() => setFinderOpen(false)}
        units={units}
      />
      <Vr360Modal src={vr360Url} onClose={() => setVr360Url(null)} />

      {/* Controles del flyby (abajo, centro). Ocultos mientras se mueve o prepara.
          El texto "Girar" entre las flechas deja claro que rotan la vista del edificio.
          Arriba iba una ayuda fija ("Pasá el cursor sobre una unidad…"): la sacó el
          cliente (25-08) porque tapaba el render y la unidad que respira ya invita sola
          a interactuar. */}
      {(showBack || showForward) && !preparing && (
        // El contenedor es full-width pero TRANSPARENTE al puntero (pointer-events-none):
        // si capturara eventos en su caja vacía, taparía la mitad inferior de la bolita
        // 360° que queda debajo (bug del hover a medias). Sólo la fila de flechas
        // reactiva los eventos, que es donde de verdad hay controles.
        // `bottom-2` en pantalla BAJA (teléfono acostado) y `bottom-6` en el resto:
        // ahí el alto es el recurso escaso y esos 16px son los que le devuelven aire
        // a la bolita 360°, que en apaisado tiene que convivir con esta fila justo
        // donde cae la puerta del edificio (ver VrHotspot).
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex items-center justify-center px-4 [@media(max-height:560px)]:bottom-2">
          {/* `data-flyby-controles`: es lo que mide la bolita 360° para saber qué zona
              NO puede ocupar. Va acá, en la fila de verdad —no en el contenedor
              full-width, que es transparente al puntero y ocuparía toda la pantalla—
              así la reserva es exactamente el rectángulo que se ve. */}
          <div data-flyby-controles className="pointer-events-auto flex items-center gap-4">
            {arrowSlots.left}
            <span className="pointer-events-none select-none rounded-full bg-tier-dark/80 px-3 py-1.5 text-[15px] font-semibold uppercase tracking-[0.18em] text-ink shadow-lg ring-1 ring-line backdrop-blur">
              {t.flyby.rotateLabel}
            </span>
            {arrowSlots.right}
          </div>
        </div>
      )}

      {!ready && (
        // Gate = sólo la vista inicial (una imagen), así que no hay % que mostrar:
        // un indicador indeterminado breve mientras decodifica ese primer still.
        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-6">
          <span className="animate-pulse rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur">
            {t.flyby.loadingView}
          </span>
        </div>
      )}

      {/* Los frames del stop todavía están BAJANDO: progreso donde van las flechas.
          Cuando llega a 100 aparecen las flechas, listas para arrancar al toque — así
          el click nunca cae en el "Preparando la vista…" esperando la red. */}
      {navPill && !preparing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-6">
          <span className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur">
            {t.flyby.loadingRoute(navPct)}
          </span>
        </div>
      )}

      {/* Re-primando frames fríos antes de una transición (sólo si tarda > 120ms). */}
      {ready && preparing && (
        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <span className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
            {t.flyby.preparingView}
          </span>
        </div>
      )}
    </div>
  );
}

/** Flechita circular del flyby: un chevron que apunta a `dir`. `onPrime` (opcional)
 *  corre en el pointerdown: pre-prima el decode del segmento de ESTA flecha ~100ms
 *  antes de que llegue el click, así el gate de run() lo encuentra ya en vuelo. */
function FlybyArrow({
  dir,
  label,
  onClick,
  onPrime,
}: {
  dir: "left" | "right";
  label: string;
  onClick: () => void;
  onPrime?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPrime}
      aria-label={label}
      title={label}
      // 44px en pantalla baja (teléfono acostado) en vez de 48: sigue siendo un
      // objetivo táctil cómodo y le devuelve 4px de alto a la bolita 360°, que en
      // apaisado compite con esta fila por la misma franja (ver VrHotspot).
      className="grid h-12 w-12 place-items-center rounded-full bg-tier-dark/80 text-ink shadow-lg ring-1 ring-line backdrop-blur transition hover:scale-105 hover:bg-tier-dark active:scale-95 [@media(max-height:560px)]:h-11 [@media(max-height:560px)]:w-11"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dir === "left" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}
