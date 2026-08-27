"use client";

import { useEffect, useRef, useState } from "react";
import type { Units } from "@/lib/types";
import { usePolygonEditor, type Vertex } from "@/hooks/usePolygonEditor";
import { EditorSidebar } from "./EditorSidebar";
import { VertexDot } from "./VertexDot";
import type { EditorSurface } from "./surface";

const MAX_ZOOM = 20;

/** Map a screen point to the SVG's viewBox (natural-pixel) space. */
function clientToViewBox(svg: SVGSVGElement, clientX: number, clientY: number): Vertex {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function centroid(points: string): Vertex {
  const pts = points
    .trim()
    .split(/\s+/)
    .map((s) => s.split(",").map(Number));
  const n = pts.length || 1;
  const sum = pts.reduce((a, [x, y]) => ({ x: a.x + x, y: a.y + y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Polygon digitizer with zoom/pan. Zoom & pan are driven by the SVG `viewBox`
 * (not a CSS transform) so `getScreenCTM()` stays exact — clicks and vertex
 * drags map 1:1 to native pixels at any zoom level. Vertex handles and labels
 * are divided by the zoom so they keep a constant on-screen size and never cover
 * the corner you're placing.
 */
export function PolygonEditor({ surface, units }: { surface: EditorSurface; units: Units }) {
  const ed = usePolygonEditor(surface.polygons, `editor:${surface.key}`);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [dims, setDims] = useState({
    width: surface.imageWidth ?? 1920,
    height: surface.imageHeight ?? 1080,
  });
  const [imgError, setImgError] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Zoom & pan as the SVG viewBox.
  const [vb, setVb] = useState<ViewBox>({
    x: 0,
    y: 0,
    w: surface.imageWidth ?? 1920,
    h: surface.imageHeight ?? 1080,
  });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<
    { sx: number; sy: number; vbx: number; vby: number; vbw: number; vbh: number; ppx: number } | null
  >(null);

  // Mirrors for native (wheel) handlers.
  const dimsRef = useRef(dims);
  useEffect(() => {
    dimsRef.current = dims;
  }, [dims]);

  const zoom = dims.width / vb.w;
  const labelSize = Math.max(dims.width, dims.height) / 67 / zoom;
  const dotRadius = Math.max(dims.width, dims.height) / 300 / zoom;

  const fitView = () =>
    setVb({ x: 0, y: 0, w: dimsRef.current.width, h: dimsRef.current.height });

  /** Zoom keeping the point at viewport fraction (fx,fy) anchored. */
  const zoomAt = (factor: number, fx: number, fy: number) => {
    setVb((v) => {
      const d = dimsRef.current;
      const nw = clamp(v.w / factor, d.width / MAX_ZOOM, d.width);
      const nh = nw * (d.height / d.width);
      const mx = v.x + fx * v.w;
      const my = v.y + fy * v.h;
      const nx = clamp(mx - fx * nw, 0, d.width - nw);
      const ny = clamp(my - fy * nh, 0, d.height - nh);
      return { x: nx, y: ny, w: nw, h: nh };
    });
  };

  // Wheel = zoom toward the cursor. Native listener so we can preventDefault.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, fx, fy);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  // Space toggles pan mode (ignored while typing in the sidebar).
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing()) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const startDrag = (index: number, pointerId: number) => {
    setDragIndex(index);
    svgRef.current?.setPointerCapture(pointerId);
  };

  // ── Pan: Space+drag or middle-mouse drag ──
  const onViewportPointerDown = (e: React.PointerEvent) => {
    if (!(spaceDown || e.button === 1)) return;
    e.preventDefault();
    const vp = viewportRef.current;
    if (!vp) return;
    panStart.current = {
      sx: e.clientX,
      sy: e.clientY,
      vbx: vb.x,
      vby: vb.y,
      vbw: vb.w,
      vbh: vb.h,
      ppx: vb.w / vp.clientWidth,
    };
    setIsPanning(true);
    vp.setPointerCapture(e.pointerId);
  };
  const onViewportPointerMove = (e: React.PointerEvent) => {
    const ps = panStart.current;
    if (!ps) return;
    const d = dimsRef.current;
    const nx = clamp(ps.vbx - (e.clientX - ps.sx) * ps.ppx, 0, d.width - ps.vbw);
    const ny = clamp(ps.vby - (e.clientY - ps.sy) * ps.ppx, 0, d.height - ps.vbh);
    setVb((cur) => ({ ...cur, x: nx, y: ny }));
  };
  const endPan = (e: React.PointerEvent) => {
    if (!panStart.current) return;
    panStart.current = null;
    setIsPanning(false);
    viewportRef.current?.releasePointerCapture(e.pointerId);
  };

  const cursor = isPanning ? "grabbing" : spaceDown ? "grab" : "crosshair";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div
        ref={viewportRef}
        className="relative w-full select-none overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
        style={{ aspectRatio: `${dims.width} / ${dims.height}`, cursor }}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={endPan}
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault(); // no middle-click autoscroll
        }}
      >
        {/* Hidden probe to read the render's natural pixel size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={surface.image}
          alt=""
          aria-hidden
          className="hidden"
          onLoad={(e) => {
            const i = e.currentTarget;
            if (i.naturalWidth && i.naturalHeight) {
              setDims({ width: i.naturalWidth, height: i.naturalHeight });
              setVb({ x: 0, y: 0, w: i.naturalWidth, h: i.naturalHeight });
            }
          }}
          onError={() => setImgError(true)}
        />

        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          onPointerMove={(e) => {
            if (dragIndex !== null && svgRef.current) {
              const v = clientToViewBox(svgRef.current, e.clientX, e.clientY);
              ed.moveVertex(dragIndex, v.x, v.y);
            }
          }}
          onPointerUp={(e) => {
            if (dragIndex !== null) {
              svgRef.current?.releasePointerCapture(e.pointerId);
              setDragIndex(null);
            }
          }}
        >
          {/* Background render — inside the viewBox so it zooms/pans 1:1. */}
          {!imgError ? (
            <image
              href={surface.image}
              x={0}
              y={0}
              width={dims.width}
              height={dims.height}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: "none" }}
            />
          ) : (
            <rect x={0} y={0} width={dims.width} height={dims.height} fill="#0f172a" />
          )}

          {/* Full-size catcher: a press on empty area adds a vertex. */}
          <rect
            x={0}
            y={0}
            width={dims.width}
            height={dims.height}
            fill="transparent"
            style={{ pointerEvents: "all" }}
            onPointerDown={(e) => {
              if (e.button !== 0 || spaceDown || !svgRef.current) return;
              const v = clientToViewBox(svgRef.current, e.clientX, e.clientY);
              ed.addVertex(v.x, v.y);
            }}
          />

          {/* Saved polygons — visual only, so clicks pass through to add vertices. */}
          {ed.saved.map((poly) => {
            const c = centroid(poly.points);
            return (
              <g key={poly.unitId} style={{ pointerEvents: "none" }}>
                <polygon
                  points={poly.points}
                  className="fill-sky-400/20 stroke-sky-300"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={c.x}
                  y={c.y}
                  className="fill-white"
                  fontSize={labelSize}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ paintOrder: "stroke", stroke: "rgba(15,23,42,0.75)", strokeWidth: 3 }}
                >
                  {poly.unitId}
                </text>
              </g>
            );
          })}

          {/* In-progress polygon. */}
          {ed.current.length > 0 && (
            <>
              <polyline
                points={ed.current.map((p) => `${p.x},${p.y}`).join(" ")}
                className="fill-amber-300/20 stroke-amber-300"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              {ed.current.length >= 2 && (
                <line
                  x1={ed.current[ed.current.length - 1].x}
                  y1={ed.current[ed.current.length - 1].y}
                  x2={ed.current[0].x}
                  y2={ed.current[0].y}
                  className="stroke-amber-300/60"
                  strokeWidth={1.5}
                  strokeDasharray="6 6"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {ed.current.map((p, i) => (
                <VertexDot
                  key={i}
                  x={p.x}
                  y={p.y}
                  index={i}
                  radius={dotRadius}
                  onStartDrag={startDrag}
                />
              ))}
            </>
          )}
        </svg>

        {/* Zoom toolbar */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/85 p-1 text-slate-200 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => zoomAt(1 / 1.4, 0.5, 0.5)}
            className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none hover:bg-slate-700"
            title="Alejar"
            aria-label="Alejar"
          >
            −
          </button>
          <button
            type="button"
            onClick={fitView}
            className="min-w-[3.5rem] rounded-md px-2 py-1 text-center text-xs font-medium tabular-nums hover:bg-slate-700"
            title="Restablecer zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1.4, 0.5, 0.5)}
            className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none hover:bg-slate-700"
            title="Acercar"
            aria-label="Acercar"
          >
            +
          </button>
          <button
            type="button"
            onClick={fitView}
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-700"
            title="Ajustar a la vista"
            aria-label="Ajustar a la vista"
          >
            ⤢
          </button>
        </div>

        {/* Hint */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-slate-900/70 px-2 py-1 text-[14px] text-slate-300 backdrop-blur">
          Rueda: zoom · Espacio o botón del medio + arrastrar: mover
        </div>
      </div>

      <EditorSidebar surface={surface} units={units} ed={ed} />
    </div>
  );
}
