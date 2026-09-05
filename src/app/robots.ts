import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// robots.txt generado por Next. Sitio de venta: se permite todo, incluidos los
// crawlers de entrenamiento.
//
// Los agentes con nombre propio van en un grupo aparte y REPITEN los Disallow: un bot
// que encuentra su propio User-agent ignora por completo el grupo `*`.
//
// `Allow: /api/plate/` gana sobre `Disallow: /api/` (Google aplica la regla más
// específica): las plantas horneadas son JSON que la página necesita para dibujarse.
// El resto de /api/* es el proxy PHP, donde no hay nada que indexar.
//
// Sin `Claude-Web` ni `anthropic-ai`: deprecados.
export const dynamic = "force-static";

const ALLOW = ["/", "/api/plate/"];
const DISALLOW = ["/api/", "/admin/"];

const AGENTES_CON_NOMBRE = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      { userAgent: AGENTES_CON_NOMBRE, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
