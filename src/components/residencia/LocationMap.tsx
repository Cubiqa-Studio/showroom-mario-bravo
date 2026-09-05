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
import { acomodarTarjetas, offsetDelLugar, type Caja } from "./acomodarTarjetas";

const DARK_MATTER = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * `new maplibregl.Marker({ element })` le escribe `aria-label="Map marker"` a nuestro
 * div, y un aria-label sobre un elemento sin rol es inválido. Le pone el rol y un
 * nombre que dice cuál es. Va DESPUÉS del constructor, que es quien pisa el label.
 */
function etiquetarMarcador(el: HTMLElement, nombre: string) {
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", nombre);
}

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
  // El encuadre y el acomodo se arman DENTRO del efecto (necesitan el `map`), pero los
  // usan también las pills y el efecto de idioma, que viven fuera. Se publican por ref.
  const encuadrarRef = useRef<((duracion: number) => void) | null>(null);
  const acomodarRef = useRef<(() => void) | null>(null);
  const zoomOnRef = useRef(false);
  const [zoomOn, setZoomOn] = useState(false);
  const { t } = useI18n();
  // Las tarjetas vivas en el mapa (las de los hermanos Y la de este edificio). Se
  // re-escriben al cambiar de idioma (el mapa NO se recrea — sólo el texto). Se guarda
  // el PROYECTO entero y no `{name,cat}` sueltos porque el HTML del popup lleva también
  // la fachada: con los dos campos pelados, el re-armado por idioma borraba la foto.
  //
  // `lngLat` y `lugar` son para el acomodo (ver `acomodarTarjetas`): dónde está clavada
  // la tarjeta y en cuál de los ocho lugares alrededor del pin quedó la última vez.
  const poiPopupsRef = useRef<
    {
      popup: Popup;
      proyecto: Proyecto;
      lngLat: [number, number];
      lugar: number;
      offset: [number, number] | null;
    }[]
  >([]);

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
  // La cámara de arranque y la de "Centrar". `pitch` 40 y no 50 por lo mismo que el
  // encuadre usa 38: la inclinación comprime el eje norte-sur, que es justo el eje en
  // el que están alineados los tres desarrollos, y con los puntos amontonados el
  // acomodador se queda sin lugares buenos — en un teléfono de 360px "Centrar" a 50
  // dejaba una tarjeta cortada contra el borde del mapa.
  const HOME = { center: PROP, zoom: 13.4, pitch: 40, bearing: -16 };

  useEffect(() => {
    let cancelled = false;
    let io: IntersectionObserver | null = null;

    const arrancar = async () => {
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
      etiquetarMarcador(pm, site.buildingName ?? site.projectName);

      const esteProyecto = proyectoDeEsteSitio();
      if (esteProyecto) {
        const popupProp = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
          maxWidth: "none",
          // Ver la nota del ancla en el popup de los hermanos: TODAS las tarjetas van
          // ancladas igual y quien decide de qué lado del pin caen es `acomodarTarjetas`.
          anchor: "top",
        }).setHTML(htmlPopup(esteProyecto));
        poiPopupsRef.current.push({
          popup: popupProp,
          proyecto: esteProyecto,
          lngLat: PROP,
          lugar: 0,
          offset: null,
        });
        popupProp.setLngLat(PROP).addTo(map);
      }

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend(PROP);

      for (const p of hermanos) {
        const el = document.createElement("div");
        el.className = "poi-marker";
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
          // La foto ensancha el popup; sin esto maplibre lo deja en su default (240px)
          // y la tarjeta queda apretada.
          maxWidth: "none",
          // TODAS las tarjetas —las de los hermanos y la de este edificio— van con el
          // MISMO ancla, y de qué lado del pin caen lo decide `acomodarTarjetas` en
          // cada cuadro moviendo el `offset`. El ancla de maplibre se fija al construir
          // el popup y el `offset` no: por eso un solo ancla para todas y toda la
          // decisión en el offset, que sí se puede cambiar en vivo.
          //
          // `"top"` en particular porque maplibre lo dibuja con `translate(-50%, 0)`,
          // o sea que el borde superior-centro de la tarjeta cae exactamente en
          // `pin + offset`: la cuenta más simple de invertir desde el acomodador.
          anchor: "top",
        }).setHTML(htmlPopup(p));
        poiPopupsRef.current.push({
          popup,
          proyecto: p,
          lngLat: [p.coords.lng, p.coords.lat],
          lugar: 0,
          offset: null,
        });
        new maplibregl.Marker({ element: el }).setLngLat([p.coords.lng, p.coords.lat]).addTo(map);
        etiquetarMarcador(el, nombreCompleto(p));
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

      // ── Acomodo de las tarjetas ───────────────────────────────────────────────
      // Los cuadros fijos que las tarjetas tampoco tienen que tapar, en píxeles del
      // contenedor del mapa. Se leen del DOM en vez de anotarlos a mano porque su
      // tamaño cambia por breakpoint y por idioma ("CÓMO LLEGAR" vs "GET DIRECTIONS"
      // no miden lo mismo), y un número escrito acá se desactualiza en silencio.
      const cajaRelativa = (sel: string): Caja | null => {
        const el = containerRef.current?.parentElement?.querySelector(sel);
        const cont = containerRef.current;
        if (!el || !cont) return null;
        const a = el.getBoundingClientRect();
        const b = cont.getBoundingClientRect();
        return { x: a.x - b.x, y: a.y - b.y, w: a.width, h: a.height };
      };

      const acomodar = () => {
        const cont = containerRef.current;
        // Un `requestAnimationFrame` pendiente puede llegar DESPUÉS de que el efecto se
        // limpió y el mapa se destruyó; `map.project` sobre un mapa muerto explota.
        if (!cont || mapRef.current !== map) return;
        const vivas = poiPopupsRef.current.filter((t) =>
          Boolean(t.popup.getElement()?.querySelector(".maplibregl-popup-content")),
        );
        if (vivas.length === 0) return;

        const medidas = vivas.map((t) => {
          const el = t.popup.getElement()!.querySelector(".maplibregl-popup-content") as HTMLElement;
          const p = map.project(t.lngLat);
          return { pin: { x: p.x, y: p.y }, w: el.offsetWidth, h: el.offsetHeight };
        });
        // Cada tarjeta se recuesta HACIA AFUERA del grupo de puntos: la del oeste queda
        // a la izquierda de su punto, la del este a la derecha. Así, con los tres
        // desarrollos amontonados, se ve de una cuál tarjeta es de cuál punto — y las
        // tarjetas se abren en abanico en vez de amontonarse en el medio.
        const centro = {
          x: medidas.reduce((s, m) => s + m.pin.x, 0) / medidas.length,
          y: medidas.reduce((s, m) => s + m.pin.y, 0) / medidas.length,
        };
        for (const m of medidas) {
          const dx = m.pin.x - centro.x;
          const dy = m.pin.y - centro.y;
          const largo = Math.hypot(dx, dy);
          // Un solo punto (o dos exactamente encimados) no tiene "afuera": sin esto,
          // dividir por cero manda la preferencia a NaN y contamina todos los costos.
          if (largo > 1) (m as { hacia?: { x: number; y: number } }).hacia = { x: dx / largo, y: dy / largo };
        }
        // Todavía sin layout (fachada sin cargar, tarjeta en 0×0): no hay nada que
        // acomodar y una medida en cero mandaría todo al mismo lugar.
        if (medidas.some((m) => m.w === 0 || m.h === 0)) return;

        const obstaculos = [
          cajaRelativa(".map-info-card"),
          cajaRelativa(".map-pills"),
          // El +/- de maplibre es chico pero está justo en una esquina donde el
          // acomodador manda tarjetas cuando el pin queda arriba a la derecha.
          cajaRelativa(".maplibregl-ctrl-top-right"),
          // LOS PUNTOS TAMBIÉN SON INTOCABLES. Cada tarjeta ya nace lejos del suyo (el
          // aire de `acomodarTarjetas`), pero nada le impedía irse a un costado y
          // aterrizar justo encima del punto de OTRO desarrollo — pasaba en celular al
          // tocar "Centrar", que junta los tres puntos. Un punto tapado es peor que dos
          // tarjetas rozándose: desaparece el lugar del mapa que la tarjeta señala.
          // El cuadradito de 24 cubre el punto más grande (18px) con un poco de aire.
          ...medidas.map((m) => ({ x: m.pin.x - 12, y: m.pin.y - 12, w: 24, h: 24 })),
        ].filter((c): c is Caja => c !== null);

        const { width, height } = cont.getBoundingClientRect();
        const elegidos = acomodarTarjetas(
          medidas,
          obstaculos,
          { x: 0, y: 0, w: width, h: height },
          vivas.map((t) => t.lugar),
        );

        // Último retoque: si a una tarjeta le queda una tirita afuera del mapa, se la
        // empuja para adentro. El acomodador elige entre ocho lugares fijos y a veces
        // NINGUNO entra del todo (pasaba en un teléfono de 360px al tocar "Centrar",
        // con un desarrollo a 2,7 km del centro del encuadre): entonces elige el que
        // menos sobresale, y ese resto se arregla acá con unos píxeles de corrimiento.
        //
        // El empujón se aplica sólo si NO rompe nada: se descarta si con él la tarjeta
        // pasa a pisar a otra, a un punto o a un cuadro fijo. Es un retoque de borde de
        // pantalla, no una segunda opinión sobre el acomodo.
        const cajas = elegidos.map((lugar, i) => {
          const { dx, dy } = offsetDelLugar(lugar, medidas[i].w, medidas[i].h);
          return { x: medidas[i].pin.x + dx - medidas[i].w / 2, y: medidas[i].pin.y + dy, w: medidas[i].w, h: medidas[i].h };
        });
        const pisa = (a: Caja, b: Caja) =>
          Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
          Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
        const empujon = cajas.map((c) => {
          const M = 6; // un respiro contra el borde, para que no quede lamiendo el filo
          return {
            x: Math.max(0, M - c.x) - Math.max(0, c.x + c.w - (width - M)),
            y: Math.max(0, M - c.y) - Math.max(0, c.y + c.h - (height - M)),
          };
        });
        empujon.forEach((e, i) => {
          if (e.x === 0 && e.y === 0) return;
          const movida = { ...cajas[i], x: cajas[i].x + e.x, y: cajas[i].y + e.y };
          const rompe =
            cajas.some((otra, j) => j !== i && pisa(movida, otra)) ||
            obstaculos.some((o) => pisa(movida, o));
          if (rompe) {
            e.x = 0;
            e.y = 0;
          }
        });

        elegidos.forEach((lugar, i) => {
          const t = vivas[i];
          const base = offsetDelLugar(lugar, medidas[i].w, medidas[i].h);
          const dx = base.dx + empujon[i].x;
          const dy = base.dy + empujon[i].y;
          // Sólo se toca la tarjeta si el lugar cambió DE VERDAD. maplibre ya la
          // reposiciona sola en cada `move`; escribirle un estilo arriba de eso, 60
          // veces por segundo y sin necesidad, es trabajo de layout tirado a la basura.
          if (t.offset && t.offset[0] === dx && t.offset[1] === dy) return;
          t.lugar = lugar;
          t.offset = [dx, dy];
          // ⚠ El corrimiento va en la tarjeta de ADENTRO (`.maplibregl-popup-content`),
          // NO en el popup (`popup.setOffset`). Los dos dejan la tarjeta en el mismo
          // lugar, pero el de afuera es el que maplibre reescribe en cada cuadro para
          // que la tarjeta siga a su punto: animarlo haría que TODA la tarjeta llegue
          // tarde al paneo, como arrastrada. Movida por dentro, el contenedor sigue al
          // punto al instante —clavada al dot— y lo único que se anima es el cambio de
          // lado, que es lo que tiene que verse fluido (Joaquim, 03-09: "se van
          // teletransportando... tienen que moverse junto con el movimiento del dot").
          // La transición vive en el CSS, en `.maplibregl-popup-content`.
          const el = t.popup.getElement()!.querySelector(".maplibregl-popup-content") as HTMLElement;
          el.style.transform = `translate(${dx}px, ${dy}px)`;
        });
      };

      // El acomodo corre en cada cuadro del movimiento (la animación de entrada dura
      // tres segundos y los pines se cruzan en el camino), pero a lo sumo UNA vez por
      // frame: `move` puede dispararse varias veces por cuadro.
      let pedido = 0;
      const pedirAcomodo = () => {
        if (pedido) return;
        pedido = requestAnimationFrame(() => {
          pedido = 0;
          acomodar();
        });
      };
      map.on("move", pedirAcomodo);
      map.on("resize", pedirAcomodo);
      acomodarRef.current = pedirAcomodo;
      // Primer acomodo, antes de que el mapa se mueva. Sin esto las tarjetas arrancan
      // con offset cero —o sea, pegadas al punto y tapándolo— hasta la primera
      // animación. `load` además porque en el primer cuadro la hoja de estilos del
      // popup puede no haber aplicado todavía y las medidas salen en cero.
      pedirAcomodo();
      map.on("load", pedirAcomodo);

      // ── Encuadre ──────────────────────────────────────────────────────────────
      /**
       * Deja los tres puntos a la vista con el aire que necesitan sus tarjetas.
       *
       * El `padding` no está escrito a mano: sale de medir los cuadros que ya están en
       * pantalla. Escrito a mano hay que mantener una tabla de números por breakpoint
       * y por idioma, y se desincroniza con el CSS al primer retoque.
       *
       * La asimetría importante es CUÁL lado se le regala a la tarjeta de la dirección.
       * En escritorio esa tarjeta es angosta respecto del mapa (290 de 1920) y lo que
       * sobra es ANCHO: se reserva a la IZQUIERDA y los puntos se corren a la derecha,
       * que es justo el espacio que antes quedaba vacío. En celular ocupa media pantalla
       * de ancho, así que reservar a la izquierda no dejaría lugar para nada: ahí se
       * reserva ARRIBA, que es la dimensión que sobra en un mapa alto y angosto.
       */
      const encuadrar = (duracion: number) => {
        const cont = containerRef.current;
        if (!cont || !boundsRef.current) return;
        const { width, height } = cont.getBoundingClientRect();

        // Media tarjeta: es lo que sobresale a cada lado del pin cuando el acomodador
        // la manda a un costado. Con la tarjeta más grande alcanza para todas.
        const anchos = poiPopupsRef.current.map(
          (t) =>
            (t.popup.getElement()?.querySelector(".maplibregl-popup-content") as HTMLElement | null)
              ?.offsetWidth ?? 0,
        );
        const altos = poiPopupsRef.current.map(
          (t) =>
            (t.popup.getElement()?.querySelector(".maplibregl-popup-content") as HTMLElement | null)
              ?.offsetHeight ?? 0,
        );
        const media = Math.max(...anchos, 0) / 2 + 12;
        const medioAlto = Math.max(...altos, 0) / 2 + 12;

        const info = cajaRelativa(".map-info-card");
        const pills = cajaRelativa(".map-pills");
        const infoAncha = !info || info.w > width * 0.42;

        let top = medioAlto + (infoAncha && info ? info.y + info.h + 12 : 0);
        let bottom = medioAlto + (pills ? height - pills.y + 12 : 0);
        let left = Math.max(media, !infoAncha && info ? info.x + info.w + 16 : 0);
        let right = media;

        // fitBounds se rompe si el aire se come el cuadro. Cuando el mapa es muy
        // chico (o la tarjeta de la dirección muy alta) se achica todo el aire en
        // proporción, en vez de recortar un lado y descentrar el encuadre.
        const kv = Math.min(1, (height * 0.75) / Math.max(1, top + bottom));
        const kh = Math.min(1, (width * 0.75) / Math.max(1, left + right));
        top *= kv;
        bottom *= kv;
        left *= kh;
        right *= kh;

        map.fitBounds(boundsRef.current, {
          padding: { top, bottom, left, right },
          // 38 y no 56: el `pitch` es la causa de raíz de que las tarjetas se pisaran.
          // La perspectiva COMPRIME el eje norte-sur, y los tres desarrollos están
          // justo alineados norte-sur: a 56 los 2,7 km que separan a Sinclair de Bravo
          // se dibujaban en ~125px de pantalla, menos que el alto de UNA tarjeta. A 38
          // el mapa sigue siendo una vista 3D pero los pines se separan lo suficiente
          // como para que el acomodador tenga con qué trabajar.
          pitch: 38,
          bearing: -14,
          duration: duracion,
          // Con `?v=inmobiliaria` el mapa muestra dos puntos en vez de tres y el
          // encuadre se cierra mucho más: sin tope, fitBounds se va a zoom de manzana
          // y el mapa deja de contar dónde queda el edificio en la ciudad.
          maxZoom: 15,
          essential: true,
        });
      };
      encuadrarRef.current = encuadrar;

      // Entrada cinemática: encuadre cuando la sección entra en viewport (una vez).
      let flew = false;
      // El encuadre de entrada muestra el PORTFOLIO COMPLETO —cada punto con su
      // fachada, que es lo que la sección viene a contar— y es el MISMO en celular y
      // en escritorio: `encuadrar` mide el mapa y los cuadros que hay encima, así que
      // no hace falta una rama por tamaño de pantalla. Antes había dos (un `flyTo` con
      // zoom fijo arriba de 640px y un `fitBounds` con paddings a mano abajo), y el
      // zoom fijo era justamente el que dejaba los tres puntos amontonados.
      const doFly = () => encuadrar(reduce() ? 0 : 3000);
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
    };

    // maplibre-gl son ~785 KB y armar el mapa levanta un contexto WebGL. "Ubicación"
    // está varias pantallas debajo del pliegue: se arranca recién cuando se asoma.
    // Sin IntersectionObserver (navegador viejo) arranca de una, como antes.
    const cerca = containerRef.current;
    if (!cerca || typeof IntersectionObserver === "undefined") {
      void arrancar();
      return () => {
        cancelled = true;
        io?.disconnect();
        mapRef.current?.remove();
        mapRef.current = null;
        zoomOnRef.current = false;
        poiPopupsRef.current = [];
        encuadrarRef.current = null;
        acomodarRef.current = null;
      };
    }
    const ioArranque = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        ioArranque.disconnect();
        void arrancar();
      },
      { rootMargin: "400px" },
    );
    ioArranque.observe(cerca);

    return () => {
      cancelled = true;
      ioArranque.disconnect();
      io?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      zoomOnRef.current = false;
      poiPopupsRef.current = [];
      encuadrarRef.current = null;
      acomodarRef.current = null;
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
    // El texto nuevo cambia el TAMAÑO de la tarjeta ("CÓMO LLEGAR" no mide lo mismo
    // que "GET DIRECTIONS", y "Av. Estado de Israel 4338" puede pasar de uno a dos
    // renglones), así que hay que volver a acomodarlas: un acomodo calculado con las
    // medidas viejas deja tarjetas pisadas hasta que el visitante mueva el mapa.
    acomodarRef.current?.();
    // `htmlPopup` se redefine en cada render; la dep real es el idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const recenter = () =>
    mapRef.current?.flyTo({ ...HOME, duration: reduce() ? 0 : 1600, essential: true });
  // "Explorar la zona" hace lo mismo que la entrada —dejar los tres puntos a la vista
  // con el aire que piden sus tarjetas—, así que usa el MISMO encuadre en vez de una
  // segunda tabla de paddings a mano. Antes eran dos juegos de números distintos que
  // había que mantener en paralelo, y sólo uno de los dos se corregía por vez.
  const explore = () => encuadrarRef.current?.(reduce() ? 0 : 1900);
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
