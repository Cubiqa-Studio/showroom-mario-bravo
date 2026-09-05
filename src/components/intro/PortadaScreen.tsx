"use client";

import "./portada.css";
import Link, { useLinkStatus } from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MARCA, PROYECTOS, nombreCompleto, posterMid, type Proyecto } from "@/data/proyectos";
import { useOrigen } from "@/components/OrigenProvider";
import { useI18n } from "@/i18n/LanguageProvider";

/* eslint-disable @next/next/no-img-element */

/**
 * Los Image() del precalentado viven a NIVEL DE MÓDULO, no en el componente: cuando el
 * visitante entra al showroom la portada se desmonta, y si las referencias murieran con
 * ella el navegador podría abortar las descargas a medio camino — justo el momento en
 * que más las necesitamos. Acá sobreviven a la navegación y terminan de llenar la cache.
 */
const precalentados: HTMLImageElement[] = [];

/** Flechita del CTA. */
function Flecha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M12 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Contenido del CTA. Va DENTRO del <Link> para poder leer `useLinkStatus()`: mientras
 * la navegación al showroom está en vuelo (la página hace fetch de stops + Airtable)
 * `pending` es true y la flecha se reemplaza por un spinner, así el click tiene
 * respuesta inmediata en vez de parecer que no pasó nada.
 */
/**
 * Marca el PANEL ENTERO como "entrando" mientras la navegación está en vuelo, y lo
 * anuncia al lector de pantalla.
 *
 * El spinner del CTA ya existía, pero mide 13px y en escritorio el <Link> es el panel
 * COMPLETO: se puede clickear a 400px del botón y la única señal quedaba en un rincón
 * (reporte de Joaquim, 31-08: "a veces tarda un poco… que el user sepa que está
 * entrando"). Con esto se apaga el resto de la portada y el panel elegido se queda
 * encendido, que es la señal que sí se ve.
 *
 * Va DENTRO del <Link> porque `useLinkStatus()` sólo funciona ahí, pero pinta el
 * estado en el ancestro `.pp` — de ahí el `closest`.
 */
function MarcaEntrando({ etiqueta }: { etiqueta: string }) {
  const { pending } = useLinkStatus();
  const ancla = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const panel = ancla.current?.closest(".pp");
    if (!panel) return;
    if (pending) panel.setAttribute("data-entrando", "si");
    else panel.removeAttribute("data-entrando");
    return () => panel.removeAttribute("data-entrando");
  }, [pending]);
  return (
    <span ref={ancla} className="sr-only" aria-live="polite">
      {pending ? etiqueta : ""}
    </span>
  );
}

function CtaContenido({ texto }: { texto: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {texto}
      {pending ? (
        <svg className="animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" className="opacity-25" />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="opacity-90"
          />
        </svg>
      ) : (
        <Flecha />
      )}
    </>
  );
}

/**
 * Un panel. Es un <Link> si el proyecto tiene a dónde llevar, y un <div> inerte si
 * todavía no —no queremos un cursor de mano y un foco de teclado sobre algo que no
 * hace nada—.
 */
function Panel({
  proyecto,
  indice,
  conVideo,
  esTactil,
  expandido,
  onAmpliar,
}: {
  proyecto: Proyecto;
  indice: number;
  /** El navegador puede reproducir el video del hover (escritorio, sin reduced-motion). */
  conVideo: boolean;
  /** Sin hover: el 1er toque AMPLÍA en vez de navegar. */
  esTactil: boolean;
  /** Este panel es el que está ampliado a pantalla completa. */
  expandido: boolean;
  onAmpliar: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const abrible = proyecto.href !== null;
  const nombre = nombreCompleto(proyecto);
  const muestraVideo = conVideo && proyecto.video !== null;

  const entrar = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    // `muted` por PROPIEDAD además del atributo: React no lo aplica de forma confiable
    // con SSR/hidratación, y un <video> que no está REALMENTE muteado tiene el autoplay
    // bloqueado (se quedaría congelado en negro sobre el poster).
    v.muted = true;
    setReproduciendo(true);
    v.play().catch(() => setReproduciendo(false));
  }, []);

  const salir = useCallback(() => {
    const v = videoRef.current;
    setReproduciendo(false);
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }, []);

  const contenido = (
    <>
      <div className="pp-media">
        {proyecto.poster ? (
          // En CELULAR el panel es una franja de 1/3 de pantalla y la fachada entra
          // recortadísima por `object-fit: cover`, así que baja la variante `-mid`
          // (720px, ~146 KB) en vez de la grande (1120px, ~305 KB): son 320 KB menos
          // en la primera pantalla del sitio, justo en la conexión que peor lo paga.
          // A 412 CSS px con DPR 2 quedan 720 sobre 824 necesarios — imperceptible
          // detrás del velo oscuro que lleva el panel encima (ver `.pp-velo`).
          //
          // Va como <picture> y no como `srcset` con descriptores `w` porque las tres
          // fachadas NO miden lo mismo (Bravo es horizontal, 1600×900; las otras dos
          // verticales, 1120×1600): un descriptor fijo mentiría en dos de los tres.
          <picture>
            {posterMid(proyecto) ? (
              <source media="(max-aspect-ratio: 5 / 4)" srcSet={posterMid(proyecto)!} />
            ) : null}
            <img src={proyecto.poster} alt="" aria-hidden="true" />
          </picture>
        ) : (
          // Sin render todavía: la inicial gigante de marca de agua le da escala al
          // panel dibujado (ver `.pp--sin-media` en portada.css).
          <span className="pp-agua" aria-hidden="true">
            {proyecto.nombre.charAt(0)}
          </span>
        )}
        {muestraVideo ? (
          <video
            ref={videoRef}
            src={proyecto.video ?? undefined}
            muted
            loop
            playsInline
            // `preload="none"`: son tres paneles y el visitante quizá no pase por
            // ninguno. El video baja recién cuando el mouse entra.
            preload="none"
          />
        ) : null}
      </div>
      <div className="pp-velo" aria-hidden="true" />
      <div className="pp-cuerpo">
        <span className="pp-kicker">{String(indice + 1).padStart(2, "0")}</span>
        {/* El espacio entre los dos <span> es para el LECTOR DE PANTALLA: sin él, el
            encabezado se anuncia "TIERSinclair" de corrido. Visualmente no se ve,
            porque `.pp-marca` es un bloque y el espacio que le sigue colapsa. */}
        <h2 className="pp-nombre">
          <span className="pp-marca">{MARCA}</span>{" "}
          <span>{proyecto.nombre}</span>
        </h2>
        <span className="pp-linea" aria-hidden="true" />
        <span className="pp-meta">{proyecto.ubicacion ?? t.portada.proximamente}</span>
        {/* La fila va SIEMPRE, tenga botón o no: es lo que deja los tres nombres a la
            misma altura. Sin ella, el panel con CTA subía su bloque de texto ~60px y
            la portada se veía desalineada. */}
        <span className="pp-cta-fila">
          {abrible ? (
            <span className="pp-cta">
              <CtaContenido texto={t.portada.entrar} />
            </span>
          ) : null}
          {/* Va acá dentro (necesita estar bajo el <Link>) pero no dibuja nada: le
              pone `data-entrando` al panel y anuncia el estado en voz alta. */}
          {abrible ? <MarcaEntrando etiqueta={t.portada.entrando} /> : null}
        </span>
      </div>
    </>
  );

  const props = {
    className: `pp${proyecto.poster ? "" : " pp--sin-media"}`,
    "data-abrible": abrible ? "si" : "no",
    "data-video": reproduciendo ? "on" : "off",
    "data-expandido": expandido ? "si" : "no",
    onMouseEnter: muestraVideo ? entrar : undefined,
    onMouseLeave: muestraVideo ? salir : undefined,
    onFocus: muestraVideo ? entrar : undefined,
    onBlur: muestraVideo ? salir : undefined,
  };

  // TÁCTIL: sin hover, el 1er toque AMPLÍA el panel a pantalla completa (pedido de
  // Joaquim, 30-08: "en iPad/celular tenés que hacer click y se te pone en pantalla
  // completa con una X arriba para cerrar"). Recién estando ampliado, "Descubrir"
  // navega. En escritorio nada de esto corre: ahí el hover ya abre el panel.
  if (!abrible) {
    // Sin material todavía, pero en táctil igual se puede AMPLIAR para verlo grande —
    // que es justo lo que va a tener sentido cuando lleguen los renders de Sinclair y
    // Avenue. En escritorio queda como un <div> inerte: no hay nada que activar y un
    // botón que no hace nada sólo ensucia el recorrido de teclado.
    if (!esTactil) return <div {...props}>{contenido}</div>;
    return (
      <button
        type="button"
        {...props}
        onClick={onAmpliar}
        aria-label={t.portada.ariaAmpliar(nombre)}
        aria-expanded={expandido}
      >
        {contenido}
      </button>
    );
  }
  return (
    <Link
      {...props}
      href={proyecto.href as string}
      aria-label={expandido || !esTactil ? t.portada.ariaEntrar(nombre) : t.portada.ariaAmpliar(nombre)}
      onClick={(e) => {
        // El <a> sigue siendo un link DE VERDAD (crawleable, ctrl+click, "abrir en
        // pestaña nueva"). Sólo interceptamos el 1er toque en táctil.
        if (!esTactil || expandido) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        // …salvo que el toque haya sido en "Descubrir". Ese botón es EXPLÍCITO —dice
        // a dónde va— así que entra derecho al showroom sin pasar por la vista
        // ampliada. Antes ampliaba igual y había que tocarlo dos veces (Joaquim,
        // 31-08). Ampliar sigue siendo lo que hace un toque en cualquier otra parte
        // del panel, que es lo que se pidió el 30-08.
        if ((e.target as Element).closest?.(".pp-cta")) return;
        e.preventDefault();
        onAmpliar();
      }}
    >
      {contenido}
    </Link>
  );
}

/**
 * PORTADA — la raíz "/". Los tres desarrollos de TIER dividiendo la pantalla: en
 * escritorio, tres columnas que se abren al pasar el mouse; en celular, tres franjas
 * apiladas de un tercio de pantalla cada una.
 *
 * Reemplaza a la portada anterior, que era el video de un solo proyecto a pantalla
 * completa con un botón "Descubrir" (pedido de Camila, 30-08). El proyecto que TIENE
 * showroom —Bravo, o sea este sitio— es el único que hoy lleva a algún lado; los otros
 * dos esperan su material y se dibujan tipográficos, sin robarle una foto a nadie.
 *
 * Sigue siendo dos rutas separadas (portada "/" · showroom "/showroom"), así que el
 * historial del navegador hace todo el trabajo: el back vuelve acá y un F5 sobre el
 * showroom no repite la portada, sin cookies.
 */
export function PortadaScreen({ preload = [] }: { preload?: string[] }) {
  const { t } = useI18n();
  // Sólo los desarrollos que vende quien trajo la visita: si alguien entra por el link
  // de la inmobiliaria, no tiene sentido mostrarle un proyecto que ella no comercializa
  // (Juani, 31-08). Sin parámetro se ven todos. Los paneles son `flex: 1 1 0`, así que
  // se reparten la pantalla solos: dos quedan al 50%.
  const { origen } = useOrigen();
  const proyectos = PROYECTOS.filter((p) => p.comercializan.includes(origen));
  // El video del hover sólo en escritorio con puntero fino: en táctil no hay hover que
  // lo dispare y bajar tres videos sería tirar los datos del visitante a la basura.
  const [conVideo, setConVideo] = useState(false);
  // Táctil = sin hover. Ahí el 1er toque AMPLÍA el panel en vez de navegar.
  const [esTactil, setEsTactil] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    const fino = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      setEsTactil(!fino.matches);
      setConVideo(
        fino.matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    };
    sync();
    // Un iPad con teclado/trackpad enchufado cambia de puntero en caliente, y una
    // ventana de escritorio puede pasar a modo táctil en un 2-en-1.
    fino.addEventListener("change", sync);
    return () => fino.removeEventListener("change", sync);
  }, []);

  // Si el puntero pasa a fino (se enchufó un mouse), la vista ampliada deja de tener
  // sentido: ahí manda el hover.
  useEffect(() => {
    if (!esTactil) setExpandido(null);
  }, [esTactil]);

  // Escape cierra la vista ampliada (teclado físico en una tablet).
  useEffect(() => {
    if (!expandido) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandido(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandido]);

  // Precalentado del showroom mientras se mira la portada. Corre una sola vez por carga
  // de página. Van en prioridad BAJA: no compiten con los posters de los paneles, sólo
  // aprovechan la red ociosa mientras el visitante elige.
  // Arranca DESPUÉS del `load` y en el primer hueco ocioso. Son 160 archivos y ~18,5 MB:
  // aunque cada uno pida prioridad baja, en un 4G lento la cola satura la red igual y se
  // llevaba puesto el LCP de la propia portada. Esperar no le saca nada al precalentado
  // —el visitante todavía está eligiendo proyecto—.
  useEffect(() => {
    if (precalentados.length > 0 || preload.length === 0) return;
    let cancelado = false;

    const precalentar = () => {
      if (cancelado || precalentados.length > 0) return;
      for (const src of preload) {
        const img = new Image();
        img.fetchPriority = "low";
        img.decoding = "async";
        img.src = src;
        precalentados.push(img);
      }
    };

    const enOcio = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(precalentar, { timeout: 3000 });
      } else {
        window.setTimeout(precalentar, 1200);
      }
    };

    if (document.readyState === "complete") {
      enOcio();
      return () => {
        cancelado = true;
      };
    }
    window.addEventListener("load", enOcio, { once: true });
    return () => {
      cancelado = true;
      window.removeEventListener("load", enOcio);
    };
  }, [preload]);

  return (
    <main className="portada">
      {/* H1 + descripción crawleable (sr-only): le dan a la portada un encabezado y
          texto indexable sin alterar el diseño. */}
      <section className="sr-only">
        <h1>{t.seo.homeH1}</h1>
        <p>{t.seo.homeBody}</p>
      </section>

      {/* Cabecera de MARCA. El logotipo de TIER manda: el cliente pidió que tuviera
          "mucho más protagonismo" y en su propio key visual ocupa un tercio del ancho.
          Debajo, la regla dorada y la bajada, igual que el lockup del afiche. */}
      <div className="portada-marca">
        <img src="/logo.png" alt="TIER" />
        <span className="portada-regla" aria-hidden="true" />
        <span className="portada-bajada">{t.portada.eyebrow}</span>
      </div>

      <div className="portada-grid" data-expandido={expandido ?? undefined}>
        {proyectos.map((p, i) => (
          <Panel
            key={p.id}
            proyecto={p}
            indice={i}
            conVideo={conVideo}
            esTactil={esTactil}
            expandido={expandido === p.id}
            onAmpliar={() => setExpandido(p.id)}
          />
        ))}
      </div>

      {/* ZÓCALO de la desarrolladora. Replica el pie del key visual del cliente: las
          cuatro virtudes separadas por filetes y, en el CENTRO, el logotipo de CCM
          —que es quien desarrolla TIER—. En celular el logo se va a su propio renglón
          arriba y las virtudes caen de a dos, que es lo único que entra bien. */}
      <footer className="portada-pie">
        <span className="pie-virtud">{t.portada.virtudes[0]}</span>
        <span className="pie-virtud">{t.portada.virtudes[1]}</span>
        <span className="pie-ccm">
          <img src="/logo-ccm.png" alt={t.portada.ccmAlt} />
        </span>
        <span className="pie-virtud">{t.portada.virtudes[2]}</span>
        <span className="pie-virtud">{t.portada.virtudes[3]}</span>
      </footer>

      {/* Cerrar la vista ampliada. Sólo existe mientras hay un panel abierto, así que
          en escritorio no aparece nunca. */}
      {expandido ? (
        <button
          type="button"
          className="portada-cerrar"
          onClick={() => setExpandido(null)}
          aria-label={t.portada.cerrar}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </main>
  );
}
