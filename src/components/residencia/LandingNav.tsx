"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { SiteConfig, Unit } from "@/lib/types";
import { whatsappUrl } from "@/lib/contact";
import { useI18n } from "@/i18n/LanguageProvider";
import { SideMenu } from "../gallery/SideMenu";
import { UnitFinderModal } from "../gallery/UnitFinderModal";
import { SearchIcon } from "../gallery/icons";
import { AvanceBadge } from "../AvanceBadge";
import { MasterplanModal } from "./MasterplanModal";
import { ContactModal } from "./ContactModal";
import { GalleryModal } from "./GalleryModal";
import { scrollToContact, toggleFullscreen } from "./landing-dom";

/**
 * Navbar fija de la landing: logo (imagen, el mismo del home), pill de la unidad
 * actual, pantalla completa, "Consultar" y la hamburguesa que abre el SideMenu
 * compartido con el home. Desde el menú, "Inicio"/"Disponibilidad" vuelven a la
 * galería: en overlay disparan onClose (router.back → zoom-out del home), en
 * standalone navegan a "/".
 */
export function LandingNav({
  site,
  unit,
  onClose,
}: {
  site: SiteConfig;
  unit: Unit;
  onClose?: () => void;
}) {
  const brand = site.brandName ?? site.projectName;
  const navRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [masterplanOpen, setMasterplanOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  // Volver a la galería (items "Inicio"/"Disponibilidad" del menú): en overlay
  // cierra el detalle; standalone scrollea al tope ANTES de navegar al exterior,
  // así no asoma por un frame la planta/tipología en la que estabas.
  const goHome = () => {
    if (onClose) {
      onClose();
      return;
    }
    window.scrollTo({ top: 0 });
    router.push("/showroom"); // "Inicio"/galería = el showroom (la raíz "/" es la intro)
  };

  // Los controles "volver" son <a href="/showroom"> DE VERDAD (SEO: sin esto la
  // landing no tiene ningún link crawleable de salida y queda como dead-end; el
  // BreadcrumbList del JSON-LD promete esa jerarquía). El click normal se
  // intercepta para conservar la UX actual (overlay → onClose con zoom-out;
  // standalone → push); ctrl/cmd/middle-click y los crawlers usan el href real.
  const backClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    e.preventDefault();
    goHome();
  };

  // Sólo en unidades con tour 360°: el nav arranca transparente (sobre el visor) y
  // se vuelve sólido cuando el hero deja de estar detrás del nav (scroll hacia abajo).
  const [overHero, setOverHero] = useState(!!unit.tour360);
  // Depende de `unit.residence` además de `tour360`: al SALTAR entre unidades por el
  // plano (router.replace, sin remontar el nav), el estado no se reinicia solo y el
  // nav quedaba con fondo blanco sobre el 360. Acá, al entrar a una unidad con tour,
  // arrancamos en ghost (estás arriba) y reenganchamos el observer al hero NUEVO
  // (que puede no estar montado en el mismo frame → reintento con rAF).
  useEffect(() => {
    if (!unit.tour360) {
      setOverHero(false);
      return;
    }
    setOverHero(true);
    let io: IntersectionObserver | null = null;
    let raf = 0;
    let tries = 0;
    const attach = () => {
      // Buscá el hero DE ESTA landing, no un querySelector GLOBAL: durante el crossfade
      // entre unidades conviven dos `.res-landing` en el DOM (la que sale y la que entra),
      // y un `document.querySelector(".hero")` agarra la PRIMERA = la unidad anterior, que
      // ya se está desmontando → el observer queda pegado a un nodo huérfano que reporta
      // "fuera de vista" para siempre → nav-ghost trabado en blanco sobre el 360. Scopeando
      // al `.res-landing` propio (vía el ref del nav) siempre observamos NUESTRO hero.
      const hero = navRef.current
        ?.closest(".res-landing")
        ?.querySelector(".hero");
      if (!hero) {
        if (tries++ < 20) raf = requestAnimationFrame(attach);
        return;
      }
      io = new IntersectionObserver(([e]) => setOverHero(e.isIntersecting), {
        rootMargin: "-78px 0px 0px 0px", // alto del nav: dispara cuando el hero cruza debajo del nav
        threshold: 0,
      });
      io.observe(hero);
    };
    attach();
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [unit.tour360, unit.residence]);
  const ghost = !!unit.tour360 && overHero;

  return (
    <>
      <nav ref={navRef} className={`nav${ghost ? " nav--ghost" : ""}`}>
        <div className="nav-inner">
          <div className="nav-left">
            {/* Volver al exterior (SÓLO mobile): flecha compacta → showroom. En desktop
              se usan el logo + el pill "Volver" (abajo), que en celu están ocultos. */}
            <a
              href="/showroom"
              className="nav-back-mobile"
              aria-label={t.nav.back}
              title={t.nav.back}
              onClick={backClick}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
            </a>
            {/* Click en el logo → SIEMPRE al inicio (la galería/showroom), igual que el
              pill "Volver": en overlay cierra el detalle, en standalone navega. */}
            <a
              href="/showroom"
              className="logo"
              aria-label={t.nav.home}
              title={t.nav.home}
              onClick={backClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt={brand} />
            </a>

            <div className="nav-pills">
              <a
                href="/showroom"
                className="pill pill-back"
                onClick={backClick}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M19 12H5M11 18l-6-6 6-6" />
                </svg>
                {t.nav.back}
              </a>
              <span className="pill active">
                {t.common.residence(unit.residence)}
              </span>
            </div>
          </div>

          <div className="nav-right">
            {/* Lupa del buscador de unidades (a la izquierda del avance). En mobile la
              regla `.nav-right .icon-btn { display:none }` la oculta — ahí se accede
              desde el item "Buscar unidades" del menú lateral. */}
            <button
              type="button"
              className="icon-btn finder-lupa"
              title={t.finder.open}
              aria-label={t.finder.open}
              onClick={() => {
                setFinderOpen(true);
              }}
            >
              <span className="finder-sonar-ring" aria-hidden />
              <SearchIcon className="finder-lupa-glyph" />
            </button>
            {/* Avance de obra (badge compacto, abre el modal). Oculto si no hay dato. */}
            <AvanceBadge />
            {/* Switch de idioma (pedido del cliente: ES preseleccionado). */}
            <div
              className="lang-switch"
              role="group"
              aria-label="Idioma / Language"
            >
              {(["es", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`lang-opt${lang === l ? " active" : ""}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="icon-btn"
              title={t.nav.fullscreen}
              aria-label={t.nav.fullscreen}
              onClick={toggleFullscreen}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
              </svg>
            </button>
            {/* Vibración idéntica a la del toolbar del home (ShowroomToolbar):
              ráfaga corta por las 4 diagonales + descanso, en loop; frena en hover. */}
            <motion.button
              type="button"
              className="btn btn-gold consult-buzz"
              onClick={scrollToContact}
              // initial="rest" (≠ animate) para que el loop arranque YA al montar.
              // Si initial == animate ("buzz"), framer cree que no hay cambio y la
              // vibración recién se dispara tras el primer hover→unhover.
              initial="rest"
              animate="buzz"
              whileHover="rest"
              variants={{
                buzz: {
                  x: [0, -2.8, 3.4, 3, -3.4, -1.8, 2.3, 0],
                  y: [0, -2.8, -3, 3, 2.8, -1.8, 1.8, 0],
                  rotate: [0, -1.8, 1.8, 1.4, -1.8, -0.9, 1, 0],
                  transition: {
                    duration: 0.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1.5,
                  },
                },
                rest: {
                  x: 0,
                  y: 0,
                  rotate: 0,
                  transition: { duration: 0.3, ease: "easeOut" },
                },
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="btn-label">{t.nav.consult}</span>
            </motion.button>
            <button
              type="button"
              className="icon-btn nav-menu-btn"
              title={t.nav.menu}
              aria-label={t.nav.menu}
              onClick={() => setMenuOpen(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mismo menú lateral del home. Va por encima del overlay de detalle (z-[100]). */}
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onHome={goHome}
        onSelectAvailability={goHome}
        onMasterplan={() => setMasterplanOpen(true)}
        onContact={() => setContactOpen(true)}
        onGallery={() => setGalleryOpen(true)}
        consultHref={whatsappUrl(t.wa.general)}
        zClass="z-[140]"
        // Pedido de Camila (2026-06-30): que la landing tenga los mismos items que el
        // inicio — "El Proyecto" y "Amenities" (y "Ubicación" abre el mapa, no "Pronto").
        showProjectSections
      />

      <MasterplanModal
        open={masterplanOpen}
        onClose={() => setMasterplanOpen(false)}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <GalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      {/* Buscador de unidades (lupa del nav). Sin `units`: se traen lazy de /api/unidades. */}
      <UnitFinderModal open={finderOpen} onClose={() => setFinderOpen(false)} />
    </>
  );
}
