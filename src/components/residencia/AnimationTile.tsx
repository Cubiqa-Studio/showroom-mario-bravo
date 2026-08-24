"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";

/**
 * Animación vertical del proyecto (Camila 22/07): tile con autoplay muteado al
 * pie de la lista de Especificaciones; click/tap → modal ampliado con sonido.
 *
 * Dos encodes en /public para no pagar el video completo en el scroll:
 *  - animacion-vertical-tile.mp4  540p SIN audio (~2.9 MB) — sólo el tile, y
 *    recién se pide cuando la sección entra al viewport (IntersectionObserver).
 *  - animacion-vertical.mp4       1080×1920 CON audio (~14 MB) — sólo el modal
 *    (se monta al abrir). Master 4K en _media-src (gitignored).
 */
export function AnimationTile() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const tileRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // muted por PROPIEDAD + play() a mano (mismo gotcha SSR que CaviahueModal:
  // sin muted real el browser bloquea el autoplay en prod).
  useEffect(() => {
    const v = tileRef.current;
    if (!v || !inView) return;
    v.muted = true;
    const p = v.play();
    if (p) p.catch(() => {});
  }, [inView]);

  return (
    <>
      <button
        type="button"
        className="anim-tile"
        onClick={() => setOpen(true)}
        aria-label={t.anim.open}
        aria-haspopup="dialog"
      >
        <video
          ref={tileRef}
          className="anim-tile-video"
          src={inView ? "/animacion-vertical-tile.mp4" : undefined}
          poster="/animacion-vertical-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
        />
        <span className="anim-tile-scrim" aria-hidden />
        <span className="anim-tile-label">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
          {t.anim.label}
        </span>
      </button>
      <AnimationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AnimationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [volume, setVolume] = useState(0.1);
  const [muted, setMuted] = useState(false);

  // Al abrir: arranca CON audio al 10%. El click que abrió el modal es el gesto
  // que habilita el sonido; si el browser igual lo bloquea (iOS Low Power etc.),
  // cae a muteado y el botón de sonido queda como destrabe manual.
  useEffect(() => {
    if (!open) return;
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0.1;
    setVolume(0.1);
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const applyVolume = (val: number) => {
    setVolume(val);
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    const m = val === 0;
    v.muted = m;
    setMuted(m);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next && v.volume === 0) {
      v.volume = 0.1;
      setVolume(0.1);
    }
  };

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="anim-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            <div className="anim-frame" role="dialog" aria-label={t.anim.open} onClick={(e) => e.stopPropagation()}>
              <video
                ref={videoRef}
                className="anim-video"
                src="/animacion-vertical.mp4"
                poster="/animacion-vertical-poster.jpg"
                loop
                playsInline
                preload="auto"
              />
              <div className="anim-controls">
                <button
                  type="button"
                  className="anim-btn"
                  onClick={toggleMute}
                  aria-label={muted ? t.anim.unmute : t.anim.mute}
                >
                  {muted ? (
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                      <line x1="22" y1="9" x2="16" y2="15" />
                      <line x1="16" y1="9" x2="22" y2="15" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
              <button type="button" className="anim-close" aria-label={t.anim.close} onClick={onClose}>
                <CloseIcon width={20} height={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
