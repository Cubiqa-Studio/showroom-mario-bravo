import type { Metadata } from "next";
import { SITE } from "@/data/site";
import type { Unit } from "./types";
import { normalizeAmount, unitTotalBaths } from "./residencia";

// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de la configuración SEO del microsite (metadata, OG/Twitter,
// canonical, JSON-LD). Centralizado acá para que todas las rutas sean coherentes
// y para reusarlo en próximos showrooms.
// ─────────────────────────────────────────────────────────────────────────────

// Dominio de producción. Alimenta canonical, og:url y el sitemap.
// Overridable con NEXT_PUBLIC_SITE_URL sin tocar código.
const PROD_SITE_URL = "https://tierbravo.kuvus.app";

// URL ABSOLUTA del sitio — imprescindible para canonical, og:url, sitemap y para
// que og:image sea absoluta (clave para el preview al compartir en Meta Ads/WhatsApp).
// Prioridad: env explícita → URL que inyecta el host (Netlify) → dominio de prod →
// dev. En prod NUNCA cae a localhost aunque falte la env (así el OG no se rompe).
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL || // Netlify: dominio primario del sitio
  process.env.DEPLOY_PRIME_URL || // Netlify: deploy preview
  (process.env.NODE_ENV === "production" ? PROD_SITE_URL : "http://localhost:3000")
).replace(/\/+$/, "");

export const SITE_NAME = SITE.buildingName ?? "TIER Bravo";
export const BRAND_SHORT = "TIER Bravo";
export const OG_LOCALE = "es_AR";
export const HTML_LANG = "es-AR";

// Descripción por defecto (150–160 chars) — home / fallback.
export const DEFAULT_DESCRIPTION =
  "TIER Bravo, en Mario Bravo 955: 63 departamentos de 1 a 4 ambientes en Buenos Aires. Recorré la fachada en 360°, elegí tu unidad y mirá plano y superficies.";

export const OG_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: "Render de TIER Bravo, departamentos en Mario Bravo 955, Buenos Aires",
} as const;

/** Convierte una ruta/relativa en URL absoluta contra el origen del sitio. */
export function absolute(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// ── Helper de metadata por ruta ──────────────────────────────────────────────
// Devuelve canonical + OpenGraph + Twitter completos y coherentes. Cada página lo
// usa así no se repite la estructura (y el preview sale igual de bien en todas).
export function pageMetadata(opts: {
  title?: string;
  description: string;
  path: string; // ruta absoluta desde la raíz, ej. "/showroom"
  image?: { url: string; width?: number; height?: number; alt?: string };
  type?: "website" | "article";
}): Metadata {
  const { title, description, path, type = "website" } = opts;
  const img = opts.image ?? OG_IMAGE;
  const url = absolute(path);
  // El `title.template` del layout sólo aplica al <title>; acá se replica a mano para
  // que og:title y twitter:title digan lo mismo.
  const ogTitle = title
    ? `${title} — ${BRAND_SHORT}`
    : `${BRAND_SHORT} — Departamentos en Mario Bravo 955, Buenos Aires`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      title: ogTitle,
      description,
      images: [
        {
          url: img.url,
          width: img.width ?? OG_IMAGE.width,
          height: img.height ?? OG_IMAGE.height,
          alt: img.alt ?? OG_IMAGE.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [img.url],
    },
  };
}

// ── JSON-LD ──────────────────────────────────────────────────────────────────
// Sólo tipos VIGENTES de schema.org. BreadcrumbList da rich result; el resto aporta
// contexto semántico (Organization, WebSite, ApartmentComplex, Apartment). Sin HowTo
// ni FAQ (ya no dan rich results). VideoObject se omite: requiere uploadDate real.

const POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Mario Bravo 955",
  addressLocality: "Ciudad Autónoma de Buenos Aires",
  addressRegion: "CABA",
  addressCountry: "AR",
} as const;

const GEO = {
  "@type": "GeoCoordinates",
  latitude: SITE.location.lat,
  longitude: SITE.location.lng,
} as const;

// Copiados de las dos listas que entregó el cliente y que el sitio ya muestra: la hoja
// de Amenities (26-08) y la memoria descriptiva (30-08), en src/i18n/translations.ts.
// Si un amenity no está en una de esas entregas, no se publica.
const AMENITIES = [
  "Pileta exterior con deck de madera y solárium",
  "Zona de parrillas con comedor al aire libre",
  "Jardín con juegos para niños",
  "Gimnasio totalmente equipado",
  "SUM amplio para eventos y encuentros",
  "Cowork",
  "Sauna",
  "Lavadero",
  "Cochera cubierta",
  "Bicicletero",
  "Bauleras",
  "Ascensores de primera marca",
  "Sistema de CCTV en espacios comunes",
  "Grupo electrógeno para servicios comunes",
  "Calefacción central por losa radiante",
].map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true }));

/** Desarrollador (Cubiqa) — Organization. */
export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#developer`,
    name: SITE.developer,
    url: "https://www.cubiqastudio.com/",
    logo: absolute("/logotipo_cubiqa.png"),
  };
}

/** Sitio — WebSite. */
export function websiteLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    inLanguage: HTML_LANG,
    publisher: { "@id": `${SITE_URL}/#developer` },
  };
}

/** El desarrollo/edificio — ApartmentComplex (subtipo de Residence). */
export function developmentLd(unitCount: number) {
  return {
    "@type": "ApartmentComplex",
    "@id": `${SITE_URL}/#development`,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_URL}/`,
    image: absolute(OG_IMAGE.url),
    numberOfAccommodationUnits: { "@type": "QuantitativeValue", value: unitCount },
    address: POSTAL_ADDRESS,
    geo: GEO,
    amenityFeature: AMENITIES,
  };
}

/** Grafo JSON-LD del sitio (Organization + WebSite + ApartmentComplex). Va en el home. */
export function siteGraphLd(unitCount: number) {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationLd(), websiteLd(), developmentLd(unitCount)],
  };
}

// Moneda de los precios "número pelado" que manda Airtable (ej. "352170", que la
// UI mostraba como "$352.170" sin moneda explícita). null = Offer sólo con
// disponibilidad, SIN precio — Miro 2026-07-15: el cliente pidió sacar los precios
// del sitio, así que tampoco se publican en el JSON-LD. Si algún día vuelven,
// restaurar "USD" acá (confirmado USD el 2026-07-07).
const PRICE_CURRENCY: "USD" | "ARS" | null = null;

/** Parsea un precio libre ("USD 420,000", "$352.170", "Consultar") → { amount, currency } | null. */
function parsePrice(price: string): { amount: string; currency: string } | null {
  // PRICE_CURRENCY=null = precios FUERA del sitio (Miro 2026-07-15): no se publica
  // precio en el JSON-LD ni aunque Airtable mande la moneda explícita en el texto.
  if (!PRICE_CURRENCY) return null;
  const explicit = /usd|u\$s|dól/i.test(price) ? "USD" : /ar\$|pesos/i.test(price) ? "ARS" : null;
  // Sin moneda en el texto: sólo un número pelado/"$" (formato actual de Airtable)
  // puede caer a PRICE_CURRENCY; cualquier otro texto libre no publica precio.
  const currency = explicit ?? (/^[\d.,\s$]+$/.test(price.trim()) ? PRICE_CURRENCY : null);
  if (!currency) return null;
  // Monto con conciencia de decimales ("420.000,50" → "420000.50"); si el formato
  // es ambiguo o el entero tiene <3 dígitos, NO se publica (nunca un monto corrupto).
  const amount = normalizeAmount(price);
  if (!amount || amount.split(".")[0].length < 3) return null;
  return { amount, currency };
}

/** Una unidad — Apartment + Offer (con precio sólo si la moneda es conocida) + BreadcrumbList. */
export function residenceGraphLd(id: string, unit: Unit) {
  const url = absolute(`/residencia/${id}`);
  const price = parsePrice(unit.price);
  const apartment: Record<string, unknown> = {
    "@type": "Apartment",
    "@id": `${url}#apartment`,
    name: `Departamento ${unit.residence} — ${SITE_NAME}`,
    url,
    // Primero el render 1200x630 (imagen representativa), después el plano, que es un
    // dibujo vertical compartido por hasta 13 unidades.
    image: [absolute(OG_IMAGE.url), absolute(unit.image || unit.floorPlan)].filter(Boolean),
    numberOfBedrooms: unit.beds,
    // Baños completos + toilette, igual que `unitTotalBaths` en el buscador de unidades.
    numberOfBathroomsTotal: unitTotalBaths(unit),
    address: POSTAL_ADDRESS,
    geo: GEO,
    containedInPlace: { "@id": `${SITE_URL}/#development` },
  };
  if (unit.areas?.total) {
    apartment.floorSize = { "@type": "QuantitativeValue", value: unit.areas.total, unitCode: "MTK" };
  }
  if (unit.ambientes != null) apartment.numberOfRooms = unit.ambientes;
  // Exposición como additionalProperty: schema.org no tiene un campo propio para
  // "frente/contrafrente", y es un atributo que se busca de verdad en CABA. El blurb
  // sr-only ya lo dice en prosa; esto se lo da estructurado a buscadores y AI search.
  if (unit.exposure) {
    apartment.additionalProperty = {
      "@type": "PropertyValue",
      name: "Exposición",
      value: unit.exposure === "frente" ? "Frente" : "Contrafrente",
    };
  }
  // Piso desde el id ("216" → "2", "001" → "0" = PB) — misma regla que PlanSection.
  const floor = id.length > 2 ? id.slice(0, -2) : id;
  apartment.floorLevel = floor === "0" ? "PB" : floor;
  // Offer SIN `availability`: el estado se hornea en el build y el sitio lo refresca en
  // vivo (ver ResidenciaLandingLive), así que entre un deploy y el siguiente el JSON-LD
  // podía contradecir al chip visible. Sólo se publica lo que no se vence.
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url,
  };
  if (price) {
    offer.price = price.amount;
    offer.priceCurrency = price.currency;
  }
  apartment.offers = offer;
  const breadcrumb = breadcrumbLd([
    { name: "Inicio", item: `${SITE_URL}/` },
    { name: "Showroom", item: `${SITE_URL}/showroom` },
    { name: `Departamento ${unit.residence}`, item: url },
  ]);
  return { "@context": "https://schema.org", "@graph": [apartment, breadcrumb] };
}

/** BreadcrumbList — compartido por el showroom y las fichas, así declaran la misma jerarquía. */
export function breadcrumbLd(items: { name: string; item: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  };
}

/** Grafo del showroom: sólo las migas (el resto del edificio vive en el home). */
export function showroomGraphLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbLd([
        { name: "Inicio", item: `${SITE_URL}/` },
        { name: "Showroom", item: `${SITE_URL}/showroom` },
      ]),
    ],
  };
}

/** Snippet reutilizable para inyectar JSON-LD como <script>. */
export function jsonLdScriptProps(data: unknown) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  } as const;
}
