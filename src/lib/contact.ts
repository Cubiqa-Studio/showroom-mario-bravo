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

// ─────────────────────────────────────────────────────────────────────────────
// BROCHURE DEL PROYECTO
//
// Desde la integración con Cubiqa el brochure es DATO EN VIVO: viene en la misma
// respuesta que las unidades (`brochure.downloadUrl`, un PDF público en el CDN de
// Bunny) y el cliente lo cambia subiendo otro desde su panel, sin rebuild.
//
// Lo consumen el item "Brochure" del SideMenu (showroom + ficha) y el botón
// "Ver PDF" de la ficha (PlanSection), los dos vía `useBrochure()`.
//
// ── Por qué queda un PDF commiteado igual ───────────────────────────────────
// `BROCHURE_FALLBACK` es el archivo que llegó el 10-09-2026 (Camila,
// `TIER_Bravo_Brochure.pdf`, 32 págs.) y sigue en /public a propósito: es lo que se
// muestra mientras el pedido está en vuelo y si el back no contesta, igual que
// units.json es la red de las unidades. Se puede borrar —y bajar 9 MB del
// DEPLOY.zip— recién cuando producción devuelva un `brochure` no nulo.
// `null` apagaría los dos botones a la vez: un botón que baja un 404 es peor que
// no tener el botón.
//
// ── El nombre con el que se descarga (pregunta de Cubiqa, 14-09) ─────────────
// NO se puede forzar desde el front. El atributo `download` de un <a> sólo respeta
// el nombre cuando el recurso es del MISMO origen (o `blob:`/`data:`): desde
// Chrome 65 el hint se descarta para cualquier URL cross-origin, justamente para
// que una página no pueda disfrazar un archivo ajeno. Como el PDF vive en
// cubiqa-storage.b-cdn.net, el navegador usa el nombre del archivo en el CDN, que
// es siempre `brochure.pdf`.
//
// Descargarlo como blob y renombrarlo tampoco sirve hoy: probado contra el CDN
// real (21-09-2026), la respuesta del PDF no trae `Access-Control-Allow-Origin`
// —el `thumbnail.jpg` sí—, así que el fetch lo bloquea el navegador.
//
// El arreglo es del lado del servidor y hay dos caminos, los dos de Cubiqa:
//   a) guardar el objeto con el nombre real en vez de `brochure.pdf` (la ruta ya
//      lleva el uuid del proyecto, así que no expone nada que el propio endpoint no
//      publique en `filename`); o
//   b) que el pull zone mande `Content-Disposition: attachment; filename="…"`.
// Mientras tanto se abre en una pestaña nueva y baja como `brochure.pdf`, que es
// exactamente lo que hace hoy el dashboard de Cubiqa con su botón "Ver PDF".
// ─────────────────────────────────────────────────────────────────────────────

export const BROCHURE_FALLBACK: string | null = "/brochure_tier_bravo.pdf";
