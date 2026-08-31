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
  /** PORTADA (raíz "/"): los tres desarrollos de TIER dividiendo la pantalla.
   *  Reemplazó al viejo `splash` de un solo proyecto (Camila, 30-08). */
  portada: {
    /** Bajada del logotipo de la marca paraguas, arriba de los tres paneles. */
    eyebrow: "Desarrollos",
    /** Estado de un proyecto que todavía no tiene a dónde llevar. */
    proximamente: "Próximamente",
    entrar: "Descubrir",
    ariaEntrar: (nombre: string) => `Entrar a ${nombre}`,
    /** Se anuncia al lector de pantalla mientras la navegación está en vuelo. */
    entrando: "Entrando…",
    /** Táctil: el 1er toque AMPLÍA el panel; la X vuelve a los tres. */
    ariaAmpliar: (nombre: string) => `Ampliar ${nombre}`,
    cerrar: "Volver a los tres desarrollos",
    /** Flecha del showroom que vuelve a la portada de TIER. */
    volver: "Volver a TIER Desarrollos",
    /** Zócalo: las cuatro virtudes de la desarrolladora, tal cual el key visual que
     *  entregó el cliente (dos a cada lado del logotipo de CCM). */
    virtudes: ["Desarrollamos", "Construimos", "Sustentamos", "Creamos valor"],
    ccmAlt: "CCM Desarrollos",
  },

  /** Copy SEO/accesible (sr-only) de las páginas visuales (home + showroom): dan
   *  un H1 y texto crawleable describiendo el desarrollo sin tocar el diseño. */
  seo: {
    homeH1: "TIER Bravo — Departamentos en Mario Bravo 955, Buenos Aires",
    homeBody:
      "TIER Bravo, en Mario Bravo 955, es un desarrollo de 63 departamentos en la Ciudad de Buenos Aires, de monoambiente a 4 ambientes, distribuidos en siete pisos. Amenities de edificio: pileta con solárium, gimnasio, SUM y coworking, parrilla y comedor de terraza, sector de juegos, cochera cubierta y lobby con seguridad. Recorré el edificio en un tour interactivo 360° y consultá plantas, superficies y disponibilidad.",
    showroomH1: "Showroom 360° — Recorré TIER Bravo, en Mario Bravo 955",
    showroomBody:
      "Recorrido interactivo de TIER Bravo, el edificio de Mario Bravo 955, Ciudad de Buenos Aires. Girá la vista en 360°, explorá los 63 departamentos de los pisos 1 a 7 y entrá a cada unidad para ver su planta, superficie y disponibilidad.",
    unitsNavLabel: "Listado de departamentos",
    unitLink: (residence: string, beds: number) =>
      `Departamento ${residence} — ${beds >= 1 ? `${beds} ${beds === 1 ? "dormitorio" : "dormitorios"}` : "monoambiente"} en TIER Bravo, Mario Bravo 955`,
    /** Sección "El proyecto" del bloque SEO del showroom: párrafo auto-contenido
     *  (~120 palabras) con SOLO datos reales del proyecto — también es el bloque
     *  citable para AI search (AI Overviews / Perplexity). */
    projectTitle: "El proyecto: 63 departamentos en TIER Bravo",
    projectBody:
      // Sólo datos verificados contra el listado de unidades del cliente. Sin fecha de
      // entrega ni lista cerrada de terminaciones hasta que las confirme.
      "TIER Bravo es un desarrollo residencial de CCM Desarrollos en Mario Bravo 955, Ciudad Autónoma de Buenos Aires. El edificio reúne 63 departamentos repartidos en siete pisos: monoambientes y unidades de 2, 3 y 4 ambientes, con superficies totales que van de 39,70 m² a 258,15 m². Los pisos 1 a 6 tienen diez unidades cada uno; el 7° es una planta de retiro, con tres unidades y terrazas de mayor superficie. Suma amenities de pileta con solárium, gimnasio, SUM y coworking, parrilla de terraza y cochera cubierta. Cada departamento tiene su ficha con plano, superficies y disponibilidad actualizados, y el edificio se recorre completo en 360° desde este showroom online.",
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
    /** Chip de TERRAZA propia (último piso). Mismo lugar y forma que el de dúplex. */
    terraza: "Terraza",
    /** Chip de exposición (mismo lugar que el de dúplex). */
    frente: "Frente",
    contrafrente: "Contrafrente",
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
    /** Barrita de zoom al costado del 360°. */
    zoom: "Zoom del recorrido",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
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
    /** Baños de la tarjeta compacta. `toilette` va PEGADO acá y no como un ítem
     *  suelto de la línea: la tarjeta mide 224px y clampea en 2 renglones, así que
     *  un bullet más empujaba la superficie fuera de la vista. */
    baths: (n: number, toilette = false) =>
      `${n === 1 ? "1 baño" : `${n} baños`}${toilette ? " + toilette" : ""}`,
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
    /** Frente / contrafrente (pedido del cliente, 25-08). */
    exposure: "Exposición",
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
      exposure?: "frente" | "contrafrente";
    }) => {
      const que =
        u.beds >= 1
          ? `Departamento de ${u.beds} ${u.beds === 1 ? "dormitorio" : "dormitorios"}`
          : "Monoambiente";
      const dup = u.duplex ? " en dos niveles (dúplex)" : "";
      // "al frente" / "al contrafrente" es como se busca en un aviso; suma un
      // diferenciador real al blurb, que si no queda casi igual entre unidades.
      const expo = u.exposure ? ` ${u.exposure === "frente" ? "al frente" : "al contrafrente"}` : "";
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
      return `${que}${dup}${expo} ${piso} de TIER Bravo, en Mario Bravo 955, Ciudad de Buenos Aires. Cuenta con ${detalle}.${vistas}`;
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
    /** 3.ª pestaña: sólo en las unidades con `terrazaPlan` (hoy las tres del 7°). */
    tabTerrace: "Terraza",
    // Miro 2026-07-15: se sacaron las leyendas "Lago Caviahue" / "Camino del Volcán"
    // que rodeaban el plano (el cliente preguntó qué eran → "sacarlo directamente").
    // 30-08: se sacó también `access` ("Acceso"), la flecha del plano — estaba clavada
    // en una esquina fija y caía mal en casi todos los planos (ver residencia.css).
    planAlt: (n: string) => `Plano Departamento ${n}`,
    terraceAlt: (n: string) => `Planta de la terraza del Departamento ${n}`,
    logoAlt: "TIER Bravo",
    overviewTitle: "Resumen de la Unidad",
    totalArea: "Superficie total",
    interior: "Interior",
    exterior: "Exterior",
    /** Desglose de superficies del resumen (pedido del cliente, 26-08). */
    covered: "Superficie cubierta",
    uncovered: "Superficie descubierta",
    common: "Superficie común",
    /** Tipología por ambientes. 1 ambiente = monoambiente (convención AR). */
    rooms: "Ambientes",
    roomsValue: (n: number) => (n <= 1 ? "Monoambiente" : `${n} ambientes`),
    bedrooms: "Dormitorios",
    bathrooms: "Baños",
    orientation: "Orientación",
    // Resumen de la unidad completo (Camila 2026-06-30).
    toilette: "Toilette",
    vistas: "Vistas",
    exposure: "Exposición",
    floor: "Piso",
    /** "0" → PB, resto → "1°"… */
    floorValue: (f: string) => (f === "0" ? "PB" : `${f}°`),
    amenities: "Amenities",
    amenitiesValue: "Gimnasio, cowork, SUM, parrillas, juegos, solárium y pileta",
    /** Botón de la fila Amenities: abre la misma hoja que el sidebar. */
    seeAmenities: "Ver amenities",
    seePdf: "Ver PDF",
  },

  plate: {
    groundFloor: "Planta Baja",
    /** Subsuelo (cochera): planta navegable, sin unidades. */
    basement: "Subsuelo",
    floor: (f: string) => `Piso ${f}`,
    yourResidence: "Tu departamento",
    yourResidenceUpper: "TU DEPARTAMENTO",
    prevFloor: "Piso anterior",
    nextFloor: "Piso siguiente",
    duplexNote: "Dúplex · dormitorio en el entrepiso (piso de arriba)",
    /** "1 Baño", no "1 Baños". `baths` llega ya formateado ("1", "2,5"), así que el
     *  plural se decide sobre el string. "Dorm" es abreviatura y no se declina. */
    statsLine: (beds: number, baths: string, m2: string) =>
      `${beds} Dorm · ${baths} ${baths === "1" ? "Baño" : "Baños"}${m2}`,
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

  /** "El Equipo" — modal propio del menú general. */
  team: {
    eyebrow: "Respaldo institucional",
    title: "Un equipo con trayectoria",
    intro:
      "TIER es la marca de desarrollos de CCM. Bravo, Avenue y Sinclair conforman su portfolio; este showroom es el de TIER Bravo, en Mario Bravo 955.",
    close: "Cerrar",
    // Los tres desarrollos de TIER (pedido del cliente, 26-08). Los tres llevan el
    // MISMO logotipo TIER, en su variante DORADA (`/logo.png`): la hoja es oscura y
    // la variante tinta desaparecía contra el fondo. Éste es Bravo, va destacado.
    members: [
      {
        role: "Este desarrollo",
        name: "TIER Bravo",
        logo: "/logo.png",
        featured: true,
      },
      { role: "También de TIER", name: "TIER Avenue", logo: "/logo.png" },
      { role: "También de TIER", name: "TIER Sinclair", logo: "/logo.png" },
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
        title: "Arquitectura",
        body:
          "Arquitectura contemporánea de identidad urbana, desarrollada con materiales nobles como la madera y el hormigón en una propuesta de alta calidad constructiva y tecnológica. El diálogo entre el hormigón visto, la calidez de la madera y las grandes superficies vidriadas define un lenguaje sobrio y actual, integrado al ritmo de Palermo.",
        // MEMORIA DESCRIPTIVA REAL — la mandó Camila el 30-08 porque lo publicado
        // estaba mal ("esto es lo correcto"). Lo anterior decía pisos de PVC,
        // carpinterías con DVH, mesada de granito, grifería/sanitarios Ferrum,
        // cielorrasos de hormigón visto y cerradura inteligente: nada de eso es así.
        // Si vuelve a cambiar, se corrige acá y en el bloque EN — no hay otra fuente.
        lists: [
          {
            heading: "Terminaciones por ambiente",
            items: [
              "Pasillos y living: pisos revestidos con porcelanato a elección.",
              "Cocina: pisos de porcelanato a elección; mueble bajo mesada y alacena en melamina de primera calidad de 18 mm, con diseño a definir; mesada de Silestone o similar, con zócalos y bacha Johnson de acero inoxidable; grifería monocomando modelo Arizona de FV o similar; horno y anafe eléctrico Domec.",
              "Baños: pisos y paredes revestidos con porcelanato a elección; grifería modelo Logos de Piazza o similar; sanitarios modelo Mónaco de Roca o similar; bañera de acrílico Bagnara o similar; vanitory de diseño en melamina de 18 mm con mesada de mármol o Silestone a definir.",
              "Dormitorios: porcelánico símil madera, medida a definir; frentes de placard espejados de piso a techo e interiores en melamina de 18 mm de primera calidad.",
            ],
          },
          {
            heading: "Carpinterías y puertas",
            items: [
              "Carpinterías de aluminio línea Modena o Vesta de Aluar, con premarco y cierre por falleba en las hojas activas.",
              "Vidrios laminados 3+3.",
              "Puertas placa de MDF molduradas, con cerradura Kallay y herrajes Currao con balancín y bocallave.",
              "Marcos de puertas interiores en chapa 18; puertas de incendio en chapa según la normativa vigente.",
              "Balcones con parapetos de vidrio y carpintería vidriada.",
            ],
          },
          {
            heading: "Paredes, cielorrasos y pintura",
            items: [
              "Yesería: paredes y cielorrasos terminados en yeso aplicado o suspendido, según el espacio.",
              "Pintura interior: enduido y tres manos de látex en paredes y cielorrasos.",
              "Pintura exterior: Recuplast o similar.",
            ],
          },
        ],
      },
      {
        title: "Los Departamentos",
        body:
          "Unidades funcionales de 1 a 4 ambientes, pensadas tanto para habitar como para una renta de categoría. Desde monoambientes eficientes de 34 m² hasta amplios semipisos con terrazas de más de 250 m² en el nivel superior, cada departamento se entrega con terminaciones de primera calidad: porcelanato a elección en los pisos, carpinterías de aluminio de piso a techo con vidrios laminados y calefacción central por losa radiante. Los pisos superiores suman balcones y grandes terrazas propias, aprovechando la mejor orientación y las visuales abiertas de Palermo.",
        lists: [
          {
            heading: "Tipologías",
            items: [
              "Monoambientes — desde 34 m² (cubiertos) · 39 a 41 m² totales",
              "2 ambientes — desde 51 m² (cubiertos) · 60 a 68 m² totales con balcón",
              "3 ambientes — desde 77 m² (cubiertos) · 86 a 113 m² totales con balcón",
              "4 ambientes — desde 93 m² (cubiertos), en pisos altos, con terrazas de gran superficie",
            ],
          },
          {
            heading: "La distribución",
            items: [
              "Pisos 1° a 5° — Planta de 10 unidades: monoambientes, 2 y 3 ambientes, todos con balcón al frente o al contrafrente.",
              "6° piso — Suma unidades de 4 ambientes de más de 160 m², ideales para vivienda familiar.",
              "7° piso — Semipisos exclusivos de 4 ambientes con terrazas propias de entre 124 y 129 m², de 217 a 258 m² totales. El nivel más aspiracional del edificio.",
            ],
          },
          {
            heading: "Orientaciones y vistas",
            items: [
              "Frente a Mario Bravo, con balcones sobre la arboleda de la calle.",
              "Contrafrente con vista al pulmón verde: jardín, pileta y expansión de amenities.",
              "Unidades superiores con terrazas y visuales abiertas sobre Palermo.",
            ],
          },
        ],
      },
      {
        title: "Amenities",
        id: "amenities",
        home: true,
        // Dos párrafos; el \n se respeta vía white-space: pre-line en el CSS.
        body:
          "Una pileta al aire libre con deck de madera, rodeada de verde, invita a desconectar y disfrutar del sol sin salir de casa. A su alrededor, un solárium, una zona de parrillas con comedor exterior y un jardín con juegos para los más chicos completan una expansión pensada para vivir todo el año, en familia o entre amigos.\nUn gimnasio totalmente equipado, un cowork y una sauna completan la propuesta de bienestar, teniendo en cuenta tu calidad de vida.",
        lists: [
          {
            heading: "Amenities",
            items: [
              "Pileta exterior con deck de madera y solárium",
              "Zona de parrillas con comedor al aire libre",
              "Jardín con juegos para niños",
              "Gimnasio totalmente equipado",
              "SUM amplio para eventos y encuentros",
              "Cowork",
              "Lavadero",
            ],
          },
          {
            heading: "Servicios e infraestructura",
            items: [
              "Ascensores de primera marca: puertas automáticas, cabina en acero inoxidable, piso de granito y espejo",
              "Grupo electrógeno para servicios comunes básicos",
              "Sistema de CCTV",
              "Cochera cubierta y bicicletero",
              "Bauleras",
              "Calefacción central por losa radiante, con termostato individual en cada unidad",
            ],
          },
        ],
      },
      {
        title: "Calidad y Tecnología",
        home: true,
        body:
          "Cada decisión constructiva responde a una premisa: durar y rendir en el tiempo. Estructura de hormigón armado, carpinterías de aluminio Aluar con vidrios laminados y calefacción central por losa radiante —con termostato individual en cada unidad— para sostener el confort interior durante todo el año. Pre-instalación de frío-calor por ambiente, conectividad completa y respaldo energético hacen de TIER Bravo un edificio preparado para la exigencia de la vida urbana.",
        lists: [
          {
            heading: "Detalle técnico",
            // Espejo del bloque de Arquitectura: acá va lo TÉCNICO de la misma memoria
            // del 30-08. Se cayeron los tres datos que estaban mal —PVC con DVH,
            // radiadores Peisa y una aislación que la memoria no menciona— y entró lo
            // que sí dice: aluminio Aluar con laminado 3+3 y losa radiante Giacomini.
            items: [
              "Estructura de hormigón armado según normas CIRSOC: fundaciones, columnas, vigas y losas.",
              "Carpinterías de aluminio línea Modena o Vesta de Aluar, con premarco y vidrios laminados 3+3.",
              "Calefacción central por losa radiante, con termostato individual en cada unidad para regular la temperatura; serpentinas de primera calidad marca Giacomini o similar.",
              "Aire acondicionado: pre-instalación de cañerías y desagües para equipos tipo split en cada ambiente.",
              "Portero eléctrico con cámara en planta baja y portero visor en cada unidad.",
              "Instalación eléctrica con tableros individuales y alimentación para cocina eléctrica.",
              "Respaldo: grupo electrógeno para servicios comunes.",
            ],
          },
        ],
      },
      {
        title: "Financiación",
        id: "financing",
        home: true,
        body:
          "Una estructura de pagos transparente y por etapas, desde el anticipo hasta la entrega, con financiación directa del desarrollo y tu asesor acompañándote en cada paso.",
        lists: [
          {
            heading: "El plan, paso a paso",
            items: [
              "Anticipo · 40% — Asegurás tu unidad al precio de pre-venta.",
              "Saldo · 60% — En 40 cuotas mensuales hasta la finalización de la obra.",
            ],
          },
          {
            heading: "Entrega y condiciones",
            items: [
              "Financiación directa del desarrollo, sin intermediación bancaria.",
              "Cuotas mensuales ajustables por índice CAC (Cámara Argentina de la Construcción).",
              "Plan de pagos acompañando el avance de obra hasta la entrega.",
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
            items: [
              "Bicicletero en planta baja, de uso común para todos los residentes.",
              "Lavadero de uso común para todos los residentes.",
            ],
          },
          {
            heading: "Disponibles para sumar",
            items: [
              "Cocheras para autos: 26 unidades disponibles para comprar junto con tu departamento.",
              "Espacios para bicicletas: 45 plazas en subsuelo, disponibles para adquirir con tu unidad.",
            ],
          },
        ],
      },
    ] as SpecPanel[],
  },

  /**
   * Hoja "Amenities" del menú del showroom. Es un TEXTO PROPIO, no el panel de
   * Amenities de "El Proyecto": el cliente entregó dos versiones distintas (26-08),
   * una más narrativa para esta hoja y otra más corta para el acordeón del proyecto.
   */
  amenitiesSheet: {
    body:
      "Cada espacio de TIER Bravo fue pensado para que la vida puertas adentro sea tan rica como la del barrio que lo rodea. En el corazón de Palermo, el edificio propone un modo de habitar donde el bienestar, el encuentro y el descanso conviven en armonía.\nUna pileta con deck de madera al aire libre, rodeada de verde, invita a desconectar sin salir de casa. A su alrededor, un solárium, una zona de parrillas con comedor exterior y un jardín con juegos para los más chicos completan una expansión pensada para disfrutar todo el año, en familia o entre amigos.\nPuertas adentro, un gimnasio totalmente equipado, un cowork luminoso y un SUM amplio acompañan tu día a día: entrenar, trabajar o recibir, cada momento tiene su lugar. Una sauna suma ese detalle de spa que transforma la rutina en un ritual.",
    lists: [
      {
        heading: "Amenities",
        items: [
          "Pileta exterior con deck de madera y solárium",
          "Zona de parrillas con mesas al aire libre",
          "Jardín con juegos para niños",
          "Gimnasio totalmente equipado",
          "SUM amplio para eventos y encuentros",
          "Cowork luminoso e integrado al verde",
          "2 locales comerciales sobre Mario Bravo",
        ],
      },
      {
        heading: "Servicios e infraestructura",
        items: [
          "Cochera cubierta con múltiples plazas de estacionamiento",
          "Bicicletero",
          "Ascensores de primera marca",
          "Sistema de CCTV en espacios comunes",
          "Grupo electrógeno para servicios comunes",
          "Calefacción central por losa radiante y terminaciones de categoría (porcelanato y carpinterías de aluminio de piso a techo)",
        ],
      },
    ],
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
    /** Nota bajo la dirección, en el mapa de la ficha. */
    skiNote: "En el corazón de Palermo",
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
    // Ya no es una vista aérea: es el render de la fachada (vista 01).
    tag: "EL EDIFICIO",
    aerialAlt: "TIER Bravo — fachada sobre Mario Bravo",
    placeholder: "RENDER · TIER BRAVO",
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
      return `Departamento ${u.residence}: ${dorms}, ${banos} y ${area}${orient}. Diseño contemporáneo con terminaciones de categoría, en el corazón de Palermo.`;
    },
  },
};

export type Dict = typeof es;

const en: Dict = {
  numberLocale: "en-US",

  common: {
    residence: (n: string) => `Apartment ${n}`,
  },

  portada: {
    eyebrow: "Developments",
    proximamente: "Coming soon",
    entrar: "Discover",
    ariaEntrar: (nombre: string) => `Enter ${nombre}`,
    entrando: "Entering…",
    ariaAmpliar: (nombre: string) => `Expand ${nombre}`,
    cerrar: "Back to all three developments",
    volver: "Back to TIER Desarrollos",
    virtudes: ["We develop", "We build", "We sustain", "We create value"],
    ccmAlt: "CCM Desarrollos",
  },

  seo: {
    homeH1: "TIER Bravo — Apartments at Mario Bravo 955, Buenos Aires",
    homeBody:
      "TIER Bravo, at Mario Bravo 955, is a development of 63 apartments in the City of Buenos Aires, from studios to 4-room units, across seven floors. Building amenities: pool with sun deck, gym, lounge and coworking, terrace grill and dining area, play area, covered parking and a staffed lobby. Explore the building in an interactive 360° tour and check floor plans, areas and availability.",
    showroomH1: "360° Showroom — Explore TIER Bravo at Mario Bravo 955",
    showroomBody:
      "Interactive tour of TIER Bravo, the building at Mario Bravo 955, City of Buenos Aires. Rotate the 360° view, explore the 63 apartments on floors 1 to 7, and enter each unit to see its floor plan, area and availability.",
    unitsNavLabel: "Apartments list",
    unitLink: (residence: string, beds: number) =>
      `Apartment ${residence} — ${beds >= 1 ? `${beds} ${beds === 1 ? "bedroom" : "bedrooms"}` : "studio"} at TIER Bravo, Mario Bravo 955`,
    projectTitle: "The project: 63 apartments at TIER Bravo",
    projectBody:
      "TIER Bravo is a residential development by CCM Desarrollos at Mario Bravo 955, City of Buenos Aires. The building brings together 63 apartments across seven floors: studios and 2-, 3- and 4-room units, with total areas ranging from 39.70 m² to 258.15 m². Floors 1 through 6 hold ten units each; the 7th is a setback floor, with three units and larger terraces. Amenities include a pool with sun deck, a gym, a lounge and coworking space, a terrace grill and covered parking. Each apartment has its own page with floor plan, areas and up-to-date availability, and you can tour the entire building in 360° from this online showroom.",
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
    terraza: "Terrace",
    // "Street-facing" / "Rear-facing": lo que usa un aviso inmobiliario en inglés.
    // "Front"/"Back" a secas se lee como frente/dorso del edificio, no como vista.
    frente: "Street-facing",
    contrafrente: "Rear-facing",
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
    zoom: "Tour zoom",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },

  unitTooltip: {
    planAlt: (n: string) => `Apartment ${n} floor plan`,
    enterAria: (n: string) => `Enter Apartment ${n}`,
    beds: "Beds",
    baths: "Baths",
    area: "m²",
  },

  unitCard: {
    /** "1 rooms" era el bug: en inglés un monoambiente son 0 dormitorios y 1 ambiente,
     *  y la tarjeta lo imprimía en plural mientras la ficha de esa MISMA unidad decía
     *  "Studio" (25 de 63 unidades). Se unifica con la ficha. En español no pasa:
     *  "1 amb" es una abreviatura y no se declina. */
    rooms: (n: number) => (n <= 1 ? "Studio" : `${n} rooms`),
    beds: (n: number) => (n === 1 ? "1 bedroom" : `${n} bedrooms`),
    baths: (n: number, toilette = false) =>
      `${n === 1 ? "1 bathroom" : `${n} bathrooms`}${toilette ? " + toilet" : ""}`,
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
    exposure: "Exposure",
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
    statRooms: (n: number) => (n <= 1 ? "Studio" : `${n} rooms`),
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
      exposure?: "frente" | "contrafrente";
    }) => {
      const what = u.beds >= 1 ? `${u.beds}-bedroom apartment` : "Studio apartment";
      const dup = u.duplex ? " on two levels (duplex)" : "";
      const expo = u.exposure
        ? u.exposure === "frente"
          ? ", street-facing,"
          : ", facing the quiet inner courtyard,"
        : "";
      const floor = u.floor === "0" ? "on the ground floor" : `on floor ${u.floor}`;
      const baths = `${u.baths} ${u.baths === "1" ? "bathroom" : "bathrooms"}${u.toilette ? " plus a guest toilet" : ""}`;
      const area = u.area ? ` and ${u.area} m² in total` : "";
      const views = u.vistas ? ` Views: ${u.vistas}.` : "";
      return `${what}${dup}${expo} ${floor} at TIER Bravo, Mario Bravo 955, City of Buenos Aires. It offers ${baths}${area}.${views}`;
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
    tabTerrace: "Terrace",
    planAlt: (n: string) => `Apartment ${n} floor plan`,
    terraceAlt: (n: string) => `Apartment ${n} terrace plan`,
    logoAlt: "TIER Bravo",
    overviewTitle: "Unit Summary",
    totalArea: "Total area",
    interior: "Interior",
    exterior: "Exterior",
    covered: "Covered area",
    uncovered: "Open-air area",
    common: "Share of common areas",
    rooms: "Layout",
    roomsValue: (n: number) => (n <= 1 ? "Studio" : `${n} rooms`),
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    orientation: "Orientation",
    toilette: "Toilette",
    vistas: "Views",
    exposure: "Exposure",
    floor: "Floor",
    floorValue: (f: string) => (f === "0" ? "Ground" : `Floor ${f}`),
    amenities: "Amenities",
    amenitiesValue: "Gym, coworking, multipurpose room, barbecues, playground, solarium and pool",
    seeAmenities: "View amenities",
    seePdf: "View PDF",
  },

  plate: {
    groundFloor: "Ground Floor",
    basement: "Basement",
    floor: (f: string) => `Floor ${f}`,
    yourResidence: "Your apartment",
    yourResidenceUpper: "YOUR APARTMENT",
    prevFloor: "Previous floor",
    nextFloor: "Next floor",
    duplexNote: "Duplex · bedroom on the mezzanine (floor above)",
    statsLine: (beds: number, baths: string, m2: string) =>
      `${beds} ${beds === 1 ? "Bed" : "Beds"} · ${baths} ${baths === "1" ? "Bath" : "Baths"}${m2}`,
    rooms: (n: number) => (n <= 1 ? "Studio" : `${n} rooms`),
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
      "TIER is CCM's development brand. Bravo, Avenue and Sinclair make up its portfolio; this showroom is TIER Bravo, at Mario Bravo 955.",
    close: "Close",
    members: [
      {
        role: "This development",
        name: "TIER Bravo",
        logo: "/logo.png",
        featured: true,
      },
      { role: "Also by TIER", name: "TIER Avenue", logo: "/logo.png" },
      { role: "Also by TIER", name: "TIER Sinclair", logo: "/logo.png" },
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
          "Contemporary architecture with an urban identity, developed with noble materials such as wood and concrete in a proposal of high construction and technical quality. The dialogue between exposed concrete, the warmth of wood and large glazed surfaces defines a restrained, current language, at home in the rhythm of Palermo.",
        // Espejo EN del bloque ES (ver el comentario largo alla arriba): esta es la
        // memoria descriptiva real que mando el cliente el 30-08. Si se toca uno de
        // los dos idiomas hay que tocar el otro.
        lists: [
          {
            heading: "Finishes by room",
            items: [
              "Hallways and living area: porcelain tile floors, finish to be selected.",
              "Kitchen: porcelain tile floors, finish to be selected; base and wall units in first-quality 18 mm melamine, design to be defined; Silestone (or similar) countertop with splashbacks and a Johnson stainless-steel sink; single-lever Arizona tap by FV or similar; Domec electric oven and hob.",
              "Bathrooms: porcelain tile floors and walls, finish to be selected; Logos taps by Piazza or similar; Monaco sanitaryware by Roca or similar; Bagnara acrylic bathtub or similar; designer vanity unit in 18 mm melamine with a marble or Silestone top, to be defined.",
              "Bedrooms: wood-look porcelain tile, size to be defined; floor-to-ceiling mirrored wardrobe fronts with first-quality 18 mm melamine interiors.",
            ],
          },
          {
            heading: "Frames and doors",
            items: [
              "Aluminium frames, Aluar Modena or Vesta line, with sub-frame and espagnolette closing on the operable sashes.",
              "3+3 laminated glass.",
              "Moulded MDF panel doors with a Kallay lock and Currao hardware, lever handle and keyhole escutcheon.",
              "Interior door frames in 18-gauge sheet steel; sheet-steel fire doors to current regulations.",
              "Balconies with glass parapets and glazed frames.",
            ],
          },
          {
            heading: "Walls, ceilings and paint",
            items: [
              "Plasterwork: walls and ceilings finished in applied or suspended plaster, depending on the space.",
              "Interior paint: filler plus three coats of latex on walls and ceilings.",
              "Exterior paint: Recuplast or similar.",
            ],
          },
        ],
      },
      {
        title: "The Apartments",
        body:
          "Functional units of one to four rooms, designed both to live in and as premium rental stock. From efficient 34 m² studios to generous half-floor apartments with terraces of over 250 m² on the top level, every apartment is delivered with first-class finishes: porcelain tile floors, floor-to-ceiling aluminium frames with laminated glass and central underfloor heating. The upper floors add balconies and large private terraces, making the most of the best orientation and the open views over Palermo.",
        lists: [
          {
            heading: "Layouts",
            items: [
              "Studios — from 34 m² (covered) · 39 to 41 m² total",
              "2 rooms — from 51 m² (covered) · 60 to 68 m² total with balcony",
              "3 rooms — from 77 m² (covered) · 86 to 113 m² total with balcony",
              "4 rooms — from 93 m² (covered), on the upper floors, with large terraces",
            ],
          },
          {
            heading: "The distribution",
            items: [
              "Floors 1 to 5 — Ten units per floor: studios, 2- and 3-room apartments, all with a balcony facing the street or the rear.",
              "Floor 6 — Adds 4-room units of over 160 m², ideal for family living.",
              "Floor 7 — Exclusive 4-room half-floor apartments with private terraces of 124 to 129 m², 217 to 258 m² in total. The building's most aspirational level.",
            ],
          },
          {
            heading: "Orientations & views",
            items: [
              "Facing Mario Bravo, with balconies over the street's tree canopy.",
              "Rear-facing, overlooking the green courtyard: garden, pool and the amenities expansion.",
              "Upper units with terraces and open views over Palermo.",
            ],
          },
        ],
      },
      {
        title: "Amenities",
        id: "amenities",
        home: true,
        body:
          "An outdoor pool with a wooden deck, surrounded by greenery, invites you to unwind and enjoy the sun without leaving home. Around it, a solarium, a barbecue area with outdoor dining and a garden with a children's playground complete an expansion designed to be lived in all year round, with family or friends.\nA fully equipped gym, a coworking space and a sauna round out the wellness offering, with your quality of life in mind.",
        lists: [
          {
            heading: "Amenities",
            items: [
              "Outdoor pool with wooden deck and solarium",
              "Barbecue area with outdoor dining",
              "Garden with a children's playground",
              "Fully equipped gym",
              "Spacious multipurpose room for events and gatherings",
              "Coworking space",
              "Laundry room",
            ],
          },
          {
            heading: "Services & infrastructure",
            items: [
              "Top-brand elevators: automatic doors, stainless-steel cabin, granite floor and mirror",
              "Backup generator for essential common services",
              "CCTV system",
              "Covered parking and bicycle storage",
              "Storage units",
              "Central underfloor heating, with an individual thermostat in every unit",
            ],
          },
        ],
      },
      {
        title: "Quality & Technology",
        home: true,
        body:
          "Every construction decision answers one premise: endure and perform over time. Reinforced-concrete structure, Aluar aluminium frames with laminated glass, and central underfloor heating with an individual thermostat in every unit to hold indoor comfort all year round. Pre-installation for per-room heating and cooling, full connectivity and backup power make TIER Bravo a building ready for the demands of city living.",
        lists: [
          {
            heading: "Technical detail",
            items: [
              "Reinforced-concrete structure built to CIRSOC standards: foundations, columns, beams and slabs.",
              "Aluminium frames, Aluar Modena or Vesta line, with sub-frame and 3+3 laminated glass.",
              "Central underfloor heating with an individual thermostat in every unit; first-quality Giacomini (or similar) coils.",
              "Air conditioning: pre-installed piping and drainage for split units in every room.",
              "Video door entry with a camera at street level and a monitor in every unit.",
              "Electrical installation with individual panels and supply for an electric kitchen.",
              "Backup: generator for common services.",
            ],
          },
        ],
      },
      {
        title: "Financing",
        id: "financing",
        home: true,
        body:
          "A transparent, staged payment structure, from the down payment to delivery, with direct developer financing and your advisor by your side at every step.",
        lists: [
          {
            heading: "The plan, step by step",
            items: [
              "Down payment · 40% — Secure your unit at the pre-sale price.",
              "Balance · 60% — In 40 monthly instalments through to completion of the works.",
            ],
          },
          {
            heading: "Delivery & terms",
            items: [
              "Direct developer financing, with no bank involved.",
              "Monthly instalments indexed to the CAC (Argentine Construction Chamber) index.",
              "Payment plan tracking construction progress through to delivery.",
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
            items: [
              "Bicycle storage on the ground floor, shared by all residents.",
              "A shared laundry room for all residents.",
            ],
          },
          {
            heading: "Available to add",
            items: [
              "Car parking spaces: 26 available to purchase alongside your apartment.",
              "Bicycle spaces: 45 in the basement, available to purchase with your unit.",
            ],
          },
        ],
      },
    ],
  },

  amenitiesSheet: {
    body:
      "Every space at TIER Bravo was designed so that life indoors is as rich as the neighbourhood around it. In the heart of Palermo, the building proposes a way of living where wellbeing, gathering and rest coexist in balance.\nAn outdoor pool with a wooden deck, surrounded by greenery, invites you to unwind without leaving home. Around it, a solarium, a barbecue area with outdoor dining and a garden with a children's playground complete an expansion designed to be enjoyed all year round, with family or friends.\nIndoors, a fully equipped gym, a light-filled coworking space and a spacious multipurpose room support your day to day: training, working or hosting — every moment has its place. A sauna adds that spa touch that turns routine into ritual.",
    lists: [
      {
        heading: "Amenities",
        items: [
          "Outdoor pool with wooden deck and solarium",
          "Barbecue area with outdoor tables",
          "Garden with a children's playground",
          "Fully equipped gym",
          "Spacious multipurpose room for events and gatherings",
          "Light-filled coworking space opening onto the greenery",
          "2 retail units on Mario Bravo",
        ],
      },
      {
        heading: "Services & infrastructure",
        items: [
          "Covered parking with multiple spaces",
          "Bicycle storage",
          "Top-brand elevators",
          "CCTV system in common areas",
          "Backup generator for common services",
          "Central underfloor heating and premium finishes (porcelain tile and floor-to-ceiling aluminium frames)",
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
    skiNote: "In the heart of Palermo",
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
    tag: "THE BUILDING",
    aerialAlt: "TIER Bravo — façade on Mario Bravo",
    placeholder: "RENDER · TIER BRAVO",
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
