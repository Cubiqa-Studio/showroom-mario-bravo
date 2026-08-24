// ─────────────────────────────────────────────────────────────────────────────
// Hotspots 360° por stop (tour de Kuula u otro). Las coordenadas van en el
// ESPACIO NATIVO del render del stop (igual que los polígonos), así la bolita
// trackea la imagen al hacer object-cover en cualquier viewport.
//
// Para ajustar la posición: mirá el render del stop y cambiá x,y (en píxeles del
// render). La vista 1 (stop-1.jpg) es 4991×2808.
// ─────────────────────────────────────────────────────────────────────────────

export interface VrHotspotConfig {
  /** Posición del hotspot en píxeles nativos del render del stop. */
  x: number;
  y: number;
  /** Escala de la bolita (1 = tamaño base). Permite achicarla por vista. */
  scale?: number;
  /** URL del recorrido 360° (Kuula). Se cablea el click más adelante. */
  kuulaUrl?: string;
  /** Render que muestra el PREVIEW del hover (webp de la galería): el del hall o el
   *  de la pileta, según qué recorrido abre la bolita. Sin esto usa el render del stop. */
  previewImage?: string;
  /** Etiqueta del preview: "hall" (default) o "amenities". */
  previewKind?: "hall" | "amenities";
}

// Tour 360° del HALL DE ENTRADA. Lo comparten las vistas que ven la entrada (stop 0
// y stop 1): la bolita abre este mismo recorrido en el modal grande. `thumbs=0`
// OCULTA la tira de miniaturas para elegir otras vistas (pedido del cliente); sin
// `zoom=0` (a diferencia del Hero360) la rueda zoomea el tour, que es lo deseable
// dentro del modal (no hay página que scrollear detrás).
// Exportados: además de las bolitas del exterior, el SideMenu abre estos mismos
// recorridos en el modal grande (Tours / Amenities).
// `info=0` + `logo=-1` (Miro 2026-07-15): sin botón INFO ni logo de Kuula encimados
// al chrome del sitio. Igual lo fuerza withKuulaChromeHidden en el embed.
export const ENTRANCE_HALL_360 =
  "https://kuula.co/share/collection/7Tlmk?fs=1&vr=1&thumbs=0&info=0&logo=-1";

// Tour 360° de los AMENITIES. Es la bolita de la vista 3 (stop 2); mismo formato de
// modal que el hall (sin `zoom=0` → la rueda zoomea el tour adentro; `thumbs=0`).
// Colección 7TlqD (la anterior, 7Tlmq, fue borrada y recreada — jun. 2026).
export const AMENITIES_360 =
  "https://kuula.co/share/collection/7TlqD?fs=1&vr=1&thumbs=0&info=0&logo=-1";

/** Hotspots por id de stop. Hoy: stops 0, 1 y 2. */
export const VR_HOTSPOTS: Record<number, VrHotspotConfig> = {
  // Stop 0 (landing) — debajo de la puerta central del edificio (sobre el piso,
  // a la izquierda del montículo de césped). Render 5000×2812. Preview = HALL (view-03).
  0: {
    x: 2090,
    y: 2120,
    kuulaUrl: ENTRANCE_HALL_360,
    previewImage: "/gallery/optimized/view-03.webp",
    previewKind: "hall",
  },
  // Stop 1 — en la boca del acceso cubierto, a nivel del piso (no flotando en la
  // pared). Más chica que la del stop 0 para no tapar la entrada. Render 4991×2808.
  1: {
    x: 3950,
    y: 2160,
    scale: 0.7,
    kuulaUrl: ENTRANCE_HALL_360,
    previewImage: "/gallery/optimized/view-03.webp",
    previewKind: "hall",
  },
  // Stop 2 — sobre la escalera blanca que se ve detrás del vidrio en la esquina
  // vidriada izquierda (donde el cliente marcó el círculo). Render 5000×2813.
  // Recorrido 360° de los AMENITIES; preview = PILETA (view-04).
  2: {
    x: 1185,
    y: 2335,
    scale: 0.85,
    kuulaUrl: AMENITIES_360,
    previewImage: "/gallery/optimized/view-04.webp",
    previewKind: "amenities",
  },
};
