"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, LngLatBounds, Popup } from "maplibre-gl";
import type { SiteConfig } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";

const DARK_MATTER = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Mapa interactivo (sección 7). Port de la lógica de /design-reference/app.js a
 * React: marker dorado pulsante + label, POIs con popup al hover, scrollZoom
 * opt-in (click en el canvas o pill), pills Explorar/Zoom/Centrar y flyTo de
 * entrada al entrar en viewport. Datos desde `site` (location, pois, marca,
 * dirección). maplibre-gl se importa dinámico para evitar `window` en SSR.
 */
export function LocationMap({ site }: { site: SiteConfig }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const boundsRef = useRef<LngLatBounds | null>(null);
  const zoomOnRef = useRef(false);
  const [zoomOn, setZoomOn] = useState(false);
  const { t } = useI18n();
  // Popups de POIs vivos en el mapa: se re-escriben al cambiar de idioma (el
  // mapa NO se recrea — sólo el texto).
  const poiPopupsRef = useRef<{ popup: Popup; name: string; cat: string }[]>([]);

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

      // Marker de la propiedad: punto dorado + anillo pulsante + label.
      const pm = document.createElement("div");
      pm.className = "prop-marker";
      pm.innerHTML = `<div class="ring"></div><div class="dot"></div><div class="prop-label">${esc(
        site.buildingName ?? site.brandName ?? site.projectName,
      )}</div>`;
      new maplibregl.Marker({ element: pm, anchor: "center" }).setLngLat(PROP).addTo(map);

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend(PROP);

      for (const p of site.pois) {
        const el = document.createElement("div");
        el.className = "poi-marker";
        const popup = new maplibregl.Popup({
          offset: 16,
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
        }).setHTML(
          `<div class="pop-name">${esc(p.name)}</div><div class="pop-cat">${esc(p.cat)}</div>`,
        );
        poiPopupsRef.current.push({ popup, name: p.name, cat: p.cat });
        new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        // Etiqueta SIEMPRE visible (pedido del cliente): los puntos pasaban
        // desapercibidos y no se notaba que eran interactivos. (El popup es
        // pointer-events:none vía CSS, así no traba el paneo del mapa.)
        popup.setLngLat([p.lng, p.lat]).addTo(map);
        bounds.extend([p.lng, p.lat]);
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
        map.flyTo({ center: PROP, zoom: 14.4, pitch: 56, bearing: -24, duration: reduce() ? 0 : 3000, essential: true });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  // Idioma: re-escribí el HTML de los popups de POIs ya creados.
  useEffect(() => {
    for (const { popup, name, cat } of poiPopupsRef.current) {
      popup.setHTML(
        `<div class="pop-name">${esc(t.location.poiName(name))}</div><div class="pop-cat">${esc(
          t.location.poiCat(cat),
        )}</div>`,
      );
    }
  }, [t]);

  const recenter = () =>
    mapRef.current?.flyTo({ ...HOME, duration: reduce() ? 0 : 1600, essential: true });
  const explore = () => {
    if (boundsRef.current)
      mapRef.current?.fitBounds(boundsRef.current, {
        padding: 130,
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
