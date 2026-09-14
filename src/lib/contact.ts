// ─────────────────────────────────────────────────────────────────────────────
// Datos de contacto del showroom.
//   - WHATSAPP_NUMBER: WhatsApp de la DESARROLLADORA (CCM). Destino de todos los
//     botones de WhatsApp en las visitas sin parámetro o con `?v=desarrolladora`.
//   - WHATSAPP_NUMBER_INMOBILIARIA: el de la inmobiliaria, para `?v=inmobiliaria`.
//   - WHATSAPP_NUMBER_2: segundo contacto. Hoy no se muestra en UI; queda acá
//     como fuente canónica por si se lista en alguna sección.
//
// Formato de wa.me: internacional y SÓLO dígitos — 54 (Argentina) + 9 (celular) +
// característica sin el 0 + número sin el 15. Los pasó Camila el 14-09-2026 como
// "1165668320" (desarrolladora) y "54 9 11 5149-6123" (inmobiliaria).
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_NUMBER = "5491165668320";
export const WHATSAPP_NUMBER_2 = "";

/** WhatsApp de la INMOBILIARIA que comercializa. Lo usan sólo las visitas que
 *  entraron por su link (`?v=inmobiliaria`, ver src/lib/origen.ts).
 *
 *  A propósito NO cae al de la desarrolladora si alguna vez queda vacío: es
 *  preferible que se note que falta un número a mandarle callado el lead de una al
 *  teléfono de la otra. */
export const WHATSAPP_NUMBER_INMOBILIARIA = "5491151496123";

export const CONSULT_MESSAGE =
  "¡Hola! Estoy viendo el Showroom de TIER Bravo (Mario Bravo 955) y quería hacer una consulta.";

/** URL de WhatsApp (wa.me) con el mensaje pre-cargado.
 *
 *  El número por defecto es el de ventas de la desarrolladora. En los componentes
 *  usá `useWhatsappUrl()` (OrigenProvider) en vez de llamar a esto directo: resuelve
 *  solo el número del comercializador que trajo la visita. */
export function whatsappUrl(
  message: string = CONSULT_MESSAGE,
  numero: string = WHATSAPP_NUMBER,
): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

/** Brochure del proyecto (PDF en /public, descargable). Fuente única: lo referencian
 *  el item "Brochure" del SideMenu (showroom + ficha) y el botón "Ver PDF" de la ficha
 *  (PlanSection). Si cambia el archivo, se actualiza sólo acá.
 *
 *  Llegó el 10-09-2026 (Camila, `TIER_Bravo_Brochure.pdf`, 32 págs.). `null` apaga
 *  los dos botones a la vez: un botón que baja un 404 es peor que no tenerlo. */
export const BROCHURE_URL: string | null = "/brochure_tier_bravo.pdf";
