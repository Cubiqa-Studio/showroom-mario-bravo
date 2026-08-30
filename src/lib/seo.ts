import type { Metadata } from "next";
import { SITE } from "@/data/site";
import type { Unit } from "./types";
import { normalizeAmount } from "./residencia";

// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de la configuración SEO del microsite (metadata, OG/Twitter,
// canonical, JSON-LD). Centralizado acá para que todas las rutas sean coherentes
// y para reusarlo en próximos showrooms.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ PLACEHOLDER — el cliente todavía no definió el dominio de producción. Ojo:
// desde que el producto se llama TIER Bravo, el dominio probablemente NO sea el de
// la dirección — preguntá antes de comprar nada.
// Este valor alimenta canonical, og:url y el sitemap: si se deploya así, Google
// indexa un dominio que no existe. Reemplazalo por el real ANTES del primer deploy
// (y cargá el mismo valor en NEXT_PUBLIC_SITE_URL en el panel del host).
// Overridable con NEXT_PUBLIC_SITE_URL sin tocar código.
const PROD_SITE_URL = "https://mariobravo955.com.ar";

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
  "Descubrí TIER Bravo, en Mario Bravo 955: 63 departamentos de 1 a 4 ambientes en Buenos Aires. Recorré el desarrollo en 360° y mirá plantas, superficies y disponibilidad.";

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
  const ogTitle = title ?? `${BRAND_SHORT} — Departamentos en Mario Bravo 955, Buenos Aires`;
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

// Derivados de los renders entregados (pileta, solárium, gimnasio, SUM/coworking,
// parrilla, juegos). VERIFICAR contra el pliego de amenities del cliente.
const AMENITIES = [
  "Pileta con solárium",
  "Gimnasio",
  "SUM y coworking",
  "Parrilla y comedor de terraza",
  "Juegos infantiles",
  "Cochera cubierta",
  "Lobby con seguridad",
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
    numberOfAccommodationUnits: unitCount,
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
    image: absolute(unit.image || unit.floorPlan || OG_IMAGE.url),
    numberOfBedrooms: unit.beds,
    numberOfBathroomsTotal: unit.baths,
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
  // Offer SIEMPRE: la disponibilidad es dato real (Airtable) aunque el precio no
  // se publique (ver PRICE_CURRENCY). Google no da rich result de Apartment, pero
  // el Offer le da a los buscadores/AI la señal disponible/reservada por unidad.
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    availability:
      // "reserved" ≠ vendida: schema.org tiene el valor exacto Reserved.
      unit.status === "available" ? "https://schema.org/InStock" : "https://schema.org/Reserved",
    url,
  };
  if (price) {
    offer.price = price.amount;
    offer.priceCurrency = price.currency;
  }
  apartment.offers = offer;
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Showroom", item: `${SITE_URL}/showroom` },
      { "@type": "ListItem", position: 3, name: `Departamento ${unit.residence}`, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [apartment, breadcrumb] };
}

/** Snippet reutilizable para inyectar JSON-LD como <script>. */
export function jsonLdScriptProps(data: unknown) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  } as const;
}
