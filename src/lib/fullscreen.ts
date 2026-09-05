/**
 * Pantalla completa, con UNA sola fuente de verdad sobre si el navegador puede.
 *
 * El botón estaba en dos lugares (el toolbar del showroom y la nav de la ficha) y los
 * dos llamaban `requestFullscreen?.()` con optional chaining. Cuando el método no
 * existe, eso no falla: NO HACE NADA, en silencio. Y quien decidía si mostrar el botón
 * era un breakpoint de ANCHO (`min-[560px]`), con el razonamiento de que abajo de eso
 * hay teléfonos y los teléfonos son iOS-o-Android. El razonamiento se cae solo al
 * ACOSTAR un iPhone: pasa a medir 800-900px de ancho, así que el botón aparece — y no
 * anda, porque iOS no tiene fullscreen de elementos en NINGÚN ancho (todos los
 * navegadores del iPhone van sobre WebKit, Chrome y Firefox incluidos). Ese es el
 * reporte de Juani, que lo probó desde un iPhone (03-09).
 *
 * Acá la pregunta se hace UNA vez y bien: ¿existe la API? Con eso se decide tanto si
 * el botón se muestra como qué método llamar. Un botón que no puede funcionar no se
 * dibuja, en vez de dibujarse y no hacer nada.
 *
 * Se soporta también el prefijo `webkit`: es lo que usan Safari de escritorio viejo y
 * iPadOS (donde fullscreen SÍ anda, sólo que prefijado). Sin esto, esos equipos caían
 * del mismo lado que el iPhone sin necesidad.
 */

type DocumentoConWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElementoConWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/**
 * ¿Este navegador puede poner un elemento a pantalla completa, acá y ahora?
 *
 * Mira las dos cosas que hacen falta y que pueden faltar por separado:
 *  - que el método EXISTA (en iPhone no existe, ni con prefijo);
 *  - que esté PERMITIDO (`fullscreenEnabled`), que es false cuando la página corre
 *    dentro de un <iframe> sin `allow="fullscreen"` — el caso de un showroom
 *    embebido en el sitio de una inmobiliaria.
 *
 * Sólo se puede llamar en el navegador: en el server no hay `document` y el export
 * estático prerenderiza estas páginas. Quien la use tiene que hacerlo después de
 * montar (ver `useFullscreen`), o el HTML servido y el primer render no coincidirían.
 */
export function fullscreenDisponible(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as DocumentoConWebkit;
  const raiz = document.documentElement as ElementoConWebkit;
  const hayMetodo =
    typeof raiz.requestFullscreen === "function" ||
    typeof raiz.webkitRequestFullscreen === "function";
  if (!hayMetodo) return false;
  // `fullscreenEnabled` es el permiso. Si el navegador no lo expone (webkit viejo),
  // no se toma la ausencia como un "no": ya sabemos que el método existe.
  const permitido = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true;
  return Boolean(permitido);
}

/** El elemento a pantalla completa, o null. Cubre el prefijo `webkit`. */
export function elementoEnFullscreen(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as DocumentoConWebkit;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Entra o sale de pantalla completa. No hace nada si el navegador no puede — pero
 * eso ya no debería pasar desde la UI, porque el botón no se dibuja en ese caso.
 *
 * Las promesas se ignoran a propósito: `requestFullscreen` rechaza si el gesto del
 * usuario no cuenta como tal, y no hay nada útil que mostrarle a nadie. Se atrapa
 * igual para no dejar un unhandled rejection en la consola.
 */
export function alternarFullscreen(): void {
  if (typeof document === "undefined") return;
  const doc = document as DocumentoConWebkit;
  if (elementoEnFullscreen()) {
    const salir = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    try {
      void Promise.resolve(salir?.call(doc)).catch(() => {});
    } catch {
      /* navegador viejo que tira sincrónico */
    }
    return;
  }
  const raiz = document.documentElement as ElementoConWebkit;
  const entrar = raiz.requestFullscreen ?? raiz.webkitRequestFullscreen;
  try {
    void Promise.resolve(entrar?.call(raiz)).catch(() => {});
  } catch {
    /* idem */
  }
}

/** Los dos nombres del evento de cambio; hay que escuchar los dos. */
export const EVENTOS_FULLSCREEN = ["fullscreenchange", "webkitfullscreenchange"] as const;
