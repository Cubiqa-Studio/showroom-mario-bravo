import type { SiteConfig } from "@/lib/types";
import galleryManifest from "./gallery.json";

// ─────────────────────────────────────────────────────────────────────────────
// Config a nivel PROYECTO para las landings de detalle.
//
// Son datos compartidos por TODAS las unidades (broker, ubicación del edificio,
// terminaciones comunes), así no se duplican en cada una de las 61.
//
// ⚠ Bootstrap inicial: los campos marcados PLACEHOLDER todavía no los entregó el
// cliente. Están explícitos (y no vacíos) para que la app renderice; reemplazalos
// antes de mostrarle esto a nadie. La lista completa de lo que falta está en el
// README, sección "Qué falta".
// ─────────────────────────────────────────────────────────────────────────────

export const SITE: SiteConfig = {
  projectName: "Showroom TIER Bravo",
  developer: "Cubiqa Studio",
  addressBase: "Mario Bravo 955, Ciudad Autónoma de Buenos Aires",
  // Pisos con unidades. La planta baja (amenities), el subsuelo (cochera) y la
  // azotea del 8° NO tienen unidades → no son pisos navegables del selector.
  // SS y 0 y 8 NO tienen unidades: son la cochera, los amenities y la azotea. Se
  // muestran igual (es lo que pregunta el que compra) y simplemente no llevan
  // polígonos clicables. El orden es el de recorrido, de abajo hacia arriba, y
  // tiene que coincidir con FLOOR_ORDER en scripts/make-plates.mjs.
  floors: ["SS", "0", "1", "2", "3", "4", "5", "6", "7", "8"],
  // PLACEHOLDER — coordenadas APROXIMADAS de la altura 900 de Mario Bravo (CABA).
  // Pedile al cliente el pin exacto (link de Google Maps) y reemplazalas: esto es
  // lo que posiciona el marker del mapa de Ubicación y el GeoCoordinates del JSON-LD.
  location: { lat: -34.5985, lng: -58.4215 },
  brandName: "TIER Bravo",
  // Nombre del edificio — se muestra en el marker del mapa de Ubicación.
  buildingName: "TIER Bravo",
  tagline: "MARIO BRAVO 955 · BUENOS AIRES",
  // PLACEHOLDER — el equipo de ventas todavía no está definido.
  broker: {
    name: "Ventas · TIER Bravo",
    role: "Asesores",
    phone: "", // PLACEHOLDER — ver también WHATSAPP_NUMBER en src/lib/contact.ts
    email: "", // PLACEHOLDER
    photo: "", // vacío → avatar genérico
  },
  // PROVISORIO — derivado de los renders entregados, NO de un pliego del cliente.
  // Verificalo contra la memoria descriptiva antes de publicarlo.
  defaultSpecs: [
    {
      category: "Amenities del edificio",
      items: [
        { label: "Pileta", value: "Pileta exterior con deck y solárium" },
        { label: "Gimnasio", value: "Equipado, con vista a la pileta" },
        { label: "SUM", value: "Salón de usos múltiples y coworking" },
        { label: "Parrilla", value: "Parrilla y comedor de terraza" },
        { label: "Juegos", value: "Sector de juegos infantiles" },
        { label: "Acceso", value: "Lobby con seguridad" },
      ],
    },
    {
      category: "Terminaciones",
      items: [
        { label: "Pisos", value: "Porcelanato símil madera" },
        { label: "Cocina", value: "Muebles bajo mesada y alacena, mesada de cuarzo" },
        { label: "Losas", value: "Hormigón visto" },
      ],
    },
    {
      category: "Servicios",
      items: [
        { label: "Cochera", value: "Cochera cubierta en subsuelo" },
        { label: "Entrega", value: "A convenir — consultá disponibilidad" },
      ],
    },
  ],

  // El contenido EDITORIAL (specNarrative, paymentPlan, deliveryNote) vive en
  // src/i18n/translations.ts (es/en) — texto por-idioma, no config del sitio.

  // PLACEHOLDER — vacío A PROPÓSITO. Los POIs pintan pines en el mapa de Ubicación;
  // inventarlos publica datos falsos sobre el entorno del edificio. Cargá los reales
  // (subte, parques, universidades, gastronomía del barrio) con coords verificadas.
  pois: [],

  // PLACEHOLDER — el aéreo del footer/404 usa un render exterior hasta que llegue
  // la toma aérea real del edificio.
  // Vista 01 (`stop-0`): la fachada sobre Mario Bravo, la misma con la que abre el
  // showroom. Cierra la landing a pantalla completa (TowerSection) y es el fondo del 404.
  aerialImage: "/stops/stop-0.webp",

  // Galería del menú — renders del cliente optimizados a WebP por
  // `scripts/optimize-gallery.mjs`. Para sumar/actualizar imágenes: dejá los
  // originales en `_media-src/gallery/` y corré `npm run gallery:optimize`.
  gallery: galleryManifest.images,
};
