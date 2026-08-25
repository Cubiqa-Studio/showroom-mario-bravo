"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/LanguageProvider";
import { captureCta } from "@/lib/analytics";
import {
  CompressIcon,
  ExpandIcon,
  MenuIcon,
  PhoneIcon,
  ShareIcon,
} from "./icons";

interface ShowroomToolbarProps {
  /** Pintar todas las unidades por estado (switch "Disponibilidad"). */
  showAvailability: boolean;
  onToggleAvailability: (v: boolean) => void;
  /** wa.me con el mensaje pre-cargado para "Consultar ahora". */
  consultHref: string;
  /** Abre el menú lateral (hamburguesa). */
  onOpenMenu: () => void;
}

/** Fullscreen del documento, con estado sincronizado al evento del navegador. */
function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }, []);
  return { isFullscreen, toggle };
}

/**
 * Chrome flotante del showroom. Arriba a la derecha, la barra de acciones
 * (consultar por WhatsApp, compartir, pantalla completa y menú) con el dorado
 * reservado para "Consultar ahora". Abajo a la izquierda, el switch de
 * disponibilidad — pedido del cliente. El pintado es siempre por unidad.
 */
export function ShowroomToolbar({
  showAvailability,
  onToggleAvailability,
  consultHref,
  onOpenMenu,
}: ShowroomToolbarProps) {
  const { isFullscreen, toggle } = useFullscreen();
  const [copied, setCopied] = useState(false);
  const { lang, setLang, t } = useI18n();

  // Compartir: Web Share nativo (móvil) y, si no hay, copiar el link al portapapeles.
  const onShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Showroom TIER Bravo", url });
      } catch {
        /* el usuario canceló el diálogo nativo */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* portapapeles no disponible */
    }
  }, []);

  return (
    <>
      {/* Barra 1 — acciones (arriba a la derecha) */}
      <div
        className="absolute right-4 top-4 z-30"
        // No dejes que un click en la barra dispare el drag del flyby.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 rounded-2xl bg-white/85 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur sm:gap-1.5 sm:p-1.5">
          <motion.a
            href={consultHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => captureCta("whatsapp", "showroom_toolbar")}
            className="group relative inline-flex items-center overflow-hidden rounded-xl bg-gold px-3 py-1.5 text-xs font-semibold tracking-wide text-cream shadow-sm transition-colors hover:bg-gold-soft sm:px-3.5 sm:py-2 sm:text-sm"
            // Vibra TODO el botón (multidirección, sutil, tipo teléfono sonando):
            // ráfaga corta + descanso, en loop. Se FRENA en hover (variante "rest")
            // para no estorbar el click — y ahí entra el shine.
            initial="buzz"
            animate="buzz"
            whileHover="rest"
            variants={{
              buzz: {
                // Recorre las CUATRO diagonales (arriba-izq → arriba-der → abajo-der
                // → abajo-izq) para que se muevan TODAS las esquinas, no una sola.
                // Amplitud contenida (~1.8px): se nota sin que el botón toque el borde
                // de la pill (en mobile el padding es chico).
                x: [0, -1.4, 1.8, 1.6, -1.8, -1, 1.2, 0],
                y: [0, -1.4, -1.6, 1.6, 1.4, -1, 1, 0],
                rotate: [0, -0.9, 0.9, 0.7, -0.9, -0.5, 0.5, 0],
                transition: { duration: 0.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.5 },
              },
              rest: { x: 0, y: 0, rotate: 0, transition: { duration: 0.3, ease: "easeOut" } },
            }}
          >
            {/* Shine: barra de luz diagonal que barre de izq → der en hover. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-[150%] skew-x-12 bg-gradient-to-r from-transparent via-white/55 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[150%]"
            />
            <span className="relative z-10 inline-flex items-center gap-2">
              <PhoneIcon width={18} height={18} />
              {/* Texto corto en pantallas muy angostas (~<375px) para que la barra
                  entre en una sola línea y no se amontone. */}
              <span className="min-[375px]:hidden">{t.toolbar.consultShort}</span>
              <span className="hidden min-[375px]:inline">{t.toolbar.consultNow}</span>
            </span>
          </motion.a>

          <span className="h-6 w-px bg-line" />

          {/* Switch de idioma (pedido del cliente: ES preseleccionado). */}
          <div className="flex items-center rounded-full bg-mist p-0.5 text-xs font-bold tracking-wide">
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-full px-2.5 py-1 uppercase transition ${
                  lang === l ? "bg-gold text-cream shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <IconButton label={t.toolbar.share} onClick={onShare}>
            <ShareIcon width={20} height={20} />
          </IconButton>

          <IconButton
            label={isFullscreen ? t.toolbar.exitFullscreen : t.toolbar.fullscreen}
            onClick={toggle}
          >
            {isFullscreen ? (
              <CompressIcon width={20} height={20} />
            ) : (
              <ExpandIcon width={20} height={20} />
            )}
          </IconButton>

          <IconButton label={t.toolbar.menu} onClick={onOpenMenu}>
            <MenuIcon width={20} height={20} />
          </IconButton>
        </div>

        {/* "Enlace copiado" tras compartir por fallback. */}
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="pointer-events-none absolute right-2 top-full z-50 mt-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream shadow-lg"
            >
              {t.toolbar.linkCopied}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Barra 2 — disponibilidad. Desktop: abajo a la izquierda. Mobile: arriba a la
          derecha, DEBAJO de la barra de acciones (abajo-izq pisaba las flechas). */}
      <div
        className="absolute right-4 top-[84px] z-30 flex items-center gap-2 rounded-2xl bg-white/85 px-2 py-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur min-[560px]:bottom-6 min-[560px]:left-4 min-[560px]:right-auto min-[560px]:top-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="switch"
          aria-checked={showAvailability}
          onClick={() => onToggleAvailability(!showAvailability)}
          className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              showAvailability ? "bg-gold" : "bg-stone-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                showAvailability ? "left-4" : "left-0.5"
              }`}
            />
          </span>
          {t.toolbar.availability}
        </button>
      </div>
    </>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative grid h-9 w-9 place-items-center rounded-xl text-stone-600 transition hover:bg-stone-100 hover:text-ink sm:h-10 sm:w-10"
    >
      {children}
    </button>
  );
}
