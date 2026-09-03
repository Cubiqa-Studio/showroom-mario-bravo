// ─────────────────────────────────────────────────────────────────────────────
// Dónde viven los endpoints de datos en vivo y del formulario de contacto.
//
// Con `output: "export"` el frontend es HTML plano: NO hay route handlers de Next
// (`app/api/**`) en producción. Los tres endpoints que el sitio necesita en runtime
// pasan a ser server-side de otro, porque manejan SECRETOS que no pueden viajar en
// el bundle:
//   · unidades → token de Airtable (lectura de la base del cliente)
//   · avance   → el mismo token
//   · contact  → API key de Resend (con ella cualquiera manda mails desde el dominio)
//
// El default es `/api` — el MISMO origen del sitio. En Hostinger eso lo atiende el
// proxy PHP de `deploy/hostinger/api/*.php` (Apache lo mapea con un rewrite, ver el
// .htaccess), así que:
//   · el código cliente no cambió de forma: sigue pidiendo /api/unidades como antes;
//   · al ser mismo origen no hace falta CORS ni preflight;
//   · en `next dev` siguen respondiendo los route handlers de Next, así que el
//     desarrollo local es idéntico a lo que era.
//
// `NEXT_PUBLIC_API_BASE` permite apuntar el MISMO build a otro backend sin tocar
// código (funciones de Netlify, la API propia de Kuvus cuando esté). Si se usa un
// origen distinto, ese backend tiene que habilitar CORS para el dominio del sitio.
//
// ⚠ Es una variable PÚBLICA: queda horneada en el JS del build. Sólo va acá la URL
// base, nunca un token.
// ─────────────────────────────────────────────────────────────────────────────

/** Base sin barra final. */
const BASE = (process.env.NEXT_PUBLIC_API_BASE || "/api").replace(/\/+$/, "");

export const API_UNIDADES = `${BASE}/unidades`;
export const API_AVANCE = `${BASE}/avance`;
export const API_CONTACTO = `${BASE}/contact`;

/** Planta trazada de un piso. Estática en el export (ver deploy/README). */
export function apiPlate(floor: string): string {
  return `${BASE}/plate/${encodeURIComponent(floor)}`;
}
