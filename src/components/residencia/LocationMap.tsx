"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, LngLatBounds, Popup } from "maplibre-gl";
import type { SiteConfig } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { useOrigen } from "@/components/OrigenProvider";
import {
  nombreCompleto,
  posterThumb,
  proyectoDeEsteSitio,
  proyectosEnMapa,
  type Proyecto,
} from "@/data/proyectos";

const DARK_MATTER = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Mapa interactivo (sección 7). Port de la lógica de /design-reference/app.js a
 * React: marker dorado pulsante + label para ESTE edificio, y un punto con popup
 * (nombre + dirección + fachada) por cada OTRO desarrollo de TIER; scrollZoom
 * opt-in (click en el canvas o pill), pills Explorar/Zoom/Centrar y flyTo de
 * entrada al entrar en viewport.
 *
 * Los datos vienen de dos lados: `site` (este edificio, marca, dirección) y
 * `PROYECTOS` (los hermanos, con sus coordenadas y a quién los comercializa —
 * ver `proyectosEnMapa`). maplibre-gl se importa dinámico para evitar `window` en SSR.
 *
 * Sobre "cuánta libertad hay sobre el mapa": los marcadores y los popups son DOM
 * NUESTRO (`document.createElement` + `popup.setHTML`), maplibre sólo los posiciona.
 * O sea que adentro va cualquier HTML — la fachada de cada proyecto, por ejemplo.
 * Lo que no es nuestro es el estilo del mapa (tiles de CARTO, sin API key).
 */
export function LocationMap({ site }: { site: SiteConfig }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const boundsRef = useRef<LngLatBounds | null>(null);
  const zoomOnRef = useRef(false);
  const [zoomOn, setZoomOn] = useState(false);
  const { t } = useI18n();
  // Popups de los hermanos vivos en el mapa: se re-escriben al cambiar de idioma (el
  // mapa NO se recrea — sólo el texto). Se guarda el PROYECTO entero y no `{name,cat}`
  // sueltos porque el HTML del popup lleva también la fachada: con los dos campos
  // pelados, el re-armado por idioma borraba la foto.
  const poiPopupsRef = useRef<{ popup: Popup; proyecto: Proyecto }[]>([]);

  // Los OTROS desarrollos de TIER que van marcados, filtrados por quién trajo la
  // visita (ver `proyectosEnMapa`). Sin esto, con ?v=inmobiliaria el mapa mostraba el
  // cartel de un proyecto que esa inmobiliaria no comercializa — y encima pegado,
  // porque acá los popups quedan SIEMPRE abiertos (pedido del cliente, ver más abajo).
  const { origen } = useOrigen();
  const hermanos = useMemo(() => proyectosEnMapa(origen), [origen]);
  // Dep ESTABLE para el efecto del mapa: `useMemo` devuelve un array nuevo en cada
  // cambio de origen y el efecto recrea el mapa entero. Con la clave, sólo se rearma
  // si el CONJUNTO cambió de verdad.
  const claveHermanos = hermanos.map((p) => p.id).join("|");

  /**
   * El HTML del popup de un hermano. UNA sola función usada en los DOS lugares que
   * lo escriben (el armado inicial y el re-armado por idioma): antes estaban
   * duplicados y el de idioma sólo ponía nombre + dirección, así que cualquier cosa
   * que se agregara acá se borraba al cambiar de idioma.
   *
   * La fachada va `loading="lazy"`: son hasta dos popups abiertos de entrada y el
   * mapa vive muy abajo en la ficha. Si el proyecto todavía no tiene fachada, no se
   * dibuja nada — mismo criterio que la portada, no se presta la foto de otro.
   */
  const htmlPopup = (p: Proyecto) => {
    const foto = posterThumb(p);
    const nombre = esc(t.location.poiName(nombreCompleto(p)));
    // Sólo la CALLE: el barrio que lleva `ubicacion` ("… · Almagro") acá sobra —está
    // escrito en el propio mapa— y encima empuja la dirección a dos renglones en una
    // tarjeta de 208px. En la portada, que no tiene mapa al lado, sí se muestra entero.
    const dir = esc(t.location.poiCat((p.ubicacion ?? "").split(" · ")[0]));
    return (
      (foto ? `<img class="pop-foto" src="${esc(foto)}" alt="" loading="lazy" decoding="async" />` : "") +
      `<div class="pop-txt"><div class="pop-name">${nombre}</div>` +
      (dir ? `<div class="pop-cat">${dir}</div>` : "") +
      `</div>`
    );
  };

  const reduce = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PROP: [number, number] = [site.location.lng, site.location.lat];
  const HOME = { center: PROP, zoom: 13.4, pitch: 50, bearing: -18 };

  useEffect(() => {
    let cancelled = false;
    let io: IntersectionObserver | null = null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      // En pantallas táctiles (celu/tablet) el mapa NO debe atrapar el scroll: con
      // `cooperativeGestures`, un dedo scrollea la PÁGINA y se necesitan DOS dedos para
      // mover/zoomear el mapa (muestra un hint). En desktop queda el zoom opt-in por clic.
      const coarse =
        typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_MATTER,
        center: PROP,
        zoom: 12.4,
        pitch: HOME.pitch,
        bearing: HOME.bearing,
        scrollZoom: false,
        cooperativeGestures: coarse,
        // Hints de gestos en el idioma del MONTAJE (cambiarlos en vivo requeriría
        // recrear el mapa; son transitorios y no lo amerita).
        locale: {
          "CooperativeGesturesHandler.MobileHelpText": t.location.gestures.touch,
          "CooperativeGesturesHandler.WindowsHelpText": t.location.gestures.windows,
          "CooperativeGesturesHandler.MacHelpText": t.location.gestures.mac,
        },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      // Marker de ESTE edificio: punto dorado + anillo pulsante. Lo que lo distingue
      // de los hermanos es el anillo (el "estás acá"), no el formato de la etiqueta:
      // su tarjeta es la MISMA que la de ellos, con su fachada, así los tres se leen
      // parejos en el mapa (antes era una píldora de texto sin foto).
      const pm = document.createElement("div");
      pm.className = "prop-marker";
      pm.innerHTML = `<div class="ring"></div><div class="dot"></div>`;
      new maplibregl.Marker({ element: pm, anchor: "center" }).setLngLat(PROP).addTo(map);

      const esteProyecto = proyectoDeEsteSitio();
      if (esteProyecto) {
        const popupProp = new maplibregl.Popup({
          offset: 16,
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
          maxWidth: "none",
          // `anchor: "top"` = la tarjeta cuelga POR DEBAJO de su pin, al revés que las
          // de los hermanos. Los tres desarrollos están cerca y este edificio queda
          // justo en el medio: con todas las tarjetas para arriba, ésta se montaba
          // encima de la de Sinclair. Hacia abajo el mapa está vacío.
          anchor: "top",
        }).setHTML(htmlPopup(esteProyecto));
        poiPopupsRef.current.push({ popup: popupProp, proyecto: esteProyecto });
        popupProp.setLngLat(PROP).addTo(map);
      }

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend(PROP);

      for (const p of hermanos) {
        const el = document.createElement("div");
        el.className = "poi-marker";
        const popup = new maplibregl.Popup({
          offset: 16,
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
          // La foto ensancha el popup; sin esto maplibre lo deja en su default (240px)
          // y la tarjeta queda apretada.
          maxWidth: "none",
          // Todas las tarjetas CUELGAN del pin (`anchor: "top"`) en vez de crecer
          // hacia arriba, que es el default de maplibre. La entrada del mapa centra
          // en este edificio con bastante zoom y deja a los hermanos cerca del borde
          // superior: con las tarjetas para arriba se cortaban contra el borde y se
          // montaban sobre la de "La dirección". Hacia abajo hay mapa libre.
          anchor: "top",
        }).setHTML(htmlPopup(p));
        poiPopupsRef.current.push({ popup, proyecto: p });
        new maplibregl.Marker({ element: el }).setLngLat([p.coords.lng, p.coords.lat]).addTo(map);
        // Etiqueta SIEMPRE visible (pedido del cliente): los puntos pasaban
        // desapercibidos y no se notaba que eran interactivos. (El popup es
        // pointer-events:none vía CSS, así no traba el paneo del mapa.)
        popup.setLngLat([p.coords.lng, p.coords.lat]).addTo(map);
        // Dentro del mismo for: "Explorar la zona" encuadra `bounds`, así que un
        // hermano escondido tampoco tiene que estirar el encuadre hasta su barrio.
        bounds.extend([p.coords.lng, p.coords.lat]);
      }
      boundsRef.current = bounds;

      const enableZoom = () => {
        if (zoomOnRef.current) return;
        map.scrollZoom.enable();
        zoomOnRef.current = true;
        setZoomOn(true);
      };
      map.getCanvas().addEventListener("click", enableZoom);

      // Entrada cinemática: flyTo cuando la sección entra en viewport (una vez).
      let flew = false;
      const doFly = () =>
        // 13.9 y no 14.4: a 14.4 el pin de Sinclair quedaba FUERA del encuadre y su
        // tarjeta entraba cortada contra el borde de arriba. Ahora que cada punto
        // lleva una tarjeta con fachada, el encuadre de entrada tiene que mostrar el
        // portfolio completo — que es justo lo que la sección viene a contar.
        map.flyTo({ center: PROP, zoom: 13.9, pitch: 56, bearing: -24, duration: reduce() ? 0 : 3000, essential: true });
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !flew) {
              flew = true;
              if (map.loaded()) doFly();
              else map.once("load", doFly);
            }
          }
        },
        { threshold: 0.35 },
      );
      io.observe(containerRef.current);

      map.on("load", () => map.resize());
    })();

    return () => {
      cancelled = true;
      io?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      zoomOnRef.current = false;
      poiPopupsRef.current = [];
    };
    // `claveHermanos`: el origen se resuelve DESPUÉS del primer render (ver
    // OrigenProvider), así que si cambia el conjunto de hermanos hay que rearmar el
    // mapa. Va la clave y no el array porque `useMemo` devuelve uno nuevo cada vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, claveHermanos]);

  // Idioma: re-escribí el HTML de los popups ya creados. Usa la MISMA función que el
  // armado inicial, así no hay dos versiones del popup que se puedan desincronizar
  // (antes ésta lo re-armaba sin la foto y la borraba al cambiar de idioma).
  useEffect(() => {
    for (const { popup, proyecto } of poiPopupsRef.current) {
      popup.setHTML(htmlPopup(proyecto));
    }
    // `htmlPopup` se redefine en cada render; la dep real es el idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const recenter = () =>
    mapRef.current?.flyTo({ ...HOME, duration: reduce() ? 0 : 1600, essential: true });
  const explore = () => {
    if (boundsRef.current)
      mapRef.current?.fitBounds(boundsRef.current, {
        // `fitBounds` encuadra los PUNTOS, no las tarjetas. Desde que cada punto lleva
        // una tarjeta con fachada (~160px de alto, que crece hacia ARRIBA salvo la de
        // este edificio), con un padding parejo las de más al norte quedaban cortadas
        // contra el borde y encima de la tarjeta de "La dirección". De ahí el aire
        // extra arriba y a la izquierda.
        padding: { top: 190, right: 130, bottom: 150, left: 210 },
        pitch: 30,
        bearing: -10,
        duration: reduce() ? 0 : 1900,
        maxZoom: 14.5,
      });
  };
  const enableZoomPill = () => {
    if (zoomOnRef.current || !mapRef.current) return;
    mapRef.current.scrollZoom.enable();
    zoomOnRef.current = true;
    setZoomOn(true);
  };

  // Destino por COORDENADAS (no por dirección textual): el "s/n" geocodifica a
  // cualquier lado; las coords son el pin exacto que pasó el cliente.
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${site.location.lat},${site.location.lng}`;

  return (
    <div className="map-stage">
      <div id="map" ref={containerRef} />

      <div className="map-info-card">
        <div className="mi-eyebrow">{t.location.addressLabel}</div>
        <div className="mi-addr">{site.addressBase}</div>
        <div className="mi-note">
          <span className="dotg" />
          {t.location.skiNote}
        </div>
        <a className="mi-cta" href={dir} target="_blank" rel="noopener noreferrer">
          {t.location.directions}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>

      <div className="map-pills">
        <div className="map-pill" onClick={explore}>
          {t.location.exploreArea}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        <div className={`map-pill zoom-pill${zoomOn ? " active" : ""}`} onClick={enableZoomPill}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4M11 8v6M8 11h6" />
          </svg>
          {t.location.clickZoom}
        </div>
        <div className="map-pill" onClick={recenter}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          {t.location.recenter}
        </div>
      </div>
    </div>
  );
}
