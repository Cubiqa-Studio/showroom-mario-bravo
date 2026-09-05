"use client";

import { useCallback, useState } from "react";
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
import { VolverAPortada } from "./VolverAPortada";
import { useFullscreen } from "../useFullscreen";

interface ShowroomToolbarProps {
  /** Pintar todas las unidades por estado (switch "Disponibilidad"). */
  showAvailability: boolean;
  onToggleAvailability: (v: boolean) => void;
  /** wa.me con el mensaje pre-cargado para "Consultar ahora". */
  consultHref: string;
  /** Abre el menú lateral (hamburguesa). */
  onOpenMenu: () => void;
  /** Lockup de marca. En TELÉFONOS viaja DENTRO de esta barra (fila única
   *  logo-izquierda / acciones-derecha); de 560px para arriba lo pinta el
   *  FlybyViewer arriba a la izquierda y acá no se muestra. */
  branding?: React.ReactNode;
  /** Vuelve a la primera vista (el logo es clickeable). */
  onBrandingClick?: () => void;
  brandingLabel?: string;
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
  branding,
  onBrandingClick,
  brandingLabel,
}: ShowroomToolbarProps) {
  const { disponible: puedeFullscreen, activo: isFullscreen, alternar: toggle } = useFullscreen();
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
      {/* Barra 1 — acciones.
          ≥560px: pastilla suelta arriba a la derecha (el logo lo pinta el visor
          arriba a la izquierda), tal cual la aprobó el cliente.
          <560px: FILA COMPLETA de borde a borde — logo a la izquierda, acciones a
          la derecha. Antes el logo vivía en una tercera banda a 84px y la barra,
          con la tipografía de escritorio, entraba en DOS líneas: entre las tres
          bandas se comían 168px de render (reporte de Joaquim, 29-08: "quedaron
          GIGANTES y tapan DEMASIADA IMAGEN, además de que no está centrado").
          Con los márgenes simétricos (left-3/right-3) la barra deja de quedar
          corrida contra el borde derecho. */}
      <div
        className="absolute left-3 right-3 top-3 z-30 flex items-center justify-between gap-2 min-[560px]:left-auto min-[560px]:right-4 min-[560px]:top-4"
        // No dejes que un click en la barra dispare el drag del flyby.
        onPointerDown={(e) => e.stopPropagation()}
      >
        {branding && (
          <button
            type="button"
            onClick={onBrandingClick}
            aria-label={brandingLabel}
            title={brandingLabel}
            className="block min-w-0 shrink cursor-pointer transition active:scale-95 min-[560px]:hidden"
          >
            {branding}
          </button>
        )}

        <div className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-tier-dark/80 p-1 shadow-lg ring-1 ring-line backdrop-blur min-[560px]:gap-1 sm:gap-1.5 sm:p-1.5">
          <motion.a
            href={consultHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => captureCta("whatsapp", "showroom_toolbar")}
            className="group relative inline-flex items-center overflow-hidden rounded-xl bg-gold px-2.5 py-2.5 text-xs font-semibold tracking-wide text-cream shadow-sm transition-colors hover:bg-gold-soft min-[401px]:px-3 sm:px-3.5 sm:py-2 sm:text-sm"
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
            <span className="relative z-10 inline-flex items-center gap-1.5 sm:gap-2">
              <PhoneIcon width={18} height={18} />
              {/* El rótulo se acorta en dos escalones para que la fila (logo +
                  acciones) entre SIEMPRE en una línea: hasta 400px sólo el ícono
                  —el dorado ya lee como "llamar", y es lo mismo que hace la navbar
                  de la landing—, hasta 480px "Consultar", y de ahí el texto completo. */}
              <span className="hidden min-[401px]:inline min-[481px]:hidden">
                {t.toolbar.consultShort}
              </span>
              <span className="hidden min-[481px]:inline">{t.toolbar.consultNow}</span>
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
                className={`inline-flex min-h-9 items-center rounded-full px-2 uppercase transition min-[401px]:px-2.5 ${
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

          {/* Pantalla completa: se dibuja SÓLO si el navegador puede hacerlo.
              Antes el filtro era por ANCHO (`min-[560px]`), suponiendo que abajo de
              eso hay teléfonos y arriba no. Un iPhone ACOSTADO mide más de 560, así
              que el botón aparecía y no hacía nada — iOS no tiene fullscreen de
              elementos en ningún ancho (reporte de Juani, 03-09). Preguntando por la
              capacidad en vez de por el tamaño, el botón está donde funciona
              (escritorio, Android, iPad) y no está donde no. */}
          {puedeFullscreen && (
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
          )}

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
              className="pointer-events-none absolute right-2 top-full z-50 mt-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-tier-dark shadow-lg"
            >
              {t.toolbar.linkCopied}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Barra 2 — disponibilidad. Desktop: abajo a la izquierda. Mobile: segunda
          (y última) banda, a la IZQUIERDA — la lupa y el avance ocupan la derecha de
          esa misma fila, así las tres cosas comparten un solo renglón en vez de
          apilarse en dos. Abajo-izq en celular no sirve: pisa las flechas. */}
      <div
        // `h-10` fija el alto de la banda en teléfonos para que quede alineada al
        // píxel con la fila de la lupa/avance (que vive en FlybyViewer y no puede
        // compartir contenedor: en escritorio cada una va a una esquina distinta).
        className="absolute left-3 top-[66px] z-30 flex h-10 items-center gap-2 rounded-2xl bg-tier-dark/80 px-1.5 shadow-lg ring-1 ring-line backdrop-blur min-[560px]:bottom-6 min-[560px]:left-4 min-[560px]:h-auto min-[560px]:px-2 min-[560px]:py-1.5 min-[560px]:top-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Salida a la portada de TIER, SÓLO en teléfono: de 560 para arriba va al
            lado del logotipo (la pinta el FlybyViewer). Acá comparte la pastilla con
            el switch, separada por la misma hairline que usa la barra de acciones —
            así no suma un elemento flotante más.
            Debajo de 341px se esconde: a 320 quedan 32px libres en este renglón y no
            entra sin empujar el "Avance de obra". Ahí la salida es el item del menú. */}
        <span className="hidden items-center gap-1.5 min-[341px]:flex min-[560px]:hidden">
          <VolverAPortada className="h-8 w-8" />
          <span className="h-5 w-px bg-line" />
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showAvailability}
          onClick={() => onToggleAvailability(!showAvailability)}
          className="inline-flex h-full items-center gap-2 rounded-xl px-1.5 text-xs font-medium text-ink transition hover:bg-white/10 min-[560px]:h-auto min-[560px]:px-2 min-[560px]:py-1 min-[560px]:text-sm"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              showAvailability ? "bg-gold" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink shadow transition-all ${
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
      // 40px de ALTO (no 36) en teléfonos: el objetivo táctil sube sin gastar ancho,
      // que es el recurso escaso en esta fila. El público del proyecto es grande y
      // con la vista cansada — el mismo motivo por el que el cliente pidió más letra.
      className="relative grid h-10 w-9 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-ink sm:h-10 sm:w-10"
    >
      {children}
    </button>
  );
}
