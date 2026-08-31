// ─────────────────────────────────────────────────────────────────────────────
// Datos de contacto del showroom.
//   - WHATSAPP_NUMBER: destino de TODOS los botones de WhatsApp. Formato
//     internacional, sólo dígitos (ej. "5491165462626").
//   - WHATSAPP_NUMBER_2: segundo contacto. Hoy no se muestra en UI; queda acá
//     como fuente canónica por si se lista en alguna sección.
//
// ⚠ PLACEHOLDER — el cliente todavía no pasó los números de ventas. Con el string
// vacío los CTA de WhatsApp abren el selector de contacto en vez de un chat con
// ventas: sirve para demo, NO para producción. Completalos antes de publicar.
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_NUMBER = "";
export const WHATSAPP_NUMBER_2 = "";

/** WhatsApp de la INMOBILIARIA que comercializa. Lo usan sólo las visitas que
 *  entraron por su link (`?v=inmobiliaria`, ver src/lib/origen.ts).
 *
 *  ⚠ PLACEHOLDER — falta el número. A propósito NO cae al de la desarrolladora:
 *  es preferible que se note que falta un número a mandarle callado el lead de
 *  una al teléfono de la otra. */
export const WHATSAPP_NUMBER_INMOBILIARIA = "";

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
 *  el SideMenu (showroom + landing) y la DataBar de la ficha.
 *
 *  ⚠ PLACEHOLDER — todavía no hay brochure comercial del proyecto. Lo único que
 *  entregó el cliente son las plantas CAD y el listado de unidades, que NO son
 *  material para el público. `null` = el botón de descarga no se muestra. */
export const BROCHURE_URL: string | null = null;
