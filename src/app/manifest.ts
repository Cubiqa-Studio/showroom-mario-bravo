import type { MetadataRoute } from "next";
import { SITE_NAME, BRAND_SHORT, DEFAULT_DESCRIPTION, HTML_LANG } from "@/lib/seo";

// Web App Manifest (Next lo sirve en /manifest.webmanifest y agrega el <link>).
// Completa favicon + apple-touch-icon (convención app/icon.svg, favicon.ico,
// apple-icon.png) con los iconos instalables 192/512 (generados en public/).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Buenos Aires`,
    short_name: BRAND_SHORT,
    description: DEFAULT_DESCRIPTION,
    lang: HTML_LANG,
    start_url: "/",
    display: "standalone",
    // Splash de la PWA en el negro de marca (= --tier-dark), igual que el lienzo.
    background_color: "#0B0B0B",
    theme_color: "#0B0B0B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
