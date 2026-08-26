// ─────────────────────────────────────────────────────────────────────────────
// Domain types for the interactive sales gallery (showroom CUBIQA).
//
// Hard rule of the project: GEOMETRY is separate from METADATA.
//   - Geometry  (UnitPolygon / Stop)  lives per-stop. The same unit has a
//     DIFFERENT polygon for every flyby angle/stop.
//   - Metadata  (Unit)                lives ONCE per unit, independent of angle.
// ─────────────────────────────────────────────────────────────────────────────

export type UnitStatus = "available" | "reserved";

/** Superficies de una unidad, en m² (Fase 3 — landing de detalle). */
export interface UnitAreas {
  total?: number;
  /** Superficie CUBIERTA (Airtable: "Superficie Cubierta"). */
  interior?: number;
  /** Semicubierta + descubierta (Airtable: "Superficie Semi/Desc"). */
  exterior?: number;
  /** Proporcional de espacios comunes (Airtable: "Superficie Común"). */
  comun?: number;
}

/** Un grupo de especificaciones (un acordeón colapsable en la landing). */
export interface SpecGroup {
  category: string;
  items: { label: string; value: string }[];
}

/**
 * Per-unit metadata. One entry per real apartment, keyed by unitId in units.json.
 * Designed to map 1:1 to a future Airtable/Supabase row — when `status` flips
 * upstream, the overlay repaints it without any geometry change.
 */
export interface Unit {
  /** Display label, e.g. "702". */
  residence: string;
  beds: number;
  baths: number;
  /** Interior area in square feet. (Legacy; la landing usa `areas` en m².) */
  sqft: number;
  status: UnitStatus;
  /**
   * Dúplex: la unidad ocupa DOS niveles — planta inferior en su piso + entrepiso
   * (con un dormitorio) en el piso de arriba. En la planta se pinta distinto
   * (violeta) y aparece tanto en el plano de su piso como en el de arriba.
   */
  duplex?: boolean;
  /**
   * A qué da la unidad: `"frente"` = a la calle Mario Bravo, `"contrafrente"` = al
   * pulmón de manzana (pileta, deck y parque). Sale de las plantas generales, NO de
   * Airtable —el cliente no tiene esa columna—, así que vive en `units.json`.
   *
   * Es opcional a propósito: una unidad que da a los DOS lados (las de retiro que
   * cruzan la planta) se deja sin valor y no muestra chip, antes que etiquetarla mal.
   */
  exposure?: "frente" | "contrafrente";
  /**
   * Cantidad de AMBIENTES (Airtable, columna "Ambientes"). Distinto de `beds`
   * (dormitorios): en convención AR un 1 dormitorio = 2 ambientes. Opcional: sólo
   * lo trae el merge en vivo con Airtable; en `units.json` no vive.
   */
  ambientes?: number;
  /** Tipología comercial A–F (Airtable, columna "Tipología"). */
  tipologia?: string;
  /** Toilette (medio baño), por tipología (units.json). Ausente/0 = no se muestra. */
  toilette?: number;
  /** Vistas de la unidad (Airtable, columna "Vistas"): ej. "Montaña", "Parcial al
   *  lago", "Plena al lago". Reemplaza a la vieja "Superficie Descubierta". */
  vistas?: string;
  /** Free-form price string, e.g. "USD 420,000" or "Consultar". */
  price: string;
  /** Mini floor plan / apartment image shown in the hover tooltip. */
  floorPlan: string;
  /** Optional secondary image (render/photo) for the tooltip. */
  image?: string;
  /** Phase 2: 360° / VR tour URL for the VR button. */
  vrUrl?: string;
  /**
   * Tour 360° (Kuula) embebido EN el hero, reemplazando la galería de fotos
   * (imagen principal + thumbs). Sólo las unidades con este campo lo muestran.
   * Distinto de `vrUrl` (que es el botón "Ver 3D" de la barra de datos).
   */
  tour360?: string;

  // ── Fase 3: landing de detalle (todos opcionales → la sección se renderiza
  //    sólo si hay dato; reemplazá estos placeholders por los reales). ──────────
  /** Texto de overview de la unidad. */
  description?: string;
  /** Dirección / ubicación textual (si difiere de la base del proyecto). */
  address?: string;
  /** Orientación, ej. "N", "NE", "Norte". */
  orientation?: string;
  /** Superficies en m². */
  areas?: UnitAreas;
  /** Galería del hero (varias imágenes). Fallback: [image, floorPlan]. */
  gallery?: string[];
  /** Specs por categoría. Fallback: las del proyecto (site). */
  specs?: SpecGroup[];
}

export type Units = Record<string, Unit>;

/**
 * Avance de obra (tabla "Avance de Obra" de Airtable): porcentaje general +
 * fecha de actualización. Tipo de dominio (no server-only) para que lo puedan
 * importar los componentes cliente que lo muestran.
 */
export interface AvanceObra {
  /** Porcentaje 0–100. */
  percent: number;
  /** Hito / etapa en curso (ej. "Terminaciones"). */
  milestone?: string;
  /** Fecha de entrega estimada (string tal cual de Airtable). */
  delivery?: string;
  /** Fecha de la última actualización (string tal cual de Airtable). */
  date?: string;
  /** Nota opcional. */
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config a nivel PROYECTO (no por-unidad): datos compartidos por todas las
// landings — broker, ubicación del edificio y specs por defecto. Vive en
// `src/data/site.ts`. Evita duplicar lo mismo en las 19 unidades.
// ─────────────────────────────────────────────────────────────────────────────

export interface Broker {
  name: string;
  /** Cargo, ej. "Asesor Inmobiliario". */
  role?: string;
  phone: string;
  /** Segundo teléfono opcional (la referencia muestra dos). */
  phone2?: string;
  email: string;
  photo?: string;
}

/** Un panel editorial de "Especificaciones" (nav de 2 columnas en la landing). */
export interface SpecPanel {
  title: string;
  body: string;
  /** Clave estable opcional (ej. "amenities") para ubicar un panel sin depender del
      idioma del título — la usa el AmenitiesModal del showroom. */
  id?: string;
  /** `true` = sección de proyecto: NO va en el acordeón de la unidad, sino en el
      showroom ("El Proyecto"). Ver SpecsSection (filtra) y ProjectModal. */
  home?: boolean;
  /** Listas con subtítulo opcional (ej. "Terminaciones", "Planta baja"). */
  lists?: { heading?: string; items: string[] }[];
  /** Pares destacados opcionales (ej. Arquitectura / Comercialización).
      `image` opcional: logo mostrado entre el label y el value (ej. RE/MAX). */
  grid?: { label: string; value: string; image?: string }[];
}

/** Miembro del equipo (modal "El Equipo" — Miro 2026-07-15). */
export interface TeamMember {
  /** Rol institucional, ej. "Desarrollador", "Estudio de arquitectura". */
  role: string;
  name: string;
  /** Logo en /public. Sin logo, el nombre va sólo en texto (indicación de Juani). */
  logo?: string;
  /** Tarjeta destacada y más grande (Fluir Desarrollos y Aslan y Ezcurra). */
  featured?: boolean;
  /** Tarjeta sola, centrada al pie — espejo del brochure (RE/MAX). */
  solo?: boolean;
}

/** Un hito del plan de pagos (sección Reserva y Cronograma). */
export interface PaymentMilestone {
  /** Monto del hito, ej. "30%" o "USD 5.000". */
  pct: string;
  /** Nombre del hito, ej. "01 · Reserva". */
  when: string;
  /** Detalle del hito (columna "Detalle" de la tabla del cliente). */
  detail?: string;
}

/** Punto de interés del mapa (sección Ubicación). */
export interface PointOfInterest {
  name: string;
  /** Categoría mostrada en el popup, ej. "Lago", "Ski & Montaña". */
  cat: string;
  lng: number;
  lat: number;
}

/**
 * Una imagen de la galería del proyecto (lightbox del menú). Derivados WebP
 * generados por `scripts/optimize-gallery.mjs` → manifiesto `src/data/gallery.json`.
 */
export interface GalleryImage {
  /** Render optimizado para el visor grande (object-contain). */
  full: string;
  /** Miniatura liviana para la tira de thumbnails (no se carga el full). */
  thumb: string;
  /** Tamaño natural del `full` (para aspect-ratio / evitar layout shift). */
  width?: number;
  height?: number;
}

export interface SiteConfig {
  projectName: string;
  developer: string;
  /** Marca mostrada en navbar/footer. Fallback en código: `projectName`. */
  brandName?: string;
  /** Nombre del edificio/desarrollo real, mostrado en el marker del mapa
   *  (sección Ubicación). Fallback en código: `brandName` → `projectName`. */
  buildingName?: string;
  /** Bajada bajo la marca, ej. "DEPARTAMENTOS · BUENOS AIRES". */
  tagline?: string;
  /** Dirección base del desarrollo (fallback de `Unit.address`). */
  addressBase: string;
  /**
   * Pisos del edificio EN ORDEN DE RECORRIDO, como strings — los mismos que
   * `floorOf(unitId)` produce ("0" = PB si el proyecto la tiene). Alimenta las
   * pills y las flechas ‹ › de "Planta del piso" / Plan Maestro, que ciclan con
   * wrap-around. Vive acá y no dentro del componente porque cambia por proyecto:
   * hardcodearlo en el componente fue lo que dejó el selector de pisos mostrando
   * los del showroom anterior. `getFloors()` avisa en dev si se desincroniza de
   * units.json.
   */
  floors: string[];
  /** Coordenadas del edificio para el mapa de la sección ubicación. */
  location: { lat: number; lng: number };
  broker: Broker;
  /** Specs por defecto (terminaciones comunes del edificio). */
  defaultSpecs: SpecGroup[];
  // NOTA i18n: el contenido EDITORIAL (specNarrative, paymentPlan, deliveryNote)
  // vive en src/i18n/translations.ts — es texto por-idioma, no config.
  /** Puntos de interés del mapa (coordenadas + nombre/categoría ES, que el
   *  diccionario traduce vía t.location.poiName/poiCat). */
  pois: PointOfInterest[];
  /** Galería del proyecto (lightbox del menú). Derivados optimizados desde
   *  `src/data/gallery.json` (ver `scripts/optimize-gallery.mjs`). */
  gallery?: GalleryImage[];
  /** Render aéreo del edificio (sección "El Edificio"). Vacío → placeholder. */
  aerialImage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 3: PLANTA DEL PISO (floor plate). Estructuralmente idéntica a un Stop —
// una imagen de fondo (el plano del piso) + polígonos por unidad trazados encima.
// Hoy la landing usa un esquemático cuando no hay plate; cuando se trace uno (vía
// el editor de polígonos, Fase 6) se persiste acá y la sección lo consume 1:1.
// ─────────────────────────────────────────────────────────────────────────────

export interface FloorPlate {
  /** Piso, ej. "5", "6", "7" (= unitId sin los dos últimos dígitos). */
  floor: string;
  /** Imagen del plano de planta servida desde /public. */
  image: string;
  /** Tamaño natural en px de `image`, usado como viewBox del overlay. */
  imageWidth?: number;
  imageHeight?: number;
  /** Polígonos por unidad sobre el plano (mismo shape que Stop.polygons). */
  polygons: UnitPolygon[];
}

export interface PlatesFile {
  plates: FloorPlate[];
}

/**
 * One unit's polygon for ONE stop. `points` is an SVG points string
 * ("x,y x,y x,y ...") expressed in the render's natural-pixel space, so it
 * scales 1:1 with the background image at any display size.
 */
export interface UnitPolygon {
  unitId: string;
  points: string;
}

/** Geometry for one official viewpoint (keyframe) of the flyby. */
export interface Stop {
  id: number;
  /** Frame index in the flyby sequence (phase 2). The first stop is frame 0. */
  frame: number;
  /** Background render for this stop, served from /public. También es el POSTER y
   *  la red de seguridad del visor cuando hay `video` (debería ser su frame 0). */
  image: string;
  /**
   * Video "estático" (cinemagraph) de la vista PARADA — reemplaza visualmente al
   * still cuando la cámara queda quieta (autoplay muteado + loop). Opcional: sin él,
   * el visor pinta `image`. Se asume un `.webm` hermano (mismo nombre) para entrega
   * más liviana. NO afecta la alineación: el overlay sigue usando imageWidth/Height.
   */
  video?: string;
  /**
   * Natural pixel size of `image`, used as the SVG viewBox. Optional: the
   * overlay falls back to the image's measured natural size once it loads.
   */
  imageWidth?: number;
  imageHeight?: number;
  polygons: UnitPolygon[];
}

export interface StopsFile {
  stops: Stop[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2: el flyby. Un "segmento" es una transición pre-renderizada entre dos
// stops, convertida a una secuencia de frames JPG. La geometría (polígonos) sigue
// viviendo en los Stops; el segmento sólo guarda las imágenes intermedias.
// ─────────────────────────────────────────────────────────────────────────────

/** Una transición del flyby entre dos stops, como secuencia de frames. */
export interface FlybySegment {
  /** Stop del que sale (su still ≈ el primer frame). */
  from: number;
  /** Stop al que llega (su still ≈ el último frame). */
  to: number;
  /** Dirección visual del avance — define hacia dónde apunta la flecha. */
  dir: "left" | "right";
  /**
   * URLs de los frames en orden de avance (from → to). El camino de vuelta
   * reproduce este mismo array al revés.
   */
  frames: string[];
}

export interface FlybyFile {
  segments: FlybySegment[];
}
