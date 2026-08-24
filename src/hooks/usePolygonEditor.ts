import { useCallback, useEffect, useState } from "react";
import type { UnitPolygon } from "@/lib/types";

export interface Vertex {
  x: number;
  y: number;
}

/** Vertices → SVG points string, rounded to whole pixels. */
export function pointsToString(points: Vertex[]): string {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}

/** SVG points string → vertices. */
export function stringToPoints(s: string): Vertex[] {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    });
}

/**
 * Orden estable de la lista de polígonos: ascendente por unitId, numérico
 * ("1" < "501" < "601"), así la lista del sidebar Y el stops.json guardado quedan
 * siempre prolijos de menor a mayor (no en orden de creación).
 */
const byUnitId = (a: UnitPolygon, b: UnitPolygon) =>
  a.unitId.localeCompare(b.unitId, undefined, { numeric: true, sensitivity: "base" });

/**
 * State machine for the polygon editor: one in-progress polygon (vertices +
 * unitId) plus the list of saved polygons for the stop.
 *
 * When `storageKey` is given, the IN-PROGRESS polygon (current vertices + unitId)
 * is mirrored to sessionStorage so a reload / Fast Refresh never loses it.
 * `saved` stays sourced from disk (stops.json) — only the unsaved work is kept.
 */
export function usePolygonEditor(initial: UnitPolygon[], storageKey?: string) {
  const [saved, setSaved] = useState<UnitPolygon[]>(() => [...initial].sort(byUnitId));
  const [current, setCurrent] = useState<Vertex[]>([]);
  const [unitId, setUnitId] = useState("");

  // Restore in-progress work once, after mount (avoids SSR / hydration issues).
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw) as { current?: Vertex[]; unitId?: string };
      if (Array.isArray(s.current)) setCurrent(s.current);
      if (typeof s.unitId === "string") setUnitId(s.unitId);
    } catch {
      /* ignore corrupt storage */
    }
  }, [storageKey]);

  // Persist in-progress work on every change.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ current, unitId }));
    } catch {
      /* ignore quota errors */
    }
  }, [storageKey, current, unitId]);

  const addVertex = useCallback((x: number, y: number) => {
    setCurrent((c) => [...c, { x, y }]);
  }, []);

  const moveVertex = useCallback((index: number, x: number, y: number) => {
    setCurrent((c) => c.map((p, i) => (i === index ? { x, y } : p)));
  }, []);

  const undoVertex = useCallback(() => setCurrent((c) => c.slice(0, -1)), []);

  const clearCurrent = useCallback(() => {
    setCurrent([]);
    setUnitId("");
  }, []);

  /** Close the current polygon into the saved list. Returns an error string or null. */
  const finish = useCallback((): string | null => {
    const id = unitId.trim();
    if (!id) return "Asigná un unitId antes de cerrar el polígono.";
    if (current.length < 3) return "Un polígono necesita al menos 3 vértices.";
    const poly: UnitPolygon = { unitId: id, points: pointsToString(current) };
    setSaved((s) => [...s.filter((p) => p.unitId !== id), poly].sort(byUnitId));
    setCurrent([]);
    setUnitId("");
    return null;
  }, [unitId, current]);

  /** Pull a saved polygon back into the editor to adjust it. */
  const editPolygon = useCallback(
    (id: string) => {
      const poly = saved.find((p) => p.unitId === id);
      if (!poly) return;
      setCurrent(stringToPoints(poly.points));
      setUnitId(id);
      setSaved((s) => s.filter((p) => p.unitId !== id));
    },
    [saved],
  );

  const deletePolygon = useCallback((id: string) => {
    setSaved((s) => s.filter((p) => p.unitId !== id));
  }, []);

  return {
    saved,
    current,
    unitId,
    setUnitId,
    addVertex,
    moveVertex,
    undoVertex,
    clearCurrent,
    finish,
    editPolygon,
    deletePolygon,
  };
}

export type PolygonEditorApi = ReturnType<typeof usePolygonEditor>;
