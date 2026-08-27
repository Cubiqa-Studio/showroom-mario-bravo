"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Contenido del botón "Descubrir". Va DENTRO del <Link> para poder leer
 * `useLinkStatus()`: mientras la navegación a /showroom está en vuelo (la página
 * es force-dynamic → server fetch de stops + Airtable), `pending` es true y la
 * flecha se reemplaza por un spinner, así el click tiene feedback inmediato.
 */
function DiscoverContent({ cta }: { cta: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {cta}
      {pending ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="transition-transform duration-300 group-hover:translate-y-0.5 motion-reduce:transform-none"
        >
          <path
            d="M12 5v14M5 12l7 7 7-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portada de entrada (intro). Es la PÁGINA raíz "/": el video de animación en
// bucle a pantalla completa + un botón "Descubrir" abajo al centro que navega
// (push) a /showroom. Al ser dos rutas distintas (intro = "/", showroom =
// "/showroom") el historial del navegador hace todo el trabajo:
//   · "Descubrir" → /showroom; el back nativo vuelve acá, al video;
//   · un F5 sobre el showroom NO repite la intro (su URL es propia);
//   · para volver a verla, alcanza con ir a "/" (o el back) — sin cookies.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ `false` mientras no exista el video de intro en `public/`. Con el flag apagado
 * el efecto NO setea el `src` y la portada queda en el poster (un still del
 * edificio) + el CTA: se ve igual de bien y evita dos 404 por visita.
 * Poné `true` cuando corras el Paso 10 y existan `public/intro.mp4` +
 * `public/intro-mobile.mp4`.
 */
const INTRO_VIDEO_READY = false;

/**
 * Los Image() del precalentado viven a NIVEL DE MÓDULO, no en el componente: cuando el
 * visitante aprieta "Descubrir" la intro se desmonta, y si las referencias murieran con
 * ella el navegador podría abortar las descargas a medio camino — justo el momento en
 * que más las necesitamos. Acá sobreviven a la navegación y terminan de llenar la cache.
 * No se llama `decode()`: lo que hace falta es tener los BYTES locales; los 249 MB de
 * bitmap por tramo los maneja el visor con su propio ciclo de decode.
 */
const precalentados: HTMLImageElement[] = [];

export function IntroScreen({ preload = [] }: { preload?: string[] }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [ready, setReady] = useState(false); // entrada suave del botón

  // Precalentado del showroom mientras se mira la portada. Corre una sola vez por carga
  // de página (si ya hay algo en `precalentados`, esta visita ya lo disparó). Van en
  // prioridad BAJA: no tienen que competir con el poster ni con el JS de la propia
  // intro, sólo aprovechar la red ociosa mientras el visitante lee.
  useEffect(() => {
    if (precalentados.length > 0 || preload.length === 0) return;
    for (const src of preload) {
      const img = new Image();
      img.fetchPriority = "low";
      img.decoding = "async";
      img.src = src;
      precalentados.push(img);
    }
  }, [preload]);

  useEffect(() => {
    linkRef.current?.focus(); // el teclado puede entrar directo al CTA

    const v = videoRef.current;
    // Respeta "reduce motion": sin autoplay del bucle (queda el poster = frame 0).
    const reduce =
      !INTRO_VIDEO_READY || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Fuente elegida por ancho de viewport: los teléfonos bajan un encode 720p
    // liviano (~1.8 MB) en vez del 1080p de escritorio (~5.6 MB). El swap va por
    // JS (matchMedia), NO con `<source media>` (Safari lo respeta de forma poco
    // confiable). El `src` se setea recién acá (tras hidratar) → el primer paint
    // sólo baja el poster (~60 KB), no 8 MB de video de entrada.
    const ac = new AbortController();
    if (v && !reduce) {
      const mobile = window.matchMedia("(max-width: 932px)").matches;
      // `muted` por PROPIEDAD además del atributo JSX: React no lo aplica confiable
      // con SSR/hydration, y un <video> no REALMENTE muteado tiene el autoplay
      // bloqueado (quedaría congelado en el poster). Setearlo antes del src.
      v.muted = true;
      v.src = mobile ? "/intro-mobile.mp4" : "/intro.mp4";

      // Reintento al primer gesto, UNA vez: iOS en Modo de Bajo Consumo bloquea hasta
      // el autoplay muteado. Como el poster es el frame 0, el primer toque arranca el
      // movimiento sin salto.
      let gestureArmed = false;
      const armGesture = () => {
        if (gestureArmed) return;
        gestureArmed = true;
        const onGesture = () => {
          videoRef.current?.play().catch(() => {});
          ac.abort();
        };
        window.addEventListener("pointerdown", onGesture, { signal: ac.signal });
        window.addEventListener("keydown", onGesture, { signal: ac.signal });
      };
      const tryPlay = () => {
        videoRef.current?.play().catch((err: unknown) => {
          // AbortError = el play() sincrónico corrió contra la carga recién iniciada
          // (setear src resetea readyState a 0). NO es un bloqueo de autoplay: se
          // reintenta solo en 'canplay'/'loadeddata'. Sólo armamos el gesto si el
          // navegador BLOQUEA de verdad el autoplay (NotAllowedError, ej. Low Power).
          if (err instanceof DOMException && err.name === "AbortError") return;
          armGesture();
        });
      };
      // Intento inmediato (iOS necesita el play() para arrancar la carga) + reintento
      // en cuanto hay datos para reproducir (DESKTOP: rescata el play() que perdía la
      // carrera y dejaba el poster congelado). play() es idempotente si ya reproduce.
      tryPlay();
      v.addEventListener("canplay", tryPlay, { once: true, signal: ac.signal });
      v.addEventListener("loadeddata", tryPlay, { once: true, signal: ac.signal });
    }

    // Revelar el botón en el frame siguiente enmascara el swap ES→EN del i18n de
    // cliente (el server siempre pinta ES en el primer HTML).
    const raf = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(raf);
      ac.abort();
    };
  }, []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {/* H1 + descripción crawleable (sr-only): dan a la portada un encabezado y
          texto indexable (ubicación, cantidad de residencias, amenities, tour 360°)
          sin alterar el diseño inmersivo del video. */}
      <section className="sr-only">
        <h1>{t.seo.homeH1}</h1>
        <p>{t.seo.homeBody}</p>
      </section>

      {/* El `src` NO va acá: lo setea el efecto por matchMedia (mobile 720p vs
          desktop 1080p). preload="auto" garantiza que el navegador cargue datos y
          dispare 'canplay' (el efecto reintenta el play() ahí → autoplay confiable en
          desktop). El poster (60 KB) pinta primero igual; el video mobile ya pesa
          ~1.8 MB, así que no vuelve el burst pesado que competía con el primer paint. */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        // autoPlay declarativo = la forma MÁS confiable de arrancar un bucle de fondo
        // muteado en desktop: el navegador lo reproduce solo cuando el `src` (que setea
        // el efecto) está listo, sin depender del play() por JS. El play() del efecto
        // queda de respaldo (iOS/Low Power) y el gate de reduced-motion sigue vía el
        // `src`: si el visitante pidió movimiento reducido, el efecto NO setea src →
        // autoPlay no tiene qué reproducir → queda el poster.
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/intro-poster.jpg"
      />

      {/* Velado sutil para que el botón lea sobre cualquier frame del video. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/15" />

      {/* Botón Descubrir — centrado en X, abajo de todo (Y). Navega a /showroom. */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-6 pb-12 sm:pb-16">
        <Link
          ref={linkRef}
          href="/showroom"
          // Prefetch (default): con /showroom ahora en ISR + loading.tsx, Next pre-baja
          // el shell + JS del showroom mientras se ve la intro, así "Descubrir" navega
          // casi instantáneo. (Antes probamos prefetch={false} para no robarle ancho de
          // banda al video; pero el video mobile ya pesa ~1.8 MB y el costo real era el
          // spinner largo al bajar el chunk recién en el click → se revierte.)
          className={`group inline-flex items-center gap-3 rounded-full border border-white/40 bg-white/5 px-10 py-4 font-sans text-[16.5px] uppercase tracking-[0.28em] text-white shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-500 ease-out hover:border-gold hover:bg-gold hover:tracking-[0.32em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none ${
            ready ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <DiscoverContent cta={t.splash.cta} />
        </Link>
      </div>
    </main>
  );
}
