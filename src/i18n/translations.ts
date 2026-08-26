import type { SpecPanel, PaymentMilestone, TeamMember, Unit } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Diccionario i18n de TODO el sitio (showroom exterior + landing de residencia).
//
// Convenciones:
//   · `es` es la fuente de verdad del shape (Dict = typeof es); `en` debe
//     calzar 1:1 — si falta una key, TypeScript lo marca.
//   · Strings dinámicos = funciones flecha (p. ej. residence(n)), así la
//     interpolación queda DENTRO del diccionario y el orden de palabras puede
//     variar por idioma.
//   · El contenido editorial (specNarrative, paymentPlan, POIs) vive acá y NO
//     en site.ts: el texto es por-idioma; en site.ts quedan datos neutros
//     (coordenadas, imágenes, contacto).
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = "es" | "en";

const es = {
  /** Locale BCP-47 para toLocaleString (decimales: 2,5 vs 2.5). */
  numberLocale: "es-AR",

  common: {
    // Miro 2026-07-15: "Residencia" → "Departamento" en TODA la UI (las rutas
    // /residencia/:id no cambian: son URLs indexadas, no copy).
    residence: (n: string) => `Departamento ${n}`,
  },

  /** Portada de entrada: video intro en bucle + botón al centro. */
  splash: {
    cta: "Descubrir",
    aria: "Video de presentación del showroom",
  },

  /** Copy SEO/accesible (sr-only) de las páginas visuales (home + showroom): dan
   *  un H1 y texto crawleable describiendo el desarrollo sin tocar el diseño. */
  seo: {
    homeH1: "TIER Bravo — Departamentos en Mario Bravo 955, Buenos Aires",
    homeBody:
      "TIER Bravo, en Mario Bravo 955, es un desarrollo de 61 departamentos en la Ciudad de Buenos Aires, de monoambiente a 4 ambientes, distribuidos en siete pisos. Amenities de edificio: pileta con solárium, gimnasio, SUM y coworking, parrilla y comedor de terraza, sector de juegos, cochera cubierta y lobby con seguridad. Recorré el edificio en un tour interactivo 360° y consultá plantas, superficies y disponibilidad.",
    showroomH1: "Showroom 360° — Recorré TIER Bravo, en Mario Bravo 955",
    showroomBody:
      "Recorrido interactivo de TIER Bravo, el edificio de Mario Bravo 955, Ciudad de Buenos Aires. Girá la vista en 360°, explorá los 61 departamentos de los pisos 1 a 7 y entrá a cada unidad para ver su planta, superficie y disponibilidad.",
    unitsNavLabel: "Listado de departamentos",
    unitLink: (residence: string, beds: number) =>
      `Departamento ${residence} — ${beds >= 1 ? `${beds} ${beds === 1 ? "dormitorio" : "dormitorios"}` : "monoambiente"} en TIER Bravo, Mario Bravo 955`,
    /** Sección "El proyecto" del bloque SEO del showroom: párrafo auto-contenido
     *  (~120 palabras) con SOLO datos reales del proyecto — también es el bloque
     *  citable para AI search (AI Overviews / Perplexity). */
    projectTitle: "El proyecto: 61 departamentos en TIER Bravo",
    projectBody:
      // Sólo datos verificados contra el listado de unidades del cliente. Sin fecha de
      // entrega ni lista cerrada de terminaciones hasta que las confirme.
      "TIER Bravo es un desarrollo residencial de CCM Desarrollos en Mario Bravo 955, Ciudad Autónoma de Buenos Aires. El edificio reúne 61 departamentos repartidos en siete pisos: monoambientes y unidades de 2, 3 y 4 ambientes, con superficies totales que van de 39,70 m² a 258,15 m². Los pisos 1 a 5 tienen diez unidades cada uno; el 6° y el 7° son plantas de retiro, con menos unidades y terrazas de mayor superficie. Suma amenities de pileta con solárium, gimnasio, SUM y coworking, parrilla de terraza y cochera cubierta. Cada departamento tiene su ficha con plano, superficies y disponibilidad actualizados, y el edificio se recorre completo en 360° desde este showroom online.",
    homeLink: "Volver a la portada de TIER Bravo",
  },

  /** Página 404 (ruta inexistente). */
  notFound: {
    title: "Página no encontrada",
    body: "La página que buscás no existe o fue movida. Volvé al inicio para seguir descubriendo TIER Bravo.",
    home: "Volver al inicio",
    showroom: "Ir al showroom",
    credit: "Un desarrollo de",
  },

  status: {
    available: "Disponible",
    reserved: "Reservada",
    duplex: "Dúplex",
    duplexTwoLevels: "Dúplex (dos niveles)",
  },

  orientations: {
    N: "Norte",
    S: "Sur",
    E: "Este",
    O: "Oeste",
    NE: "Noreste",
    NO: "Noroeste",
    SE: "Sudeste",
    SO: "Sudoeste",
  } as Record<string, string>,

  // ── Showroom exterior ──────────────────────────────────────────────────────
  toolbar: {
    consultNow: "Consultar ahora",
    /** Versión corta para pantallas muy angostas (la barra entra en 1 línea). */
    consultShort: "Consultar",
    share: "Compartir",
    linkCopied: "Enlace copiado",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Salir de pantalla completa",
    menu: "Menú",
    availability: "Disponibilidad",
  },

  sideMenu: {
    close: "Cerrar menú",
    menuPanel: "Menú",
    home: "Inicio",
    masterplan: "Masterplan",
    availability: "Disponibilidad",
    gallery: "Galería",
    project: "El Proyecto",
    amenities: "Amenities",
    tours: "Tours",
    toursHall: "Hall 360°",
    toursAmenities: "Amenities 360°",
    toursUnits: "Unidades",
    /** Etiqueta de piso en el submenú de unidades ("0" → PB, resto → "1°"…). */
    floor: (f: string) => (f === "0" ? "PB" : `${f}°`),
    brochure: "Brochure",
    location: "Ubicación",
    caviahue: "Conocé Caviahue",
    /** "El Equipo" — modal propio (Miro 2026-07-15: tiene que estar en el menú general). */
    team: "El Equipo",
    contact: "Contacto",
    polygonEditor: "Editor de polígonos",
    soon: "Pronto",
    soonTitle: "Próximamente",
  },

  flyby: {
    loadingPercent: (pct: number) => `Cargando… ${pct}%`,
    loadingView: "Cargando…",
    /** Pill donde van las flechas mientras BAJAN los frames del stop (táctil). */
    loadingRoute: (pct: number) => `Cargando recorrido… ${pct}%`,
    preparingView: "Preparando la vista…",
    backToView: (id: number) => `Volver a la vista ${id}`,
    forwardToView: (id: number) => `Avanzar a la vista ${id}`,
    frameAlt: "Transición de vuelo sobre el edificio de TIER Bravo",
    stillAlt: (id: number) => `Render del edificio de TIER Bravo — vista ${id}`,
    /** Texto entre las flechas de navegación (rotar la vista del edificio). */
    rotateLabel: "Girar",
    home: "Volver al inicio",
    /** Ayuda fija sobre las flechas: invita a interactuar con las unidades. */
    hoverHintDesktop: "Pasá el cursor sobre una unidad para verla y entrar",
    hoverHintMobile: "Tocá una unidad para verla y entrar",
  },

  /** Modal "Avance de obra" (% general + fecha, en vivo desde Airtable). */
  avance: {
    eyebrow: "La obra",
    title: "Avance de obra",
    /** Etiqueta corta del badge (al lado del %). Miro 2026-07-15: "Obra" no decía
     *  qué era el 52% → "Avance de obra". El % en sí vive en Airtable (editable). */
    short: "Avance de obra",
    progress: "Avance general",
    milestone: "Hito en curso",
    delivery: "Entrega estimada",
    lastUpdate: "Última actualización",
    empty: "Muy pronto vas a ver acá el avance de la obra.",
    close: "Cerrar",
  },

  rotateHint: {
    aria: "Sugerencia de orientación",
    brand: "Showroom TIER Bravo",
    title: "Girá tu celular",
    body: "Poné el dispositivo en horizontal para una mejor experiencia.",
    continueAnyway: "Continuar igual",
  },

  vr: {
    open: "Abrir recorrido 360°",
    tour: "Recorrido 360°",
    virtualTour: "Recorrido virtual 360°",
    hall: "Hall de entrada",
    amenities: "Amenities",
    close: "Cerrar recorrido 360°",
  },

  unitTooltip: {
    planAlt: (n: string) => `Plano departamento ${n}`,
    enterAria: (n: string) => `Entrar al Departamento ${n}`,
    beds: "Dorm.",
    baths: "Baños",
    area: "m²",
  },

  /** Tarjeta compacta de unidad (hover en exterior / planta / unidades disp.).
   *  Miro 2026-07-15: sin precio ni tipología (se sacaron de toda la UI). */
  unitCard: {
    /** Ambientes compacto (Airtable): "2 amb". */
    rooms: (n: number) => `${n} amb`,
    // (Vistas se muestra con su valor crudo de Airtable, ej. "Montaña".)
    beds: (n: number) => (n === 1 ? "1 dormitorio" : `${n} dormitorios`),
    baths: (n: number) => (n === 1 ? "1 baño" : `${n} baños`),
  },

  /** Buscador de unidades — modal con la lista filtrable de todas las unidades.
   *  Se abre desde la lupa del chrome (showroom + nav de unidad) y desde el menú. */
  finder: {
    /** Etiqueta del disparador (lupa) y del item del menú lateral. */
    open: "Buscar unidades",
    eyebrow: "Buscador de unidades",
    title: (total: number) => `Los ${total} Departamentos`,
    /** Línea bajo el número grande de resultados: "Resultados · de 44". */
    countCaption: (total: number) => `Resultados · de ${total}`,
    // Búsqueda por número
    searchPlaceholder: "N.º de unidad",
    searchAria: "Buscar por número de unidad",
    clearSearch: "Limpiar búsqueda",
    // Grupos de filtros
    availability: "Disponibilidad",
    availabilityAll: "Todas",
    rooms: "Ambientes",
    /** Baños TOTALES (baños + toilette) — ver unitTotalBaths (Juani 2026-07-16). */
    baths: "Baños",
    /** Vistas (Camila 2026-07-16): chips con los valores crudos de Airtable. */
    vistas: "Vistas",
    floor: "Piso",
    duplex: "Dúplex",
    /** Filtro por unidades que tienen recorrido 360° propio (units.json → tour360). */
    tour360: "Con tour 360°",
    sort: "Orden",
    sortNumber: "N.º",
    sortArea: "m²",
    sortToggleAria: "Cambiar sentido del orden",
    // Filtros activos / acciones
    filters: "Filtros",
    clearAll: "Limpiar todo",
    /** Botón del panel de filtros en mobile: "Ver 12 departamentos". */
    seeResults: (n: number) => `Ver ${n} ${n === 1 ? "departamento" : "departamentos"}`,
    clear: "Limpiar",
    close: "Cerrar",
    // Estado vacío
    emptyTitle: "Ningún departamento coincide",
    emptyBody: "Ajustá los filtros para ver más.",
    // Tarjeta de unidad
    floorFull: (key: string) => (key === "0" ? "Planta baja" : `${key}° Piso`),
    cardCta: "Ver departamento",
    statRooms: (n: number) => `${n} amb`,
    statBeds: (n: number) => (n === 1 ? "1 dorm" : `${n} dorm`),
    statBaths: (n: number) => (n === 1 ? "1 baño" : `${n} baños`),
    statToilette: "toilette",
  },

  // Mensajes de WhatsApp pre-cargados (wa.me).
  wa: {
    general: "¡Hola! Estoy viendo el Showroom de TIER Bravo y quería hacer una consulta.",
    unit: (n: string) =>
      `¡Hola! Me interesa el Departamento ${n} de TIER Bravo (Mario Bravo 955). Quisiera más información.`,
  },

  // ── Landing de residencia ──────────────────────────────────────────────────
  nav: {
    back: "Volver",
    toTop: "Ir arriba",
    home: "Inicio",
    fullscreen: "Pantalla completa",
    menu: "Menú",
    consult: "Consultar",
  },

  dataBar: {
    /** Párrafo descriptivo ÚNICO por unidad (contenido real por departamento, SEO):
     *  se arma sólo con datos reales de la unidad (units.json + Airtable en vivo);
     *  el dato que no está, no se menciona. Miro 2026-07-15: la sección 1 visible
     *  se sacó de la landing — este texto sigue saliendo en el HTML como sr-only
     *  (junto al h1) para no perder el contenido único por unidad. Sin tipología. */
    blurb: (u: {
      beds: number;
      baths: string;
      toilette?: number;
      area?: string;
      floor: string;
      duplex?: boolean;
      vistas?: string;
    }) => {
      const que =
        u.beds >= 1
          ? `Departamento de ${u.beds} ${u.beds === 1 ? "dormitorio" : "dormitorios"}`
          : "Monoambiente";
      const dup = u.duplex ? " en dos niveles (dúplex)" : "";
      const piso = u.floor === "0" ? "en planta baja" : `en el ${u.floor}° piso`;
      // "2 baños, toilette y 100 m² totales" — lista con "y" sólo antes del último.
      const partes = [
        `${u.baths} ${u.baths === "1" ? "baño" : "baños"}`,
        u.toilette ? "toilette" : null,
        u.area ? `${u.area} m² totales` : null,
      ].filter((p): p is string => p != null);
      const detalle =
        partes.length > 1
          ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`
          : partes[0];
      const vistas = u.vistas ? ` Vistas: ${u.vistas}.` : "";
      return `${que}${dup} ${piso} de TIER Bravo, en Mario Bravo 955, Ciudad de Buenos Aires. Cuenta con ${detalle}.${vistas}`;
    },
  },

  hero: {
    tourTitle: (n: string) => `Tour 360° — Departamento ${n}`,
    explore360: "Explorar tour 360°",
    photoAlt: (n: string) => `Render del Departamento ${n} — TIER Bravo`,
    photoAltN: (n: string, i: number) => `Departamento ${n} — vista ${i}`,
    seePhotos: (count: number) => `Ver las ${count} fotos`,
  },

  plan: {
    sectionTitle: "Plano de la Unidad",
    tabUnit: "Plano de la unidad",
    tabFloor: "Planta del piso",
    // Miro 2026-07-15: se sacaron las leyendas "Lago Caviahue" / "Camino del Volcán"
    // que rodeaban el plano (el cliente preguntó qué eran → "sacarlo directamente").
    access: "Acceso",
    planAlt: (n: string) => `Plano Departamento ${n}`,
    logoAlt: "TIER Bravo",
    overviewTitle: "Resumen de la Unidad",
    totalArea: "Superficie total",
    interior: "Interior",
    exterior: "Exterior",
    bedrooms: "Dormitorios",
    bathrooms: "Baños",
    orientation: "Orientación",
    // Resumen de la unidad completo (Camila 2026-06-30).
    toilette: "Toilette",
    vistas: "Vistas",
    floor: "Piso",
    /** "0" → PB, resto → "1°"… */
    floorValue: (f: string) => (f === "0" ? "PB" : `${f}°`),
    amenities: "Amenities",
    amenitiesValue: "Spa, Piscina y Gimnasio",
    seePdf: "Ver PDF",
  },

  plate: {
    groundFloor: "Planta Baja",
    floor: (f: string) => `Piso ${f}`,
    yourResidence: "Tu departamento",
    yourResidenceUpper: "TU DEPARTAMENTO",
    prevFloor: "Piso anterior",
    nextFloor: "Piso siguiente",
    duplexNote: "Dúplex · dormitorio en el entrepiso (piso de arriba)",
    statsLine: (beds: number, baths: string, m2: string) => `${beds} Dorm · ${baths} Baños${m2}`,
    rooms: (n: number) => `${n} amb`,
    core: "NÚCLEO · CIRCULACIÓN · ASCENSORES",
  },

  masterplan: {
    eyebrow: "Plan Maestro",
    title: "Plantas del edificio",
    close: "Cerrar plan maestro",
  },

  project: {
    eyebrow: "El desarrollo",
    title: "El Proyecto",
    close: "Cerrar",
    financingTitle: "Financiación",
  },

  /** "El Equipo" — modal propio del menú general (Miro 2026-07-15). Fluir
   *  Desarrollos y Aslan y Ezcurra van destacados (featured); donde no hay logo
   *  en /public va el nombre en texto (indicación de Juani). */
  team: {
    eyebrow: "Respaldo institucional",
    title: "Un equipo con trayectoria",
    intro:
      "Maihuenia es el resultado de un equipo con trayectoria detrás de cada etapa: arquitectura de autor, una estructura de inversión transparente y una comercialización profesional.",
    close: "Cerrar",
    // Espejo del BROCHURE (pedido Camila 21/07): mismo orden, sin el estudio
    // jurídico, RE/MAX solo al pie (`solo`) y logos NEGROS de la tanda del drive
    // (public/logos/, recortados+comprimidos; crudos en _media-src/logos-2026-07-21).
    members: [
      {
        role: "Desarrollador",
        name: "Fluir Desarrollos Inmobiliarios",
        logo: "/logos/fluir.png",
        featured: true,
      },
      {
        role: "Estudio de arquitectura",
        name: "Aslan y Ezcurra Arquitectos",
        logo: "/logos/aslan-ezcurra.png",
        featured: true,
      },
      { role: "Agente fiduciario", name: "Fiduciaria Profesional S.A.", logo: "/logos/fiduciaria-profesional.png" },
      { role: "Escribanía", name: "Dr. Francisco Puiggari", logo: "/logos/puiggari.png" },
      { role: "Estudio contable", name: "Miguel A. Monti y Asociados", logo: "/logos/estudio-monti.png" },
      { role: "Comercialización", name: "RE/MAX Oportunidades (Neuquén)", logo: "/logos/remax.png", solo: true },
    ] as TeamMember[],
  },

  /** Controles de sonido de un video (los usa el carrusel del entorno). */
  anim: {
    volume: "Volumen",
    mute: "Silenciar",
    unmute: "Activar sonido",
  },

  /** "Conocé Caviahue": puntos destacados de la villa (modal del menú). */
  caviahue: {
    eyebrow: "La villa",
    title: "Conocé Caviahue",
    intro:
      "Una villa de montaña entre volcanes, lagos y bosques de araucarias milenarias, en el norte neuquino.",
    galleryAria: "Galería de Caviahue",
    points: [
      {
        title: "Centro de esquí",
        body: "El cerro Caviahue, sobre las laderas del volcán Copahue, con pistas para todos los niveles en plena temporada de nieve.",
      },
      {
        title: "Termas de Copahue",
        body: "Aguas termales y barros volcánicos de fama internacional, a pocos minutos de la villa.",
      },
      {
        title: "Salto del Agrio",
        body: "Una cascada imponente que cae entre paredones de roca volcánica y bosques de pehuén.",
      },
      {
        title: "Lago Caviahue",
        body: "El espejo de agua al pie del pueblo, rodeado de araucarias milenarias y senderos para recorrer.",
      },
      {
        title: "Centro comercial",
        body: "El corazón de la villa, con todo lo necesario a pasos de tu departamento.",
      },
      {
        title: "Tiendas y gastronomía",
        body: "Locales, restaurantes y servicios para disfrutar la montaña durante todo el año.",
      },
    ],
  },

  galleryModal: {
    close: "Cerrar galería",
    prev: "Anterior",
    next: "Siguiente",
    alt: (i: number) => `Render ${i} — TIER Bravo`,
  },

  contactModal: {
    eyebrow: "Contacto",
    title: "¿Deseás más información sobre el proyecto?",
    subtitle:
      "Completá los datos y te contactamos con la disponibilidad de unidades, valores y formas de pago.",
    name: "Nombre",
    namePlaceholder: "Nombre completo",
    phone: "Teléfono",
    phonePlaceholder: "(000) 000-0000",
    comment: "Mensaje",
    commentPlaceholder: "Escribí tu consulta…",
    submit: "Enviar formulario",
    sending: "Enviando…",
    sentTitle: "¡Gracias!",
    sent: "Recibimos tu consulta y te vamos a contactar a la brevedad.",
    error: "No pudimos enviar tu consulta. Probá de nuevo o seguí por WhatsApp.",
    whatsappCta: "Prefiero seguir por WhatsApp",
    close: "Cerrar",
    waMessage: (name: string, phone: string, comment: string) =>
      `¡Hola! Soy ${name || "—"}. Mi teléfono: ${phone || "—"}. Quisiera más información sobre el proyecto TIER Bravo (disponibilidad, valores y formas de pago).${
        comment ? ` Consulta: ${comment}` : ""
      }`,
  },

  specs: {
    sectionTitle: "Especificaciones",
    intro:
      "Un detalle completo de la arquitectura, las terminaciones y los servicios que definen el edificio y cada departamento.",
    panels: [
      {
        // Miro 2026-07-15: título "Arquitectura y el Edificio" → sólo "Arquitectura";
        // párrafo introductorio reemplazado por el texto del cliente.
        title: "Arquitectura",
        body:
          "Arquitectura contemporánea de identidad patagónica, desarrollada con materiales nobles como piedra y madera en una propuesta de alta calidad constructiva. Integrada naturalmente con el paisaje para privilegiar las vistas al Lago Agrio y a la Cordillera.",
        lists: [
          {
            heading: "Terminaciones",
            items: [
              "Pisos de porcelanato símil madera 0,20 × 1,20 m en estar, comedor, cocina y dormitorios; baños en porcelanato 60 × 60.",
              "Cocinas con muebles en melamina / laqueado con detalles de madera y mesada de Silestone con pileta de acero inoxidable.",
              "Placares de hojas corredizas, doble altura, melamina símil madera con perfilería de aluminio.",
              "Carpinterías exteriores de PVC negro con DVH (doble vidriado hermético).",
              "Puertas de acceso de doble chapa F30 (cortafuego).",
            ],
          },
        ],
      },
      {
        title: "Los Departamentos",
        body:
          "Unidades de 2 a 4 ambientes, con opciones de entrepiso y unidades de vista panorámica con doble orientación al lago y la montaña. Desde el 2 ambientes funcional hasta los 130 m² del nivel superior, cada unidad está pensada para habitar o para una renta turística de categoría, entregada con terminaciones de primera calidad preparadas para el clima de montaña.",
        lists: [
          {
            heading: "Planta baja",
            items: [
              "2 ambientes — 60 m²",
              "3 ambientes — 90 m²",
              "Locales comerciales — 60 m² con vista al lago",
            ],
          },
          {
            heading: "Primer piso",
            items: [
              "2 ambientes — 60 m²",
              "3 ambientes — 90 m²",
              "2 ambientes vista panorámica — 100 m²",
            ],
          },
          {
            heading: "Segundo piso con entrepiso",
            items: [
              "3 ambientes + entrepiso — 85 m²",
              "4 ambientes + entrepiso — 115 m²",
              "3 ambientes vista panorámica — 130 m²",
            ],
          },
          // Miro 2026-07-15: "Orientaciones y vistas" pasa de la grilla (mucho aire)
          // a una lista compacta — toda la info en 2 renglones. El panel "Las Unidades
          // Panorámicas" se eliminó (pedido del cliente: sacarlo del menú).
          {
            heading: "Orientaciones y vistas",
            items: [
              "Montaña (cordillera y bosque andino) · Parcial al lago · Plena al lago · Panorámica (doble orientación lago + montaña).",
            ],
          },
        ],
      },
      {
        title: "Amenities",
        id: "amenities",
        home: true,
        // Miro 2026-07-15: texto reemplazado por el nuevo del cliente (dos párrafos;
        // el \n se respeta vía white-space: pre-line en el CSS).
        body:
          "Una pileta climatizada íntegramente vidriada, con vista directa al lago, acompañada de dos jacuzzis que permite vivir una experiencia para disfrutar todo el año, ya sea viendo nevar en invierno o disfrutando el sol de la montaña en verano.\nUn gimnasio completa la propuesta de bienestar teniendo en cuenta tu calidad de vida.",
        lists: [
          {
            heading: "Amenities",
            items: [
              "Pileta climatizada totalmente vidriada, con vista al lago",
              "Dos jacuzzi",
              "Gimnasio",
              "2 locales comerciales con vista al lago",
              "Bauleras",
            ],
          },
          {
            heading: "Servicios e infraestructura",
            items: [
              "Ascensores de primera marca: puertas automáticas, cabina en acero inoxidable, piso de granito y espejo",
              "2 grupos electrógenos para servicios comunes básicos",
              "Sistema de CCTV",
              "Calefacción central por radiadores (Peisa o similar), con calderas por piso",
            ],
          },
        ],
      },
      {
        title: "Calidad y Tecnología",
        home: true,
        body:
          "Cada decisión constructiva responde a una premisa: durar y rendir en la montaña. Estructura antisísmica según normas CIRSOC, aislación térmica reforzada y carpinterías con rotura de puente térmico y doble vidriado hermético para sostener el confort interior frente al frío patagónico. Climatización frío-calor por ambiente, conectividad completa y respaldo energético hacen de Maihuenia un edificio preparado para la exigencia del destino.",
        lists: [
          {
            heading: "Detalle técnico",
            items: [
              "Estructura de hormigón armado antisísmica (CIRSOC); fundaciones, columnas, vigas y losas.",
              "Aislación térmica reforzada para clima de montaña.",
              "Carpinterías exteriores de PVC negro con DVH y rotura de puente térmico.",
              "Climatización: cañerías embutidas para equipos split frío-calor por cada ambiente.",
              "Calefacción central por radiadores marca Peisa o similar.",
              "Instalación eléctrica con tableros individuales, telefonía, TV/cable y CCTV; alimentación para cocina eléctrica.",
              "Respaldo: 2 grupos electrógenos para servicios comunes.",
            ],
          },
        ],
      },
      // Miro 2026-07-15: el panel "El Equipo" se reemplazó por la sección propia
      // "Un equipo con trayectoria" (t.team) con item en el menú general.
      {
        title: "Financiación",
        id: "financing",
        home: true,
        body:
          "Una estructura de pagos transparente y por hitos, desde la reserva hasta la escritura, con financiación directa del desarrollo y tu asesor acompañándote en cada etapa.",
        lists: [
          {
            heading: "El plan, paso a paso",
            items: [
              "Reserva · USD 5.000 — Bloqueás tu unidad al precio de pre-venta.",
              "Boleto · 30% — Al firmar el boleto de compraventa.",
              "Saldo · 70% — En 24 cuotas mensuales en pesos, ajustables por índice CAC.",
            ],
          },
          {
            heading: "Entrega y condiciones",
            items: [
              "Entrega de los apartamentos: 24 a 30 meses.",
              "Financiación directa del desarrollo, sin intermediación bancaria.",
              "Ajuste por índice CAC (Cámara Argentina de la Construcción).",
            ],
          },
        ],
      },
      {
        title: "Beneficios",
        id: "benefits",
        home: true,
        body:
          "Más allá de los amenities, el edificio suma comodidades pensadas para el día a día y para que tu inversión rinda al máximo.",
        lists: [
          {
            heading: "Incluido en el edificio",
            items: ["Laundry de uso común para todos los residentes."],
          },
          {
            heading: "Disponibles para sumar",
            items: [
              "Bauleras: espacios de guardado adicionales, disponibles para comprar junto con tu unidad.",
            ],
          },
        ],
      },
    ] as SpecPanel[],
  },

  timeline: {
    sectionTitle: "Reserva y Cronograma de Obra",
    intro: "Una estructura de pagos transparente, por hitos, desde el boleto hasta la escritura.",
    plan: [
      {
        pct: "USD 5.000",
        when: "01 · Reserva",
        detail: "Bloqueás tu unidad al precio de pre-venta. El paso más simple para asegurar tu lugar.",
      },
      {
        pct: "30%",
        when: "02 · Boleto",
        detail: "Al firmar el boleto de compraventa completás el 30% del valor.",
      },
      {
        pct: "70%",
        when: "03 · Saldo",
        detail:
          "En 24 cuotas mensuales en pesos, ajustables por índice CAC. Financiación directa del desarrollo.",
      },
    ] as PaymentMilestone[],
    deliveryNote: "Entrega de los apartamentos: 24/30 meses",
    foot: "Tu asesor te acompañará en cada etapa.",
  },

  location: {
    sectionTitle: "Ubicación",
    intro: "Explorá los alrededores",
    addressLabel: "La Dirección",
    skiNote: "A 5 min del centro de esquí",
    directions: "Cómo llegar",
    exploreArea: "Explorar la zona",
    clickZoom: "Clic para zoom",
    recenter: "Centrar",
    gestures: {
      touch: "Usá dos dedos para mover el mapa",
      windows: "Usá Ctrl + scroll para el zoom",
      mac: "Usá ⌘ + scroll para el zoom",
    },
    /** POIs del mapa: las coordenadas viven en site.ts; acá sólo el texto. */
    poiName: (name: string) => name,
    poiCat: (cat: string) => cat,
  },

  residences: {
    sectionTitle: "Unidades Disponibles",
    note: "Disponibilidad sujeta a cambios según demanda",
    seeMore: "Ver más departamentos",
    planTag: (n: string) => `Departamento ${n} · Plano`,
  },

  contact: {
    sectionTitle: "Hablemos",
    intro: "Una consulta privada, respondida personalmente en 24 h hábiles.",
    asideCopy:
      "No comprás solamente un departamento: invertís en un activo que vas a poder disfrutar, alquilar y ver crecer.",
    thanks: "¡Gracias!",
    thanksNote: "Te vamos a contactar a la brevedad.",
    name: "Nombre",
    namePlaceholder: "Nombre completo",
    phone: "Teléfono",
    phonePlaceholder: "(000) 000-0000",
    email: "Email",
    emailPlaceholder: "vos@email.com",
    sending: "Enviando…",
    send: "Enviar consulta",
    sendError: "No se pudo enviar. Probá de nuevo.",
    disclaimer: "Esto no te obliga a realizar una compra.",
    wspCopy: "Consultanos por disponibilidad, financiación y asesoramiento personalizado.",
    wspCta: "Escribinos por WhatsApp",
    formMessage: (n: string) => `Hola, me interesa el Departamento ${n}. Quisiera más información.`,
  },

  tower: {
    tag: "EL EDIFICIO — VISTA AÉREA",
    aerialAlt: "Render aéreo del edificio",
    placeholder: "RENDER AÉREO · EDIFICIO SOBRE EL LAGO CAVIAHUE",
    backToTop: "Volver arriba",
    up: "ARRIBA",
  },

  unit: {
    /** Descripción de overview cuando la unidad no trae `description` propia. */
    defaultDescription: (u: Unit) => {
      const area = u.areas?.total ? `${u.areas.total} m² totales` : `${u.sqft} sq ft`;
      const dorms = u.beds === 1 ? "1 dormitorio" : `${u.beds} dormitorios`;
      const banos = u.baths === 1 ? "1 baño" : `${u.baths} baños`;
      const orient = u.orientation ? `, orientación ${u.orientation}` : "";
      return `Departamento ${u.residence}: ${dorms}, ${banos} y ${area}${orient}. Diseño contemporáneo con terminaciones de categoría y vistas al entorno de Caviahue.`;
    },
  },
};

export type Dict = typeof es;

const en: Dict = {
  numberLocale: "en-US",

  common: {
    residence: (n: string) => `Apartment ${n}`,
  },

  splash: {
    cta: "Discover",
    aria: "Showroom intro video",
  },

  seo: {
    homeH1: "TIER Bravo — Apartments at Mario Bravo 955, Buenos Aires",
    homeBody:
      "TIER Bravo, at Mario Bravo 955, is a development of 61 apartments in the City of Buenos Aires, from studios to 4-room units, across seven floors. Building amenities: pool with sun deck, gym, lounge and coworking, terrace grill and dining area, play area, covered parking and a staffed lobby. Explore the building in an interactive 360° tour and check floor plans, areas and availability.",
    showroomH1: "360° Showroom — Explore TIER Bravo at Mario Bravo 955",
    showroomBody:
      "Interactive tour of TIER Bravo, the building at Mario Bravo 955, City of Buenos Aires. Rotate the 360° view, explore the 61 apartments on floors 1 to 7, and enter each unit to see its floor plan, area and availability.",
    unitsNavLabel: "Apartments list",
    unitLink: (residence: string, beds: number) =>
      `Apartment ${residence} — ${beds >= 1 ? `${beds} ${beds === 1 ? "bedroom" : "bedrooms"}` : "studio"} at TIER Bravo, Mario Bravo 955`,
    projectTitle: "The project: 61 apartments at TIER Bravo",
    projectBody:
      "TIER Bravo is a residential development by CCM Desarrollos at Mario Bravo 955, City of Buenos Aires. The building brings together 61 apartments across seven floors: studios and 2-, 3- and 4-room units, with total areas ranging from 39.70 m² to 258.15 m². Floors 1 through 5 hold ten units each; the 6th and 7th are setback floors, with fewer units and larger terraces. Amenities include a pool with sun deck, a gym, a lounge and coworking space, a terrace grill and covered parking. Each apartment has its own page with floor plan, areas and up-to-date availability, and you can tour the entire building in 360° from this online showroom.",
    homeLink: "Back to the TIER Bravo home page",
  },

  notFound: {
    title: "Page not found",
    body: "The page you're looking for doesn't exist or has moved. Head back home to keep discovering TIER Bravo.",
    home: "Back to home",
    showroom: "Go to the showroom",
    credit: "Developed by",
  },

  status: {
    available: "Available",
    reserved: "Reserved",
    duplex: "Duplex",
    duplexTwoLevels: "Duplex (two levels)",
  },

  orientations: {
    N: "North",
    S: "South",
    E: "East",
    O: "West",
    NE: "Northeast",
    NO: "Northwest",
    SE: "Southeast",
    SO: "Southwest",
  },

  toolbar: {
    consultNow: "Inquire now",
    consultShort: "Inquire",
    share: "Share",
    linkCopied: "Link copied",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    menu: "Menu",
    availability: "Availability",
  },

  sideMenu: {
    close: "Close menu",
    menuPanel: "Menu",
    home: "Home",
    masterplan: "Masterplan",
    availability: "Availability",
    gallery: "Gallery",
    project: "The Project",
    amenities: "Amenities",
    tours: "Tours",
    toursHall: "Hall 360°",
    toursAmenities: "Amenities 360°",
    toursUnits: "Units",
    /** Floor label in the units submenu ("0" → Ground, rest → "Floor 1"…). */
    floor: (f: string) => (f === "0" ? "Ground" : `Floor ${f}`),
    brochure: "Brochure",
    location: "Location",
    caviahue: "Discover Caviahue",
    team: "The Team",
    contact: "Contact",
    polygonEditor: "Polygon editor",
    soon: "Soon",
    soonTitle: "Coming soon",
  },

  flyby: {
    loadingPercent: (pct: number) => `Loading… ${pct}%`,
    loadingView: "Loading…",
    loadingRoute: (pct: number) => `Loading route… ${pct}%`,
    preparingView: "Preparing the view…",
    backToView: (id: number) => `Back to view ${id}`,
    forwardToView: (id: number) => `Forward to view ${id}`,
    frameAlt: "Flight transition over the TIER Bravo building",
    stillAlt: (id: number) => `Render of the TIER Bravo building — view ${id}`,
    rotateLabel: "Rotate",
    home: "Back to start",
    hoverHintDesktop: "Hover over a unit to preview and enter it",
    hoverHintMobile: "Tap a unit to preview and enter it",
  },

  avance: {
    eyebrow: "Construction",
    title: "Construction progress",
    short: "Progress",
    progress: "Overall progress",
    milestone: "Current milestone",
    delivery: "Estimated delivery",
    lastUpdate: "Last update",
    empty: "We'll show the construction progress here very soon.",
    close: "Close",
  },

  rotateHint: {
    aria: "Orientation hint",
    brand: "Showroom TIER Bravo",
    title: "Rotate your phone",
    body: "Turn your device to landscape for the best experience.",
    continueAnyway: "Continue anyway",
  },

  vr: {
    open: "Open 360° tour",
    tour: "360° tour",
    virtualTour: "360° virtual tour",
    hall: "Entrance hall",
    amenities: "Amenities",
    close: "Close 360° tour",
  },

  unitTooltip: {
    planAlt: (n: string) => `Apartment ${n} floor plan`,
    enterAria: (n: string) => `Enter Apartment ${n}`,
    beds: "Beds",
    baths: "Baths",
    area: "m²",
  },

  unitCard: {
    rooms: (n: number) => `${n} rooms`,
    beds: (n: number) => (n === 1 ? "1 bedroom" : `${n} bedrooms`),
    baths: (n: number) => (n === 1 ? "1 bathroom" : `${n} bathrooms`),
  },

  finder: {
    open: "Search units",
    eyebrow: "Unit finder",
    title: (total: number) => `The ${total} Apartments`,
    countCaption: (total: number) => `Results · of ${total}`,
    searchPlaceholder: "Unit no.",
    searchAria: "Search by unit number",
    clearSearch: "Clear search",
    availability: "Availability",
    availabilityAll: "All",
    rooms: "Rooms",
    baths: "Baths",
    /** Chip values come raw from Airtable (Spanish), as everywhere else. */
    vistas: "Views",
    floor: "Floor",
    duplex: "Duplex",
    /** Filter for units that ship their own 360° tour (units.json → tour360). */
    tour360: "With 360° tour",
    sort: "Sort",
    sortNumber: "No.",
    sortArea: "m²",
    sortToggleAria: "Toggle sort direction",
    filters: "Filters",
    clearAll: "Clear all",
    seeResults: (n: number) => `View ${n} ${n === 1 ? "apartment" : "apartments"}`,
    clear: "Clear",
    close: "Close",
    emptyTitle: "No apartment matches",
    emptyBody: "Adjust the filters to see more.",
    floorFull: (key: string) => (key === "0" ? "Ground floor" : `Floor ${key}`),
    cardCta: "View apartment",
    statRooms: (n: number) => `${n} rooms`,
    statBeds: (n: number) => (n === 1 ? "1 bed" : `${n} beds`),
    statBaths: (n: number) => (n === 1 ? "1 bath" : `${n} baths`),
    statToilette: "toilette",
  },

  wa: {
    general: "Hi! I'm browsing the TIER Bravo Showroom and I have a question.",
    unit: (n: string) =>
      `Hi! I'm interested in Apartment ${n} at TIER Bravo (Mario Bravo 955). I'd like more information.`,
  },

  nav: {
    back: "Back",
    toTop: "Back to top",
    home: "Home",
    fullscreen: "Fullscreen",
    menu: "Menu",
    consult: "Inquire",
  },

  dataBar: {
    blurb: (u: {
      beds: number;
      baths: string;
      toilette?: number;
      area?: string;
      floor: string;
      duplex?: boolean;
      vistas?: string;
    }) => {
      const what = u.beds >= 1 ? `${u.beds}-bedroom apartment` : "Studio apartment";
      const dup = u.duplex ? " on two levels (duplex)" : "";
      const floor = u.floor === "0" ? "on the ground floor" : `on floor ${u.floor}`;
      const baths = `${u.baths} ${u.baths === "1" ? "bathroom" : "bathrooms"}${u.toilette ? " plus a guest toilet" : ""}`;
      const area = u.area ? ` and ${u.area} m² in total` : "";
      const views = u.vistas ? ` Views: ${u.vistas}.` : "";
      return `${what}${dup} ${floor} at TIER Bravo, Mario Bravo 955, City of Buenos Aires. It offers ${baths}${area}.${views}`;
    },
  },

  hero: {
    tourTitle: (n: string) => `360° Tour — Apartment ${n}`,
    explore360: "Explore 360° tour",
    photoAlt: (n: string) => `Render of Apartment ${n} — TIER Bravo`,
    photoAltN: (n: string, i: number) => `Apartment ${n} — view ${i}`,
    seePhotos: (count: number) => `See all ${count} photos`,
  },

  plan: {
    sectionTitle: "Unit Floor Plan",
    tabUnit: "Unit floor plan",
    tabFloor: "Full-floor plan",
    access: "Entrance",
    planAlt: (n: string) => `Apartment ${n} floor plan`,
    logoAlt: "TIER Bravo",
    overviewTitle: "Unit Summary",
    totalArea: "Total area",
    interior: "Interior",
    exterior: "Exterior",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    orientation: "Orientation",
    toilette: "Toilette",
    vistas: "Views",
    floor: "Floor",
    floorValue: (f: string) => (f === "0" ? "Ground" : `Floor ${f}`),
    amenities: "Amenities",
    amenitiesValue: "Spa, Pool & Gym",
    seePdf: "View PDF",
  },

  plate: {
    groundFloor: "Ground Floor",
    floor: (f: string) => `Floor ${f}`,
    yourResidence: "Your apartment",
    yourResidenceUpper: "YOUR APARTMENT",
    prevFloor: "Previous floor",
    nextFloor: "Next floor",
    duplexNote: "Duplex · bedroom on the mezzanine (floor above)",
    statsLine: (beds: number, baths: string, m2: string) => `${beds} Bed · ${baths} Bath${m2}`,
    rooms: (n: number) => `${n} rooms`,
    core: "CORE · CIRCULATION · ELEVATORS",
  },

  masterplan: {
    eyebrow: "Masterplan",
    title: "Building floor plans",
    close: "Close masterplan",
  },

  project: {
    eyebrow: "The development",
    title: "The Project",
    close: "Close",
    financingTitle: "Financing",
  },

  team: {
    eyebrow: "Institutional backing",
    title: "A team with a track record",
    intro:
      "Maihuenia is the work of an experienced team behind every stage: signature architecture, a transparent investment structure and professional sales management.",
    close: "Close",
    members: [
      {
        role: "Developer",
        name: "Fluir Desarrollos Inmobiliarios",
        logo: "/logos/fluir.png",
        featured: true,
      },
      {
        role: "Architecture studio",
        name: "Aslan y Ezcurra Arquitectos",
        logo: "/logos/aslan-ezcurra.png",
        featured: true,
      },
      { role: "Trustee", name: "Fiduciaria Profesional S.A.", logo: "/logos/fiduciaria-profesional.png" },
      { role: "Notary", name: "Dr. Francisco Puiggari", logo: "/logos/puiggari.png" },
      { role: "Accounting", name: "Miguel A. Monti y Asociados", logo: "/logos/estudio-monti.png" },
      { role: "Sales", name: "RE/MAX Oportunidades (Neuquén)", logo: "/logos/remax.png", solo: true },
    ],
  },

  anim: {
    volume: "Volume",
    mute: "Mute",
    unmute: "Unmute",
  },

  caviahue: {
    eyebrow: "The village",
    title: "Discover Caviahue",
    intro:
      "A mountain village among volcanoes, lakes and ancient araucaria forests, in northern Neuquén.",
    galleryAria: "Caviahue gallery",
    points: [
      {
        title: "Ski resort",
        body: "Cerro Caviahue, on the slopes of the Copahue volcano, with runs for every level all winter long.",
      },
      {
        title: "Copahue hot springs",
        body: "World-renowned thermal waters and volcanic mud, just minutes from the village.",
      },
      {
        title: "Salto del Agrio",
        body: "A striking waterfall plunging between volcanic rock walls and araucaria forests.",
      },
      {
        title: "Lake Caviahue",
        body: "The lake at the foot of town, ringed by ancient araucaria trees and walking trails.",
      },
      {
        title: "Town center",
        body: "The heart of the village, with everything you need steps from your apartment.",
      },
      {
        title: "Shops & dining",
        body: "Stores, restaurants and services to enjoy the mountains year-round.",
      },
    ],
  },

  galleryModal: {
    close: "Close gallery",
    prev: "Previous",
    next: "Next",
    alt: (i: number) => `Render ${i} — TIER Bravo`,
  },

  contactModal: {
    eyebrow: "Contact",
    title: "Want more information about the project?",
    subtitle:
      "Fill in your details and we'll reach out with unit availability, pricing and payment plans.",
    name: "Name",
    namePlaceholder: "Full name",
    phone: "Phone",
    phonePlaceholder: "(000) 000-0000",
    comment: "Message",
    commentPlaceholder: "Write your inquiry…",
    submit: "Send form",
    sending: "Sending…",
    sentTitle: "Thank you!",
    sent: "We received your inquiry and will contact you shortly.",
    error: "We couldn't send your inquiry. Try again or continue on WhatsApp.",
    whatsappCta: "I'd rather continue on WhatsApp",
    close: "Close",
    waMessage: (name: string, phone: string, comment: string) =>
      `Hi! I'm ${name || "—"}. My phone: ${phone || "—"}. I'd like more information about the TIER Bravo project (availability, pricing and payment plans).${
        comment ? ` Note: ${comment}` : ""
      }`,
  },

  specs: {
    sectionTitle: "Specifications",
    intro:
      "A complete look at the architecture, finishes and services that define the building and each apartment.",
    panels: [
      {
        title: "Architecture",
        body:
          "Contemporary architecture with a Patagonian identity, developed with noble materials such as stone and wood in a proposal of high construction quality. Naturally integrated with the landscape to make the most of the views over Lake Agrio and the Andes.",
        lists: [
          {
            heading: "Finishes",
            items: [
              "Wood-look porcelain tile flooring, 0.20 × 1.20 m, in living, dining, kitchen and bedrooms; bathrooms in 60 × 60 porcelain tile.",
              "Kitchens with melamine / lacquered cabinetry with wood details and Silestone countertop with stainless-steel sink.",
              "Double-height sliding-door wardrobes in wood-look melamine with aluminum profiles.",
              "Black PVC exterior window frames with double glazing (DVH).",
              "F30 fire-rated double-sheet entrance doors.",
            ],
          },
        ],
      },
      {
        title: "The Apartments",
        body:
          "Two- to four-room layouts, with mezzanine options and panoramic units enjoying dual lake-and-mountain orientation. From the efficient two-room apartment to the 130 m² of the top level, every unit is designed for living or for premium vacation rental, delivered with first-class finishes built for mountain weather.",
        lists: [
          {
            heading: "Ground floor",
            items: [
              "2 rooms — 60 m²",
              "3 rooms — 90 m²",
              "Retail units — 60 m² with lake views",
            ],
          },
          {
            heading: "First floor",
            items: [
              "2 rooms — 60 m²",
              "3 rooms — 90 m²",
              "2 rooms, panoramic view — 100 m²",
            ],
          },
          {
            heading: "Second floor with mezzanine",
            items: [
              "3 rooms + mezzanine — 85 m²",
              "4 rooms + mezzanine — 115 m²",
              "3 rooms, panoramic view — 130 m²",
            ],
          },
          {
            heading: "Orientations & views",
            items: [
              "Mountain (Andes range and native forest) · Partial lake view · Full lake view · Panoramic (dual lake + mountain orientation).",
            ],
          },
        ],
      },
      {
        title: "Amenities",
        id: "amenities",
        home: true,
        body:
          "A fully glazed heated pool with direct lake views, joined by two jacuzzis — an experience to enjoy all year round, whether watching the snow fall in winter or soaking up the mountain sun in summer.\nA gym completes the wellness offering with your quality of life in mind.",
        lists: [
          {
            heading: "Amenities",
            items: [
              "Fully glazed heated pool with lake views",
              "Two jacuzzis",
              "Gym",
              "2 retail units with lake views",
              "Storage units",
            ],
          },
          {
            heading: "Services & infrastructure",
            items: [
              "Top-brand elevators: automatic doors, stainless-steel cabin, granite floor and mirror",
              "2 backup generators for essential common services",
              "CCTV system",
              "Central heating by radiators (Peisa or similar), with boilers on each floor",
            ],
          },
        ],
      },
      {
        title: "Quality & Technology",
        home: true,
        body:
          "Every construction decision answers one premise: endure and perform in the mountains. Seismic-resistant structure built to CIRSOC standards, reinforced thermal insulation, and window frames with thermal-break and double glazing to hold indoor comfort against the Patagonian cold. Per-room heating and cooling, full connectivity and backup power make Maihuenia a building ready for the demands of the destination.",
        lists: [
          {
            heading: "Technical detail",
            items: [
              "Seismic-resistant reinforced-concrete structure (CIRSOC); foundations, columns, beams and slabs.",
              "Reinforced thermal insulation for mountain climate.",
              "Black PVC exterior frames with double glazing and thermal break.",
              "Climate control: concealed piping for split heating/cooling units in every room.",
              "Central heating by Peisa (or similar) radiators.",
              "Electrical installation with individual panels, telephony, TV/cable and CCTV; supply for electric kitchen.",
              "Backup: 2 generators for common services.",
            ],
          },
        ],
      },
      {
        title: "Financing",
        id: "financing",
        home: true,
        body:
          "A transparent, milestone-based payment structure, from booking to deed, with direct developer financing and your advisor by your side at every stage.",
        lists: [
          {
            heading: "The plan, step by step",
            items: [
              "Booking · USD 5,000 — Lock in your unit at the pre-sale price.",
              "Purchase agreement · 30% — Upon signing the deed of sale.",
              "Balance · 70% — In 24 monthly instalments in pesos, indexed to the CAC index.",
            ],
          },
          {
            heading: "Delivery & terms",
            items: [
              "Delivery of the apartments: 24 to 30 months.",
              "Direct developer financing, with no bank involved.",
              "Adjusted by the CAC (Argentine Construction Chamber) index.",
            ],
          },
        ],
      },
      {
        title: "Benefits",
        id: "benefits",
        home: true,
        body:
          "Beyond the amenities, the building adds conveniences designed for everyday living and to make the most of your investment.",
        lists: [
          {
            heading: "Included in the building",
            items: ["A shared laundry room for all residents."],
          },
          {
            heading: "Available to add",
            items: [
              "Storage units: additional storage spaces, available to purchase with your unit.",
            ],
          },
        ],
      },
    ],
  },

  timeline: {
    sectionTitle: "Reservation & Construction Timeline",
    intro: "A transparent, milestone-based payment structure, from purchase agreement to deed.",
    plan: [
      {
        pct: "USD 5,000",
        when: "01 · Reservation",
        detail: "Lock in your unit at the pre-sale price. The simplest step to secure your place.",
      },
      {
        pct: "30%",
        when: "02 · Purchase agreement",
        detail: "On signing the purchase agreement you complete 30% of the value.",
      },
      {
        pct: "70%",
        when: "03 · Balance",
        detail:
          "In 24 monthly installments in Argentine pesos, adjusted by the CAC construction index. Financed directly by the developer.",
      },
    ],
    deliveryNote: "Apartment delivery: 24/30 months",
    foot: "Your advisor will be with you at every stage.",
  },

  location: {
    sectionTitle: "Location",
    intro: "Explore the surroundings",
    addressLabel: "The Address",
    skiNote: "5 min from the ski resort",
    directions: "Get directions",
    exploreArea: "Explore the area",
    clickZoom: "Click to zoom",
    recenter: "Recenter",
    gestures: {
      touch: "Use two fingers to move the map",
      windows: "Use Ctrl + scroll to zoom the map",
      mac: "Use ⌘ + scroll to zoom the map",
    },
    poiName: (name: string) => POI_NAMES_EN[name] ?? name,
    poiCat: (cat: string) => POI_CATS_EN[cat] ?? cat,
  },

  residences: {
    sectionTitle: "Available Apartments",
    note: "Availability subject to change with demand",
    seeMore: "See more apartments",
    planTag: (n: string) => `Apartment ${n} · Floor plan`,
  },

  contact: {
    sectionTitle: "Let's Talk",
    intro: "A private inquiry, personally answered within 24 business hours.",
    asideCopy:
      "You're not just buying an apartment: you're investing in an asset you can enjoy, rent out and watch grow.",
    thanks: "Thank you!",
    thanksNote: "We'll get back to you shortly.",
    name: "Name",
    namePlaceholder: "Full name",
    phone: "Phone",
    phonePlaceholder: "(000) 000-0000",
    email: "Email",
    emailPlaceholder: "you@email.com",
    sending: "Sending…",
    send: "Send inquiry",
    sendError: "Something went wrong. Please try again.",
    disclaimer: "This does not commit you to a purchase.",
    wspCopy: "Ask us about availability, financing and personalized guidance.",
    wspCta: "Message us on WhatsApp",
    formMessage: (n: string) => `Hi, I'm interested in Apartment ${n}. I'd like more information.`,
  },

  tower: {
    tag: "THE BUILDING — AERIAL VIEW",
    aerialAlt: "Aerial render of the building",
    placeholder: "AERIAL RENDER · TIER BRAVO",
    backToTop: "Back to top",
    up: "TOP",
  },

  unit: {
    defaultDescription: (u: Unit) => {
      const area = u.areas?.total ? `${u.areas.total} m² total` : `${u.sqft} sq ft`;
      const beds = u.beds === 1 ? "1 bedroom" : `${u.beds} bedrooms`;
      const baths = u.baths === 1 ? "1 bathroom" : `${u.baths} bathrooms`;
      const orient = u.orientation ? `, facing ${u.orientation}` : "";
      return `Apartment ${u.residence}: ${beds}, ${baths} and ${area}${orient}. Contemporary design with premium finishes.`;
    },
  },
};

// POIs (site.ts tiene los nombres ES como keys + coordenadas).
const POI_NAMES_EN: Record<string, string> = {
  "Lago Caviahue": "Caviahue Lake",
  "Centro de Esquí Caviahue": "Caviahue Ski Resort",
  "Termas de Copahue": "Copahue Hot Springs",
  "Volcán Copahue": "Copahue Volcano",
  "Salto del Río Agrio": "Agrio River Falls",
  "Bosque de Araucarias": "Araucaria Forest",
};
const POI_CATS_EN: Record<string, string> = {
  Lago: "Lake",
  "Ski & Montaña": "Ski & Mountain",
  Termas: "Hot Springs",
  Volcán: "Volcano",
  Cascada: "Waterfall",
  "Reserva Natural": "Nature Reserve",
};

export const MESSAGES: Record<Lang, Dict> = { es, en };
