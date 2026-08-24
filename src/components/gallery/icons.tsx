// Iconos del showroom (stroke, 24×24, currentColor). Inline para no sumar deps.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const BASE: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 22,
  height: 22,
  "aria-hidden": true,
};

/** "Equipo" (dos personas) — item "El Equipo" del menú lateral. */
export function TeamIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function PhoneIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function ShareIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 3.98M15.4 6.5l-6.8 3.98" />
    </svg>
  );
}

export function CartIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.57L21.5 7H6" />
    </svg>
  );
}

export function ExpandIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function CompressIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.6V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.6" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function MasterplanIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function BuildingIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M4 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
      <path d="M13 9h6a1 1 0 0 1 1 1v11" />
      <path d="M2 21h20" />
      <path d="M7.5 8h2M7.5 12h2M7.5 16h2M16.5 13h1M16.5 17h1" />
    </svg>
  );
}

export function AmenitiesIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M3 7c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0" />
      <path d="M3 12c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0" />
      <path d="M3 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0" />
    </svg>
  );
}

export function GridIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function GalleryIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export function CompassIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z" />
    </svg>
  );
}

export function MountainIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="m8 3 4 8 5-5 5 15H2z" />
      <path d="M8 3 4 21" />
    </svg>
  );
}

export function BrochureIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  // La lente lleva la clase `finder-lens`: bajo `.finder-lupa` (la lupa del chrome)
  // el CSS la pinta de dorado; en el menú lateral queda en currentColor (gris).
  return (
    <svg {...BASE} {...p}>
      <circle className="finder-lens" cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PolygonEditIcon(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
