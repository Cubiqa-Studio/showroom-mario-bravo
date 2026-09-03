"use client";

// Reusa la "hoja" compartida (`.sheet-*`) y el scope `.res-landing`: el buscador se
// abre desde el SHOWROOM (exterior) y desde la landing de unidad. CSS scopeado, no
// filtra nada global. Los estilos propios llevan el prefijo `.finder-*`.
import "../residencia/residencia.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { usePathname } from "next/navigation";
import { useAbrirFicha } from "@/components/transition/TransitionProvider";
import unitsData from "@/data/units.json";
import type { Unit, Units } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { useLiveUnits } from "@/hooks/useLiveUnits";
import {
  unitAmbientes,
  unitArea,
  unitAreaValue,
  unitFloorKey,
  unitTotalBaths,
} from "@/lib/residencia";
import { CloseIcon, SearchIcon } from "./icons";
import { markUnitEntryPoint } from "@/lib/analytics";
import { lockBodyScroll } from "@/lib/scroll-lock";

/* eslint-disable @next/next/no-img-element */

// Fallback estático (bundleado, seguro en cliente). El estado/precio EN VIVO sale de
// Airtable: si el padre pasa `units` (el showroom ya las tiene en vivo) se usan directo;
// si no (la landing), se traen lazy de /api/unidades al abrir. Mismo patrón que MasterplanModal.
const UNITS = unitsData as unknown as Units;

type UnitWithId = Unit & { id: string };
type Availability = "all" | "available" | "reserved";
type SortKey = "num" | "area";
type SortDir = "asc" | "desc";

/**
 * "Buscador de unidades" — modal a pantalla completa con la lista filtrable de las
 * 44 residencias. Chasis: la "hoja" del showroom (`.sheet-*`) sobre el scope
 * `.res-landing`. Filtros en el riel izquierdo (desktop) o en un bottom-sheet
 * (mobile). Click en una tarjeta → abre esa residencia. Se abre desde la lupa del
 * chrome y desde el item "Buscar unidades" del menú lateral.
 */
export function UnitFinderModal({
  open,
  onClose,
  units,
}: {
  open: boolean;
  onClose: () => void;
  /** Unidades EN VIVO ya mergeadas (las pasa el showroom). Sin esto, se traen de
   *  /api/unidades al abrirse (caso landing). */
  units?: Units;
}) {
  const abrirFicha = useAbrirFicha();
  const pathname = usePathname();
  const { t } = useI18n();
  // Si el padre no las pasó, fetch lazy al abrir; si las pasó, usamos esas.
  const fetched = useLiveUnits(UNITS, open && !units);
  const allMap = units ?? fetched;

  const allUnits = useMemo<UnitWithId[]>(
    () =>
      Object.entries(allMap)
        .map(([id, u]) => ({ id, ...u }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [allMap],
  );
  const total = allUnits.length;

  // ── Estado de filtros ──────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [avail, setAvail] = useState<Availability>("all");
  const [rooms, setRooms] = useState<Set<number>>(new Set());
  // Baños = TOTALES (baños + toilette, unitTotalBaths). Juani 2026-07-16: se sacó
  // el toggle "Toilette" (confundía) y los dúplex 2 baños + toilette filtran como 3.
  const [baths, setBaths] = useState<Set<number>>(new Set());
  // Vistas (Camila 2026-07-16: "clave para comprar acá") — valores EN VIVO de la
  // columna "Vistas" de Airtable (ej. Montaña / Parcial al lago / Plena al lago);
  // sin Airtable no hay valores y el grupo no se muestra.
  const [vistas, setVistas] = useState<Set<string>>(new Set());
  // Exposición (frente / contrafrente). Set y no booleano: son dos valores y se
  // pueden querer los dos. Sale de units.json (las plantas), no de Airtable.
  const [exposure, setExposure] = useState<Set<string>>(new Set());
  // (Miro 2026-07-15: el filtro por tipología se eliminó junto con la tipología en la UI.)
  const [floors, setFloors] = useState<Set<string>>(new Set());
  const [duplex, setDuplex] = useState(false);
  // Unidades con recorrido 360° propio (units.json → tour360). No todas lo tienen.
  const [tour, setTour] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("num");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Bottom-sheet de filtros (mobile).
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Sombra de la sub-barra al scrollear el cuerpo.
  const [scrolled, setScrolled] = useState(false);
  // Unidad que se está abriendo: la tarjeta muestra zoom + spinner hasta el handoff.
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const clearAll = () => {
    setQuery("");
    setAvail("all");
    setRooms(new Set());
    setBaths(new Set());
    setVistas(new Set());
    setExposure(new Set());
    setFloors(new Set());
    setDuplex(false);
    setTour(false);
  };

  // Cerrar con Escape + bloquear el scroll del fondo mientras está abierto. Al cerrar,
  // resetear el bottom-sheet de filtros (que no quede abierto la próxima vez).
  useEffect(() => {
    if (!open) {
      setFiltersOpen(false);
      setNavigatingId(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (filtersOpen) setFiltersOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose, filtersOpen]);

  const openUnit = (id: string) => {
    if (navigatingId) return; // ya hay una navegación en curso
    markUnitEntryPoint("unit_finder", id);
    setNavigatingId(id);
    abrirFicha(id);
  };

  // Cerrar el buscador cuando la navegación LLEGA al detalle elegido. Así el modal
  // sigue visible con el feedback (zoom + spinner en la tarjeta) durante el 1-2s que
  // tarda, y recién ahí hace el handoff al detalle (cuyo loading.tsx —shell blanco con
  // spinner dorado— sostiene la espera restante, sin flash del showroom). Un mínimo de
  // ~350ms para que el zoom se aprecie aunque la ruta commitee al toque; fallback duro
  // por si algo sale mal (ej. unidad inexistente → redirect a "/").
  useEffect(() => {
    if (!navigatingId) return;
    const arrived = pathname === `/residencia/${navigatingId}`;
    const timer = window.setTimeout(
      () => {
        onClose();
        setNavigatingId(null);
      },
      arrived ? 350 : 4500,
    );
    return () => window.clearTimeout(timer);
  }, [pathname, navigatingId, onClose]);

  // ── Facetas disponibles (valores que existen en el catálogo) ────────────────
  const facets = useMemo(() => {
    const roomsSet = new Set<number>();
    const bathsSet = new Set<number>();
    const vistasSet = new Set<string>();
    const exposureSet = new Set<string>();
    const floorSet = new Set<string>();
    let hasDuplex = false;
    let hasTour = false;
    for (const u of allUnits) {
      roomsSet.add(unitAmbientes(u));
      bathsSet.add(unitTotalBaths(u));
      const v = u.vistas?.trim();
      if (v) vistasSet.add(v);
      if (u.exposure) exposureSet.add(u.exposure);
      floorSet.add(unitFloorKey(u.id));
      if (u.duplex) hasDuplex = true;
      if (u.tour360) hasTour = true;
    }
    return {
      rooms: [...roomsSet].sort((a, b) => a - b),
      baths: [...bathsSet].sort((a, b) => a - b),
      vistas: [...vistasSet].sort((a, b) => a.localeCompare(b, "es")),
      // Orden fijo frente → contrafrente (no alfabético: "contrafrente" iría primero
      // y el par se lee al revés de como lo piensa cualquiera).
      exposures: (["frente", "contrafrente"] as const).filter((e) =>
        exposureSet.has(e),
      ),
      floors: [...floorSet].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
      hasDuplex,
      hasTour,
    };
  }, [allUnits]);

  // ── Predicados por grupo (para filtrar y para calcular chips deshabilitados) ─
  const q = query.trim();
  const preds = useMemo(() => {
    return {
      q: (u: UnitWithId) => !q || u.id.includes(q),
      av: (u: UnitWithId) => avail === "all" || u.status === avail,
      rooms: (u: UnitWithId) => rooms.size === 0 || rooms.has(unitAmbientes(u)),
      baths: (u: UnitWithId) =>
        baths.size === 0 || baths.has(unitTotalBaths(u)),
      vistas: (u: UnitWithId) =>
        vistas.size === 0 || vistas.has((u.vistas ?? "").trim()),
      exposure: (u: UnitWithId) =>
        exposure.size === 0 || (!!u.exposure && exposure.has(u.exposure)),
      floors: (u: UnitWithId) =>
        floors.size === 0 || floors.has(unitFloorKey(u.id)),
      duplex: (u: UnitWithId) => !duplex || u.duplex === true,
      tour: (u: UnitWithId) => !tour || !!u.tour360,
    };
  }, [q, avail, rooms, baths, vistas, exposure, floors, duplex, tour]);

  // ¿La unidad pasa todos los filtros MENOS el del grupo `skip`? Base para saber si un
  // chip, al activarse, dejaría resultados (si no, se deshabilita → nunca callejón sin salida).
  const passesExcept = useMemo(() => {
    const entries = Object.entries(preds) as [
      keyof typeof preds,
      (u: UnitWithId) => boolean,
    ][];
    return (u: UnitWithId, skip: keyof typeof preds) =>
      entries.every(([k, fn]) => k === skip || fn(u));
  }, [preds]);

  // Lista filtrada + ordenada.
  const filtered = useMemo(() => {
    const list = allUnits.filter((u) =>
      Object.values(preds).every((fn) => fn(u)),
    );
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const cmp =
        sortKey === "area"
          ? unitAreaValue(a) - unitAreaValue(b) ||
            a.id.localeCompare(b.id, undefined, { numeric: true })
          : a.id.localeCompare(b.id, undefined, { numeric: true });
      return cmp * dir;
    });
    return list;
  }, [allUnits, preds, sortKey, sortDir]);

  // Chips deshabilitados: un chip queda enabled si YA está activo (para poder
  // deseleccionarlo) o si al activarlo quedaría ≥1 resultado.
  const roomEnabled = (v: number) =>
    rooms.has(v) ||
    allUnits.some((u) => passesExcept(u, "rooms") && unitAmbientes(u) === v);
  const bathEnabled = (v: number) =>
    baths.has(v) ||
    allUnits.some((u) => passesExcept(u, "baths") && unitTotalBaths(u) === v);
  const vistaEnabled = (v: string) =>
    vistas.has(v) ||
    allUnits.some(
      (u) => passesExcept(u, "vistas") && (u.vistas ?? "").trim() === v,
    );
  const exposureEnabled = (v: string) =>
    exposure.has(v) ||
    allUnits.some((u) => passesExcept(u, "exposure") && u.exposure === v);
  const floorEnabled = (v: string) =>
    floors.has(v) ||
    allUnits.some((u) => passesExcept(u, "floors") && unitFloorKey(u.id) === v);
  const availEnabled = (v: Exclude<Availability, "all">) =>
    avail === v ||
    allUnits.some((u) => passesExcept(u, "av") && u.status === v);
  const duplexEnabled =
    duplex ||
    allUnits.some((u) => passesExcept(u, "duplex") && u.duplex === true);
  const tourEnabled =
    tour || allUnits.some((u) => passesExcept(u, "tour") && !!u.tour360);

  // Helpers de toggle sobre Sets (inmutables → nuevo Set en cada cambio).
  const toggleIn = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  // ── Chips de filtros activos (sub-barra) ────────────────────────────────────
  const activeChips = useMemo(() => {
    const chips: {
      id: string;
      label: string;
      onRemove: () => void;
      violet?: boolean;
    }[] = [];
    if (q)
      chips.push({
        id: "q",
        label: `${t.finder.sortNumber} ${q}`,
        onRemove: () => setQuery(""),
      });
    if (avail !== "all")
      chips.push({
        id: "av",
        label: t.status[avail],
        onRemove: () => setAvail("all"),
      });
    [...rooms]
      .sort((a, b) => a - b)
      .forEach((v) =>
        chips.push({
          id: `r${v}`,
          label: t.finder.statRooms(v),
          onRemove: () => toggleIn(rooms, v, setRooms),
        }),
      );
    [...baths]
      .sort((a, b) => a - b)
      .forEach((v) =>
        chips.push({
          id: `b${v}`,
          label: t.finder.statBaths(v),
          onRemove: () => toggleIn(baths, v, setBaths),
        }),
      );
    [...vistas]
      .sort((a, b) => a.localeCompare(b, "es"))
      .forEach((v) =>
        chips.push({
          id: `v${v}`,
          label: v,
          onRemove: () => toggleIn(vistas, v, setVistas),
        }),
      );
    (["frente", "contrafrente"] as const)
      .filter((v) => exposure.has(v))
      .forEach((v) =>
        chips.push({
          id: `e${v}`,
          label: t.status[v],
          onRemove: () => toggleIn(exposure, v as string, setExposure),
        }),
      );
    [...floors]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach((v) =>
        chips.push({
          id: `f${v}`,
          label: `${t.finder.floor} ${t.sideMenu.floor(v)}`,
          onRemove: () => toggleIn(floors, v, setFloors),
        }),
      );
    if (duplex)
      chips.push({
        id: "dup",
        label: t.status.duplex,
        violet: true,
        onRemove: () => setDuplex(false),
      });
    if (tour)
      chips.push({
        id: "tour",
        label: t.finder.tour360,
        onRemove: () => setTour(false),
      });
    return chips;
  }, [q, avail, rooms, baths, vistas, exposure, floors, duplex, tour, t]);

  const activeCount = activeChips.length;

  // ── Controles de filtros (riel desktop + bottom-sheet mobile comparten esto) ─
  // Es una FUNCIÓN que devuelve JSX (no un componente anidado) para no remontar el
  // <input> en cada tecla. Se llama dos veces (riel + hoja); cada árbol conserva su
  // identidad por posición, así el foco del buscador no se pierde al tipear.
  const renderFilters = () => (
    <>
      {/* 1 · Búsqueda por Nº */}
      <div className="finder-search">
        <SearchIcon width={16} height={16} />
        <input
          type="text"
          inputMode="numeric"
          value={query}
          onChange={(e) => setQuery(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={t.finder.searchPlaceholder}
          aria-label={t.finder.searchAria}
        />
        {query && (
          <button
            type="button"
            className="finder-search-clear"
            aria-label={t.finder.clearSearch}
            onClick={() => setQuery("")}
          >
            <CloseIcon width={14} height={14} />
          </button>
        )}
      </div>

      {/* 2 · Disponibilidad (segmentado) */}
      <div className="finder-group">
        <p className="finder-group-h">{t.finder.availability}</p>
        <div
          className="finder-seg"
          role="group"
          aria-label={t.finder.availability}
        >
          {(["all", "available", "reserved"] as const).map((v) => {
            const disabled = v !== "all" && !availEnabled(v);
            return (
              <button
                key={v}
                type="button"
                className={`finder-seg-opt${avail === v ? " active" : ""}`}
                aria-pressed={avail === v}
                disabled={disabled}
                onClick={() => setAvail(v)}
              >
                {v !== "all" && (
                  <span className={`finder-dot finder-dot--${v}`} />
                )}
                {v === "all" ? t.finder.availabilityAll : t.status[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3 · Ambientes */}
      {facets.rooms.length > 1 && (
        <div className="finder-group">
          <p className="finder-group-h">
            {t.finder.rooms}
            {rooms.size > 0 && (
              <span className="finder-group-count">{rooms.size}</span>
            )}
          </p>
          <div className="finder-chips">
            {facets.rooms.map((v) => (
              <button
                key={v}
                type="button"
                className={`finder-chip serif${rooms.has(v) ? " active" : ""}`}
                aria-pressed={rooms.has(v)}
                disabled={!roomEnabled(v)}
                onClick={() => toggleIn(rooms, v, setRooms)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4 · Baños */}
      {facets.baths.length > 1 && (
        <div className="finder-group">
          <p className="finder-group-h">
            {t.finder.baths}
            {baths.size > 0 && (
              <span className="finder-group-count">{baths.size}</span>
            )}
          </p>
          <div className="finder-chips">
            {facets.baths.map((v) => (
              <button
                key={v}
                type="button"
                className={`finder-chip serif${baths.has(v) ? " active" : ""}`}
                aria-pressed={baths.has(v)}
                disabled={!bathEnabled(v)}
                onClick={() => toggleIn(baths, v, setBaths)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5 · Vistas (Camila 2026-07-16: diferencial clave del buscador). Valores
          crudos EN VIVO de Airtable (Montaña / Parcial al lago / Plena al lago…);
          sin Airtable no hay valores → el grupo no aparece. */}
      {facets.vistas.length > 1 && (
        <div className="finder-group">
          <p className="finder-group-h">
            {t.finder.vistas}
            {vistas.size > 0 && (
              <span className="finder-group-count">{vistas.size}</span>
            )}
          </p>
          <div className="finder-chips">
            {facets.vistas.map((v) => (
              <button
                key={v}
                type="button"
                className={`finder-chip serif${vistas.has(v) ? " active" : ""}`}
                aria-pressed={vistas.has(v)}
                disabled={!vistaEnabled(v)}
                onClick={() => toggleIn(vistas, v, setVistas)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5b · Exposición (frente / contrafrente). Sólo aparece si units.json tiene
          las DOS: con un solo valor cargado el grupo no filtra nada. */}
      {facets.exposures.length > 1 && (
        <div className="finder-group">
          <p className="finder-group-h">
            {t.finder.exposure}
            {exposure.size > 0 && (
              <span className="finder-group-count">{exposure.size}</span>
            )}
          </p>
          <div className="finder-chips">
            {facets.exposures.map((v) => (
              <button
                key={v}
                type="button"
                className={`finder-chip serif${exposure.has(v) ? " active" : ""}`}
                aria-pressed={exposure.has(v)}
                disabled={!exposureEnabled(v)}
                onClick={() => toggleIn(exposure, v as string, setExposure)}
              >
                {t.status[v]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6 · Piso (+ Dúplex, canal violeta). El filtro por tipología se sacó
          (Miro 2026-07-15) y el toggle "Toilette" también (Juani 2026-07-16:
          confundía — los baños ahora filtran por TOTALES, toilette incluido). */}
      {facets.floors.length > 1 && (
        <div className="finder-group">
          <p className="finder-group-h">
            {t.finder.floor}
            {floors.size > 0 && (
              <span className="finder-group-count">{floors.size}</span>
            )}
          </p>
          <div className="finder-chips">
            {facets.floors.map((v) => (
              <button
                key={v}
                type="button"
                className={`finder-chip serif${floors.has(v) ? " active" : ""}`}
                aria-pressed={floors.has(v)}
                disabled={!floorEnabled(v)}
                onClick={() => toggleIn(floors, v, setFloors)}
              >
                {t.sideMenu.floor(v)}
              </button>
            ))}
          </div>
          {facets.hasDuplex && (
            <button
              type="button"
              className={`finder-toggle finder-toggle--violet${duplex ? " active" : ""}`}
              role="switch"
              aria-checked={duplex}
              disabled={!duplexEnabled}
              onClick={() => setDuplex((v) => !v)}
              style={{ marginTop: 12 }}
            >
              <span className="finder-toggle-track">
                <span className="finder-toggle-knob" />
              </span>
              {t.status.duplex}
            </button>
          )}
          {facets.hasTour && (
            <button
              type="button"
              className={`finder-toggle${tour ? " active" : ""}`}
              role="switch"
              aria-checked={tour}
              disabled={!tourEnabled}
              onClick={() => setTour((v) => !v)}
              style={{ marginTop: 12 }}
            >
              <span className="finder-toggle-track">
                <span className="finder-toggle-knob" />
              </span>
              {t.finder.tour360}
            </button>
          )}
        </div>
      )}
    </>
  );

  // Control de orden (sub-barra en desktop, tope de la hoja en mobile).
  const renderSort = () => (
    <div className="finder-sort" role="group" aria-label={t.finder.sort}>
      <span className="finder-sort-label">{t.finder.sort}</span>
      {(
        [
          { k: "num", label: t.finder.sortNumber },
          { k: "area", label: t.finder.sortArea },
        ] as const
      ).map(({ k, label }) => {
        const active = sortKey === k;
        return (
          <button
            key={k}
            type="button"
            className={`finder-sort-opt${active ? " active" : ""}`}
            aria-pressed={active}
            aria-label={active ? t.finder.sortToggleAria : label}
            onClick={() => {
              if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              else {
                setSortKey(k);
                setSortDir("asc");
              }
            }}
          >
            {label}
            {active && (
              <svg
                viewBox="0 0 24 24"
                width={12}
                height={12}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: sortDir === "asc" ? "rotate(180deg)" : "none",
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );

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
            // Cortar el drag del flyby (se abre desde el exterior).
            onPointerDown={(e) => e.stopPropagation()}
          >
            <motion.div
              className="res-landing sheet finder-root"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Encabezado: eyebrow + título · folio (contador en vivo) · cerrar */}
              <header className="sheet-head finder-head">
                <div className="finder-head-l">
                  <p className="sheet-eyebrow">{t.finder.eyebrow}</p>
                  <h2 className="sheet-title">{t.finder.title(total)}</h2>
                </div>
                <div className="finder-head-r">
                  <div className="finder-folio" aria-live="polite">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={filtered.length}
                        className="finder-folio-num"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {filtered.length}
                      </motion.span>
                    </AnimatePresence>
                    <span className="finder-folio-cap">
                      {t.finder.countCaption(total)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="sheet-close"
                    aria-label={t.finder.close}
                    onClick={onClose}
                  >
                    <CloseIcon width={22} height={22} />
                  </button>
                </div>
              </header>

              {/* Sub-barra: chips de filtros activos + (desktop) orden / (mobile) Filtros */}
              <div className={`finder-subbar${scrolled ? " scrolled" : ""}`}>
                <div className="finder-activebar">
                  <AnimatePresence initial={false}>
                    {activeChips.map((c) => (
                      <motion.button
                        key={c.id}
                        type="button"
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className={`finder-active-chip${c.violet ? " violet" : ""}`}
                        onClick={c.onRemove}
                      >
                        {c.label}
                        <CloseIcon width={13} height={13} />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {activeCount > 0 && (
                    <button
                      type="button"
                      className="finder-clear-all"
                      onClick={clearAll}
                    >
                      {t.finder.clearAll}
                    </button>
                  )}
                </div>
                <div className="finder-subbar-right">
                  {renderSort()}
                  <button
                    type="button"
                    className="finder-filters-btn"
                    onClick={() => setFiltersOpen(true)}
                  >
                    {t.finder.filters}
                    {activeCount > 0 && (
                      <span className="finder-filters-count">
                        {activeCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Cuerpo: riel de filtros (desktop) + grilla de resultados */}
              <div
                className="sheet-body finder-scroll"
                onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
              >
                <div className="finder-layout">
                  <aside className="finder-rail">{renderFilters()}</aside>

                  <div className="finder-results">
                    {filtered.length === 0 ? (
                      <motion.div
                        className="finder-empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.26 }}
                      >
                        <span className="finder-empty-num serif">00</span>
                        <p className="finder-empty-title serif">
                          {t.finder.emptyTitle}
                        </p>
                        <p className="finder-empty-body">
                          {t.finder.emptyBody}
                        </p>
                        <button
                          type="button"
                          className="finder-empty-clear"
                          onClick={clearAll}
                        >
                          {t.finder.clearAll}
                        </button>
                      </motion.div>
                    ) : (
                      <div className="finder-grid">
                        {filtered.map((u) => (
                          <FinderCard
                            key={u.id}
                            unit={u}
                            onOpen={openUnit}
                            navigating={navigatingId === u.id}
                            dimmed={
                              navigatingId !== null && navigatingId !== u.id
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom-sheet de filtros (mobile). */}
              <AnimatePresence>
                {filtersOpen && (
                  <>
                    <motion.button
                      type="button"
                      className="finder-sheet-scrim"
                      aria-label={t.finder.close}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setFiltersOpen(false)}
                    />
                    <motion.div
                      className="finder-sheet"
                      role="dialog"
                      aria-label={t.finder.filters}
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{
                        type: "spring",
                        stiffness: 360,
                        damping: 38,
                      }}
                    >
                      <div className="finder-sheet-handle" />
                      <div className="finder-sheet-head">
                        <p className="finder-group-h" style={{ margin: 0 }}>
                          {t.finder.filters}
                        </p>
                        <button
                          type="button"
                          className="sheet-close"
                          aria-label={t.finder.close}
                          onClick={() => setFiltersOpen(false)}
                        >
                          <CloseIcon width={20} height={20} />
                        </button>
                      </div>
                      <div className="finder-sheet-body">
                        {renderSort()}
                        {renderFilters()}
                      </div>
                      <div className="finder-sheet-foot">
                        {activeCount > 0 && (
                          <button
                            type="button"
                            className="finder-sheet-clear"
                            onClick={clearAll}
                          >
                            {t.finder.clear}
                          </button>
                        )}
                        <button
                          type="button"
                          className="finder-sheet-apply"
                          onClick={() => {
                            setFiltersOpen(false);
                          }}
                        >
                          {t.finder.seeResults(filtered.length)}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}

/** Tarjeta "plancha de catálogo" (módulo, identidad estable → conserva la animación
 *  layout/stagger de framer). El plano arriba con los badges; abajo el Nº serif, la
 *  línea de stats con m² destacado y el CTA "Ver departamento". (Miro 2026-07-15:
 *  sin precio ni tipología.) */
function FinderCard({
  unit,
  onOpen,
  navigating,
  dimmed,
}: {
  unit: UnitWithId;
  onOpen: (id: string) => void;
  navigating: boolean;
  dimmed: boolean;
}) {
  const { t } = useI18n();
  // Skeleton del plano hasta que la imagen carga. Las imágenes cacheadas (mismo plano
  // compartido entre unidades de una tipología) pueden no disparar `onLoad` si ya
  // estaban completas al montar → chequeo `complete` directo en un efecto.
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0)
      setImgLoaded(true);
  }, []);
  const amb = unitAmbientes(unit);
  const floorKey = unitFloorKey(unit.id);
  const area = unitArea(unit, t.numberLocale);
  const stats = [
    t.finder.statRooms(amb),
    t.finder.statBeds(unit.beds),
    t.finder.statBaths(unit.baths),
    (unit.toilette ?? 0) >= 1 ? t.finder.statToilette : "",
  ].filter(Boolean);

  return (
    // Sólo fundido de opacidad al MONTAR (aparecer). Sin `layout` ni `exit`: al
    // filtrar, las tarjetas que quedan NO se deslizan (evita el rebote del scroll);
    // las que salen se desmontan al toque y las nuevas hacen un fade suave.
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: dimmed ? 0.4 : 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`finder-card${unit.duplex ? " is-duplex" : ""}${unit.status === "reserved" ? " is-reserved" : ""}${navigating ? " is-navigating" : ""}${dimmed ? " is-dimmed" : ""}`}
      onClick={() => onOpen(unit.id)}
      aria-label={t.unitTooltip.enterAria(unit.residence)}
      aria-busy={navigating}
    >
      <div className={`finder-plate${imgLoaded ? " loaded" : ""}`}>
        {unit.duplex && <span className="finder-duplex-bar" aria-hidden />}
        <span className="finder-plate-skeleton" aria-hidden />
        <img
          ref={imgRef}
          className="finder-plan"
          src={unit.floorPlan}
          alt={t.unitTooltip.planAlt(unit.residence)}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
        />
        <span className={`finder-status finder-status--${unit.status}`}>
          <span className="finder-status-dot" />
          {t.status[unit.status]}
        </span>
        {/* Etiquetas bajo el chip de estado. Van en una columna para que no se
            pisen si una unidad llegara a ser dúplex Y tener exposición cargada. */}
        {(unit.duplex || unit.terraza || unit.exposure) && (
          <span className="finder-tags">
            {unit.duplex && (
              <span className="finder-duplex-label">{t.status.duplex}</span>
            )}
            {unit.terraza && (
              <span className="finder-terraza-label">{t.status.terraza}</span>
            )}
            {unit.exposure && (
              <span className="finder-exposure-label">
                {t.status[unit.exposure]}
              </span>
            )}
          </span>
        )}
        {navigating && (
          <span className="finder-card-loading" aria-hidden>
            <span className="finder-spinner" />
          </span>
        )}
      </div>

      <div className="finder-cardbody">
        <div className="finder-lot">
          <div className="finder-lot-l">
            <span className="finder-lot-floor">
              {t.finder.floorFull(floorKey)}
            </span>
            <span className="finder-lot-num serif">{unit.residence}</span>
          </div>
        </div>

        <p className="finder-stats">
          <b className="finder-area">
            {area.value} {area.unit}
          </b>
          {stats.length > 0 && (
            <span className="finder-stats-rest"> · {stats.join(" · ")}</span>
          )}
          {unit.vistas && <i className="finder-vistas"> · {unit.vistas}</i>}
        </p>

        <span className="finder-cta">
          {t.finder.cardCta}
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </motion.button>
  );
}
