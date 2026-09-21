// ─────────────────────────────────────────────────────────────────────────────
// Dónde viven los endpoints de datos en vivo y del formulario de contacto.
//
// Con `output: "export"` el frontend es HTML plano: NO hay route handlers de Next
// (`app/api/**`) en producción. Los endpoints que el sitio necesita en runtime los
// atiende server-side otro, y cada uno por su motivo:
//
//   · proyecto → unidades + brochure, del back de Cubiqa. NO es por un secreto: ese
//     endpoint es público y sin token. Es por CORS, por CACHE y por RESILIENCIA:
//       – el back sólo permite como Origin a admin.kuvus.app y dashboard.kuvus.app,
//         y esa lista está en su código, no en una variable de entorno. Un fetch
//         del navegador desde el dominio del showroom no da 403: da 500 sin
//         cabeceras CORS, o sea que se ve igual que un back caído. En cambio un
//         pedido server-to-server no manda `Origin` y el back lo deja pasar — es la
//         rama que él mismo habilita.
//       – el back no manda `Cache-Control` ni `ETag` ni tiene rate limit, así que
//         un fetch por visitante son tres consultas a su base por carga. Con el
//         proxy y su cache de 60 s, son ≤1 por minuto para todo internet. Cubiqa
//         pidió explícitamente cuidar los recursos del hosting compartido.
//       – si el back no contesta, el proxy sirve la última copia buena en vez de
//         nada.
//   · avance   → token de Airtable (lo último que queda en Airtable).
//   · contact  → API key de Resend (con ella cualquiera manda mails del dominio).
//
// El default es `/api` — el MISMO origen del sitio. En Hostinger eso lo atiende el
// proxy PHP de `deploy/hostinger/api/*.php` (Apache lo mapea con un rewrite, ver el
// .htaccess), así que:
//   · al ser mismo origen no hace falta CORS ni preflight;
//   · en `next dev` siguen respondiendo los route handlers de Next, así que el
//     desarrollo local es idéntico.
//
// `NEXT_PUBLIC_API_BASE` permite apuntar el MISMO build a otro backend sin tocar
// código (un deploy espejo en Netlify que consuma el PHP de Hostinger). Si se usa
// un origen distinto, ese backend tiene que habilitar CORS para el dominio del
// sitio.
//
// ⚠ Es una variable PÚBLICA: queda horneada en el JS del build. Sólo va acá la URL
// base, nunca un token ni el id del proyecto.
// ─────────────────────────────────────────────────────────────────────────────

/** Base sin barra final. */
const BASE = (process.env.NEXT_PUBLIC_API_BASE || "/api").replace(/\/+$/, "");

/** Unidades + brochure del proyecto, en una sola respuesta (el back de Cubiqa los
 *  entrega juntos, así que el sitio hace un pedido y no dos). */
export const API_PROYECTO = `${BASE}/proyecto`;
export const API_AVANCE = `${BASE}/avance`;
export const API_CONTACTO = `${BASE}/contact`;

/** Planta trazada de un piso. Estática en el export (ver deploy/README). */
export function apiPlate(floor: string): string {
  return `${BASE}/plate/${encodeURIComponent(floor)}`;
}
