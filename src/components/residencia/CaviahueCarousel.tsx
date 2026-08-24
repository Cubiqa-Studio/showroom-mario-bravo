"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/LanguageProvider";

/* eslint-disable @next/next/no-img-element */

const pad = (n: number) => String(n).padStart(2, "0");

/** ms que dura cada foto antes de avanzar (los videos avanzan al terminar). */
const IMAGE_MS = 5000;

type Slide =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster: string };

// Media del entorno / barrio del edificio (fotos y videos del cliente, derivados a
// WebP/mp4 en public/; crudos en _media-src/). Es el carrusel de la sección
// "Conocé el barrio" del menú.
//
// ⚠ VACÍO A PROPÓSITO — el cliente todavía no entregó material del barrio. Mientras
// esté vacío, `HAS_DESTINATION_MEDIA` es false y el SideMenu no muestra la entrada:
// dejarla visible abriría un modal con un carrusel roto. Cargá los derivados en
// public/ y listalos acá para reactivar la sección (además del copy en
// `t.caviahue` de src/i18n/translations.ts, que hoy sigue siendo el de Caviahue).
const SLIDES: Slide[] = [];

/** El menú esconde la sección de entorno mientras no haya media cargada. */
export const HAS_DESTINATION_MEDIA = SLIDES.length > 0;

/**
 * Galería auto-avanzante de "Conocé Caviahue" (reemplaza al video CapCut,
 * pedido Camila 22/07): pasa sola hacia la derecha con wrap-around, barra de
 * progreso segmentada (estilo stories: posición + cuánto falta), flechas, y
 * los 2 videos reproducen con sonido — avanzan recién cuando terminan.
 * Mobile-first: el marco crece en alto en pantallas chicas y las verticales
 * se muestran enteras (contain) sobre su propio fondo blureado.
 */
export function CaviahueCarousel() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  // Volumen de los videos: arranca al 10% (mismo criterio que el modal "Ver
  // video"). Ref espejo para que el efecto de activación no dependa del estado
  // (cambiar el slider no debe reiniciar el video).
  const [volume, setVolume] = useState(0.1);
  const volumeRef = useRef(0.1);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);

  const n = SLIDES.length;
  const slide = SLIDES[index];

  const go = useCallback(
    (d: 1 | -1) => {
      // La pausa es POR SLIDE: al cambiar (flechas, timer o fin de video) el
      // nuevo slide arranca andando — si no, el badge de play quedaba pegado.
      setPaused(false);
      setDir(d);
      setIndex((i) => (i + d + n) % n);
    },
    [n],
  );

  // Reloj del slide actual (solo fotos): arranca de cero en cada cambio.
  useEffect(() => {
    elapsedRef.current = 0;
    startRef.current = performance.now();
  }, [index]);

  // Pausa (hover desktop): al reanudar, descuenta lo ya recorrido.
  useEffect(() => {
    if (!paused) startRef.current = performance.now() - elapsedRef.current;
  }, [paused]);

  // Videos: reproducen CON sonido (el modal se abrió con un gesto). Si el
  // browser lo bloquea igual (autoplay policy al llegar auto-avanzando),
  // cae a muteado y el botón de sonido destraba.
  useEffect(() => {
    if (slide.type !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.volume = volumeRef.current;
    v.muted = false;
    setMuted(false);
    const p = v.play();
    if (p)
      p.catch(() => {
        v.muted = true;
        setMuted(true);
        const p2 = v.play();
        if (p2) p2.catch(() => {});
      });
  }, [index, slide]);

  useEffect(() => {
    if (slide.type !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else {
      const p = v.play();
      if (p) p.catch(() => {});
    }
  }, [paused, slide]);

  // Un solo rAF: avanza las fotos por tiempo y pinta la barra de progreso
  // (fotos → reloj propio; videos → currentTime/duration del elemento).
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      let frac = 0;
      if (slide.type === "image") {
        if (!paused) elapsedRef.current = now - startRef.current;
        frac = Math.min(1, elapsedRef.current / IMAGE_MS);
        if (frac >= 1) {
          go(1);
          return;
        }
      } else {
        const v = videoRef.current;
        frac = v && v.duration ? Math.min(1, v.currentTime / v.duration) : 0;
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${frac})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, slide, go]);

  // Precarga de la próxima foto para que la transición nunca muestre gris.
  useEffect(() => {
    const next = SLIDES[(index + 1) % n];
    if (next.type === "image") {
      const img = new window.Image();
      img.src = next.src;
    }
  }, [index, n]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next && v.volume === 0) {
      v.volume = 0.1;
      volumeRef.current = 0.1;
      setVolume(0.1);
    }
  };

  const applyVolume = (val: number) => {
    setVolume(val);
    volumeRef.current = val;
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    const m = val === 0;
    v.muted = m;
    setMuted(m);
  };

  const bg = slide.type === "image" ? slide.src : slide.poster;

  return (
    <div className="cvc" role="region" aria-roledescription="carousel" aria-label={t.caviahue.galleryAria}>
      <div className="cvc-stage">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={index}
            className={`cvc-slide${slide.type === "video" ? " is-video" : ""}`}
            custom={dir}
            // Click/tap = pausa/reanuda SÓLO en videos (pedido 22/07); en las
            // fotos no hace nada. Flechas y controles son botones aparte.
            onClick={() => {
              if (slide.type === "video") setPaused((p) => !p);
            }}
            variants={{
              enter: (d: 1 | -1) => ({ x: d > 0 ? "8%" : "-8%", opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: 1 | -1) => ({ x: d > 0 ? "-8%" : "8%", opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <img className="cvc-bg" src={bg} alt="" aria-hidden draggable={false} />
            {slide.type === "image" ? (
              <img className="cvc-media" src={slide.src} alt="" draggable={false} />
            ) : (
              <video
                ref={videoRef}
                className="cvc-media"
                src={slide.src}
                poster={slide.poster}
                playsInline
                preload="auto"
                onEnded={() => go(1)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <button type="button" className="cvc-arrow cvc-arrow--prev" aria-label={t.galleryModal.prev} onClick={() => go(-1)}>
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button type="button" className="cvc-arrow cvc-arrow--next" aria-label={t.galleryModal.next} onClick={() => go(1)}>
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {paused && slide.type === "video" && (
          <span className="cvc-paused" aria-hidden>
            <svg viewBox="0 0 24 24" width={26} height={26} fill="currentColor">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          </span>
        )}

        {slide.type === "video" && (
          <div className="cvc-controls">
            <button
              type="button"
              className="anim-btn"
              onClick={toggleMute}
              aria-label={muted ? t.anim.unmute : t.anim.mute}
            >
              {muted ? (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              )}
            </button>
            <input
              type="range"
              className="anim-volume"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              aria-label={t.anim.volume}
            />
          </div>
        )}

        <span className="cvc-count">
          {pad(index + 1)} / {pad(n)}
        </span>
      </div>

      {/* Barra segmentada estilo stories: los pasados llenos, el actual se va
          llenando (cuánto falta para el próximo), los que vienen vacíos. */}
      <div className="cvc-progress" aria-hidden>
        {SLIDES.map((_, i) => (
          <span key={i} className={`cvc-seg${i < index ? " done" : ""}`}>
            {i === index && <span ref={barRef} className="cvc-seg-fill" />}
          </span>
        ))}
      </div>
    </div>
  );
}
