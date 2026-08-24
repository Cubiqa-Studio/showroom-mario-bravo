"use client";

import { useState, type ReactNode } from "react";
import type { Stop, Units } from "@/lib/types";
import { AvailabilityToggle } from "./AvailabilityToggle";
import { InteractiveOverlay } from "./InteractiveOverlay";

interface BuildingGalleryProps {
  stop: Stop;
  units: Units;
  /** Branding shown floating over the top-left of the render. */
  branding?: ReactNode;
  /** Extra actions (e.g. the editor link) shown in the top-right control cluster. */
  actions?: ReactNode;
}

/**
 * Full-screen sales render + interactive polygon overlay, with the controls
 * (Availability toggle + actions) floating over the top-right — the usual
 * showroom layout. The image is object-cover and the overlay uses `slice`, so
 * the polygons keep tracking the render at any viewport aspect ratio.
 */
export function BuildingGallery({ stop, units, branding, actions }: BuildingGalleryProps) {
  const [showAvailability, setShowAvailability] = useState(false);
  const [dims, setDims] = useState({
    width: stop.imageWidth ?? 1920,
    height: stop.imageHeight ?? 1080,
  });
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-950">
      {!imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stop.image}
          alt={`Stop ${stop.id}`}
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setDims({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          onError={() => setImgError(true)}
        />
      ) : (
        <EmptyRenderState image={stop.image} />
      )}

      <InteractiveOverlay
        stop={stop}
        units={units}
        width={dims.width}
        height={dims.height}
        showAvailability={showAvailability}
      />

      {branding && (
        <div className="absolute left-4 top-4 z-20 max-w-[80vw] rounded-2xl bg-white/85 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
          {branding}
        </div>
      )}

      <div className="absolute right-4 top-4 z-20 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-2xl bg-white/85 px-4 py-2.5 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <AvailabilityToggle value={showAvailability} onChange={setShowAvailability} />
        {actions}
      </div>
    </div>
  );
}

/** Shown until the real render is dropped into /public — polygons stay testable. */
function EmptyRenderState({ image }: { image: string }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{
        backgroundColor: "#1c1917",
        backgroundImage:
          "linear-gradient(rgba(184,125,9,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(184,125,9,0.16) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <div className="rounded-lg border border-dashed border-stone-500 bg-stone-900/70 px-5 py-4 text-center text-stone-300">
        <p className="text-sm font-medium">Falta el render del stop</p>
        <p className="mt-1 text-xs text-stone-400">
          Soltá tu imagen en{" "}
          <code className="rounded bg-stone-800 px-1 py-0.5">public{image}</code>
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Los polígonos siguen activos para testear el hover ↘
        </p>
      </div>
    </div>
  );
}
