import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// robots.txt generado por Next. Todo indexable salvo las APIs y el editor interno
// (/admin, que además responde 404 en prod). Apunta al sitemap absoluto.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
