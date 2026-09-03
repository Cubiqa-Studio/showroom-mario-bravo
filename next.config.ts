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

// ─────────────────────────────────────────────────────────────────────────────
// DOS MODOS: `next build` exporta estático · `next dev` es un server normal.
//
// `output: "export"` NO se puede dejar prendido en dev. No es sólo una config de
// salida: `next dev` la respeta y responde 500 en cualquier ruta que necesite
// servidor ("export const dynamic = force-dynamic ... cannot be used with
// output: export", "is missing generateStaticParams()"). Con la config global,
// el editor de polígonos y los endpoints de dev quedaban rotos EN LOCAL, que es
// el único lugar donde tienen que andar.
//
// Por eso el export se activa sólo en el build de producción, que es el que
// genera lo que se sube. La contracara: dev es más permisivo que el build, así
// que **algo puede andar en `next dev` y romper en `npm run build`**. El build es
// la verdad — corrélo antes de dar algo por terminado.
// ─────────────────────────────────────────────────────────────────────────────
const ES_BUILD_DE_PROD = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS SÓLO-DEV (`page.dev.tsx` / `route.dev.ts`).
//
// Hay dos grupos de rutas que necesitan un servidor y que por lo tanto NO pueden
// existir en el export estático, pero que SÍ tienen que seguir funcionando en
// `next dev`:
//
//   · El EDITOR DE POLÍGONOS (/admin/polygon-editor y /api/admin/*). Es una
//     herramienta interna reutilizable en futuros showrooms: se corre en local,
//     se trazan los polígonos y se commitea el JSON resultante. Antes se apagaba
//     en producción con el middleware (ENABLE_POLYGON_EDITOR → 404); en un sitio
//     estático no hay middleware, así que directamente no se publica. Es MÁS
//     seguro que antes: no está, en vez de estar y responder 404.
//
//   · Los endpoints con SECRETOS (/api/contact con la key de Resend, /api/unidades
//     y /api/avance con el token de Airtable). En producción los atiende el proxy
//     PHP de deploy/hostinger (ver src/lib/api.ts). En dev siguen siendo estos
//     route handlers, así que trabajar en local no cambió en nada.
//
// El mecanismo es `pageExtensions`: en dev se acepta también la extensión
// `.dev.tsx`/`.dev.ts`, en el build de producción no → esos archivos dejan de ser
// rutas y ni se compilan. El código queda en el repo, versionado y andando.
//
// ⚠ Al agregar una ruta sólo-dev, nombrala `page.dev.tsx` o `route.dev.ts`. Si le
// ponés `page.tsx` va a romper el build estático.
// ─────────────────────────────────────────────────────────────────────────────
const EXTENSIONES_BASE = ["tsx", "ts", "jsx", "js"];

const nextConfig: NextConfig = {
  // Sitio 100% estático (carpeta out/) para hostear en Hostinger sin proceso Node.
  // Ver deploy/README-hostinger.md para el flujo de build + subida.
  output: ES_BUILD_DE_PROD ? "export" : undefined,
  // Sin servidor de Next no hay optimizador de imágenes. El proyecto no usa
  // `next/image` (todo es <img> crudo con WebP ya optimizado por los scripts de
  // scripts/), así que esto sólo desactiva una feature que no se estaba usando.
  images: { unoptimized: true },
  pageExtensions: ES_BUILD_DE_PROD
    ? EXTENSIONES_BASE
    : [...EXTENSIONES_BASE.map((e) => `dev.${e}`), ...EXTENSIONES_BASE],

  // Higiene: no publicar el stack en cada response (X-Powered-By: Next.js).
  // En el export lo sirve Apache, así que este flag sólo aplica a `next dev`;
  // los headers de producción se declaran en deploy/hostinger/.htaccess.
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
