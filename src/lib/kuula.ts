// Helpers para los embeds de Kuula (tours 360°).
//
// En iOS/WebKit, un <iframe> cross-origin con WebGL queda limitado (~30 FPS, y peor en
// la práctica) HASTA que hay un gesto de usuario REAL procesado DENTRO del iframe. Un
// swipe/arrastre para mirar NO lo destraba (bug WebKit #213344); sólo un click/tap que
// genere "user activation". Aplica a TODOS los navegadores del iPhone (Chrome/Firefox/…
// usan WebKit igual). No se puede destrabar desde la página padre.
//
// Mitigación (sólo TÁCTIL): forzar la "pantalla de título" nativa de Kuula (botón play).
// Ese play es un tap DENTRO del iframe → destraba el throttle → el tour renderiza fluido
// DESPUÉS. En desktop devolvemos la URL tal cual (ahí no hay throttle relevante).
//
// VALOR DE `initload` — VERIFICADO EN VIVO (la doc de Kuula está redactada al revés):
// en las URLs de COLECCIÓN, `initload=1` muestra la pantalla de título con botón "play"
// (lo que queremos: ese tap va dentro del iframe y destraba el throttle de iOS) e
// `initload=0` autocarga. Se comprobó en vivo, así que el valor correcto es "1".
const KUULA_TITLE_SCREEN_INITLOAD = "1";

/**
 * En táctil, agrega `initload` para que Kuula muestre la pantalla de título (su tap
 * destraba el throttle de iOS). En desktop devuelve la URL intacta. Parsea con `URL`
 * para no romper los params que ya trae (fs, vr, zoom, thumbs, info, logo, …).
 */
export function withKuulaTouchGate(url: string, isTouch: boolean): string {
  if (!isTouch) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("initload", KUULA_TITLE_SCREEN_INITLOAD);
    return u.toString();
  } catch {
    return url;
  }
}

export interface KuulaChromeOpts {
  /** `fs=0`: oculta el botón fullscreen ("expandir/zoom") de Kuula. Se usa SÓLO en el
   *  hero de la landing (Miro 2026-07-15): ahí el 360° ya ocupa 100dvh, así que el
   *  botón sobra y encima se encimaba a nuestro navbar. En los modales (Amenities /
   *  Tours), donde el 360° es más chico, se deja para poder ampliar. */
  hideFullscreen?: boolean;
}

/**
 * Miro 2026-07-15: el botón INFO (arriba a la derecha, encimado a nuestro menú) y el
 * logo de Kuula (arriba a la izquierda, sobre el wordmark del proyecto) se ocultan en
 * TODOS los tours: `info=0` saca el botón; `logo=-1` oculta el logo de Kuula (0 lo
 * muestra; -1 requiere plan PRO — si la cuenta no lo es, Kuula lo ignora y el logo
 * queda). Con `hideFullscreen` además saca el botón de pantalla completa (`fs=0`).
 * Se aplica acá, centralizado, para cubrir también las URLs que vienen de datos
 * (units.json / Airtable) sin depender de editarlas una por una.
 */
export function withKuulaChromeHidden(url: string, opts: KuulaChromeOpts = {}): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "kuula.co" && !u.hostname.endsWith(".kuula.co")) return url;
    u.searchParams.set("info", "0");
    u.searchParams.set("logo", "-1");
    if (opts.hideFullscreen) u.searchParams.set("fs", "0");
    return u.toString();
  } catch {
    return url;
  }
}

/** URL final de embed: chrome de Kuula oculto + gate táctil de iOS. */
export function kuulaEmbedUrl(url: string, isTouch: boolean, opts: KuulaChromeOpts = {}): string {
  return withKuulaTouchGate(withKuulaChromeHidden(url, opts), isTouch);
}
