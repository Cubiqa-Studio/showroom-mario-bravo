import type { NextConfig } from "next";

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

  // NO declarar `redirects()` ni `headers()` acá: con `output: "export"` no se aplican
  // (el build lo avisa) y hacen creer que la canonicalización www→apex y la cache larga
  // del flyby están resueltas. Su lugar de verdad es deploy/hostinger/.htaccess, y
  // netlify.toml + public/_headers para el deploy espejo de Netlify.
};

export default nextConfig;
