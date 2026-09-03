import type { MetadataRoute } from "next";
import { getUnitIds } from "@/lib/data";
import { SITE_URL } from "@/lib/seo";

// sitemap.xml generado por Next: home + showroom + las 44 fichas /residencia/:id.
// Es la vía principal de descubrimiento de las unidades (además de los links
// crawleables del showroom). Las URLs salen absolutas contra SITE_URL.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/showroom`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
  const units: MetadataRoute.Sitemap = getUnitIds().map((id) => ({
    url: `${SITE_URL}/residencia/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticRoutes, ...units];
}
