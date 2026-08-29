import type { NextConfig } from "next";

// Assets pre-renderizados del flyby (frames de transición + stills de cada vista).
// Viven en /public y SÓLO cambian en un deploy. Por defecto Next los sirve con
// `Cache-Control: public, max-age=0, must-revalidate`, así que tras un rato IDLE el
// navegador purga su cache y, al disparar la transición, revalida los ~30 frames por
// red: la animación (que avanza por TIEMPO con rAF) no espera y salta directo al
// destino → "teletransporte" + lag, hasta que un F5 vuelve a primar todo.
//
// Cache larga lo arregla: dentro de max-age el browser sirve de cache SIN red (cero
// lag para cualquier idle de un día), y `stale-while-revalidate` deja que tome
// renders nuevos en segundo plano sin bloquear (auto-actualiza tras un deploy).
const FLYBY_ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=2592000";

const nextConfig: NextConfig = {
  // [TEMP-AUDIT] carpeta de build alternativa para no pisar el .next del dev del usuario.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(process.env.NEXT_DIST_DIR ? { devIndicators: false as const } : {}),

  // Higiene: no publicar el stack en cada response (X-Powered-By: Next.js).
  poweredByHeader: false,

  // Si www y el apex sirven ambos 200 con el MISMO contenido, Google ve contenido
  // duplicado y divide las señales. Este redirect permanente (Next emite 308, que
  // Google trata igual que un 301) canonicaliza www → apex, condicionado por host:
  // sólo dispara para el host declarado, así que no toca ni los previews de Netlify
  // (*.netlify.app) ni localhost. En Hostinger (next start) aplica solo; en Netlify
  // hay además una regla edge en netlify.toml (que cubre también los assets).
  //
  // ⚠ PLACEHOLDER — el dominio real todavía no está definido (ver PROD_SITE_URL en
  // src/lib/seo.ts). Actualizá el host ACÁ y en netlify.toml a la vez, y verificá
  // post-deploy: curl -sI https://www.<dominio>/showroom → 308/301.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.mariobravo955.com.ar" }],
        destination: "https://mariobravo955.com.ar/:path*",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/frames/:path*",
        headers: [{ key: "Cache-Control", value: FLYBY_ASSET_CACHE }],
      },
      {
        source: "/stops/:path*",
        headers: [{ key: "Cache-Control", value: FLYBY_ASSET_CACHE }],
      },
      {
        // Renders de la galería (WebP optimizados): estáticos e inmutables hasta el
        // próximo deploy, igual que los frames/stops → misma cache larga para que
        // reabrir la galería sirva de cache sin revalidar por red.
        source: "/gallery/:path*",
        headers: [{ key: "Cache-Control", value: FLYBY_ASSET_CACHE }],
      },
    ];
  },
};

export default nextConfig;
