"use client";

interface VertexDotProps {
  x: number;
  y: number;
  index: number;
  /** Outer-ring radius in viewBox units (scaled to stay ~constant on screen). */
  radius: number;
  onStartDrag: (index: number, pointerId: number) => void;
}

/**
 * Draggable handle for one vertex of the in-progress polygon. A small hollow
 * ring keeps the corner underneath visible while editing; the tiny solid dot
 * marks the exact vertex.
 */
export function VertexDot({ x, y, index, radius, onStartDrag }: VertexDotProps) {
  return (
    <g
      style={{ pointerEvents: "all", cursor: "grab" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onStartDrag(index, e.pointerId);
      }}
    >
      <circle
        cx={x}
        cy={y}
        r={radius}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="fill-sky-400/15 stroke-sky-400"
      />
      <circle cx={x} cy={y} r={radius * 0.3} className="fill-sky-500" />
    </g>
  );
}
