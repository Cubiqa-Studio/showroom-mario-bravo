"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { Vr360Modal } from "./Vr360Modal";
import { UnitFinderModal } from "./UnitFinderModal";
import { ProjectModal } from "../residencia/ProjectModal";
import { LocationModal } from "../residencia/LocationModal";
import { CaviahueModal } from "../residencia/CaviahueModal";
import { HAS_DESTINATION_MEDIA } from "../residencia/CaviahueCarousel";
import { AmenitiesModal } from "../residencia/AmenitiesModal";
import { TeamModal } from "../residencia/TeamModal";
import { ENTRANCE_HALL_360, AMENITIES_360 } from "@/lib/vr-hotspots";
import { getUnitToursByFloor } from "@/lib/unit-tours";
import { BROCHURE_URL } from "@/lib/contact";
import { SITE } from "@/data/site";
import { captureCta } from "@/lib/analytics";
import {
  AmenitiesIcon,
  BrochureIcon,
  BuildingIcon,
  ChevronDownIcon,
  CloseIcon,
  CompassIcon,
  GalleryIcon,
  GridIcon,
  HomeIcon,
  MasterplanIcon,
  MountainIcon,
  PhoneIcon,
  PinIcon,
  PolygonEditIcon,
  SearchIcon,
  TeamIcon,
} from "./icons";

// Unidades con tour 360° agrupadas por piso (desde units.json) — submenú "Unidades"
// dentro de "Tours". Estático (JSON horneado), se calcula una vez.
const UNIT_TOURS = getUnitToursByFloor();

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  /** Activa el modo disponibilidad (item "Disponibilidad"). */
  onSelectAvailability: () => void;
  /** Abre el Plan Maestro (modal de plantas). Sin esto, el item queda "Pronto". */
  onMasterplan?: () => void;
  /** Abre el formulario de contacto (→ WhatsApp). Sin esto, "Contacto" cae al
   *  link directo wa.me (fallback). */
  onContact?: () => void;
  /** Abre la galería (lightbox). Sin esto, el item queda "Pronto". */
  onGallery?: () => void;
  /** wa.me pre-cargado (item "Contacto"). */
  consultHref: string;
  /** Acceso discreto al editor de polígonos (admin). Sin él, no hay footer. */
  polygonEditorHref?: string;
  /** Item "Inicio". En el home alcanza con cerrar el menú (default); la landing
      de residencia pasa su "volver a la galería". */
  onHome?: () => void;
  /** z-index del portal. El default (z-40) sirve sobre el flyby; la landing en
      overlay (z-[100]) necesita uno mayor. */
  zClass?: string;
  /** Muestra el item "El Proyecto" (Amenities/Calidad/Equipo en un modal). Solo lo
      pasa el showroom; en la landing de unidad esas secciones no van en el menú. */
  showProjectSections?: boolean;
}

/**
 * Menú lateral del showroom (hamburguesa). Desliza desde la derecha sobre un
 * backdrop. Mantiene el "glass claro" del resto de la UI. "Disponibilidad" y
 * "Contacto" están cableados; el resto son placeholders ("Pronto") hasta que
 * existan sus páginas/secciones.
 */
export function SideMenu({
  open,
  onClose,
  onSelectAvailability,
  onMasterplan,
  onContact,
  onGallery,
  consultHref,
  polygonEditorHref,
  onHome,
  zClass = "z-40",
  showProjectSections = false,
}: SideMenuProps) {
  const [toursOpen, setToursOpen] = useState(false);
  // Submenú anidado "Unidades" (los 360° de cada unidad) dentro de "Tours".
  const [unitsOpen, setUnitsOpen] = useState(false);
  // Recorrido 360° abierto desde "Tours" (null = cerrado). El modal vive ACÁ —no en
  // el padre— para que el menú abra los tours igual en el home y en la landing de
  // residencia (que no monta su propio Vr360Modal).
  const [tourUrl, setTourUrl] = useState<string | null>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [caviahueOpen, setCaviahueOpen] = useState(false);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const { t } = useI18n();

  // Secciones de proyecto (Amenities, Calidad y Tecnología, El Equipo) que van
  // "aparte en el inicio" = acá, en el showroom (se sacaron del acordeón por unidad).
  const projectPanels = t.specs.panels.filter((p) => p.home);
  // Panel de amenities (body + listas) para el modal Amenities (kuula + specs).
  const amenitiesPanel =
    t.specs.panels.find((p) => p.id === "amenities") ?? null;

  // Copias locales: TS no arrastra el narrowing de un import `string | null` adentro
  // del callback del onClick, y sobre un const local sí.
  const hallTour = ENTRANCE_HALL_360;
  const amenitiesTour = AMENITIES_360;

  // Abrí el tour en el modal grande y cerrá el panel del menú detrás.
  const openTour = (url: string) => {
    setTourUrl(url);
    onClose();
  };

  // Cerrar con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <FloatingPortal>
        <AnimatePresence>
          {open && (
            <motion.div
              className={`fixed inset-0 ${zClass}`}
              initial={{ opacity: 0 }}
              // pointerEvents off al cerrar: si no, el backdrop —MIENTRAS se desvanece en
              // la exit animation— sigue capturando el puntero y se COME el primer hover
              // sobre una unidad (la 216 "breathe" no mostraba el tooltip hasta hoverear
              // otra). En `animate` va "auto" para restaurarlo si se reabre a mitad del
              // cierre. framer aplica pointerEvents al instante (valor no animable).
              animate={{ opacity: 1, pointerEvents: "auto" }}
              exit={{ opacity: 0, pointerEvents: "none" }}
            >
              {/* Backdrop — fondo sólido translúcido SIN blur: el backdrop-filter sobre
                el render gigante, recalculado en cada frame del slide, laguea todo. */}
              <button
                type="button"
                aria-label={t.sideMenu.close}
                onClick={onClose}
                className="absolute inset-0 h-full w-full cursor-default bg-black/70"
              />

              {/* Panel */}
              <motion.aside
                role="dialog"
                aria-label={t.sideMenu.menuPanel}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 38 }}
                className="absolute right-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-paper shadow-2xl ring-1 ring-line"
              >
                <header className="flex items-center justify-between px-5 py-4">
                  <div>
                    {/* Wordmark del proyecto, sin crédito del estudio arriba: el logo
                      de la desarrolladora queda sólo en "El Equipo". */}
                    <p className="font-serif text-2xl tracking-wide text-ink">
                      {SITE.brandName}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t.sideMenu.close}
                    onClick={onClose}
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-ink"
                  >
                    <CloseIcon width={20} height={20} />
                  </button>
                </header>

                <nav className="flex-1 overflow-y-auto px-3 pb-4">
                  <MenuButton
                    icon={<HomeIcon width={20} height={20} />}
                    onClick={() => {
                      onHome?.();
                      onClose();
                    }}
                  >
                    {t.sideMenu.home}
                  </MenuButton>

                  <MenuButton
                    icon={<MasterplanIcon width={20} height={20} />}
                    onClick={
                      onMasterplan
                        ? () => {
                            onMasterplan();
                            onClose();
                          }
                        : undefined
                    }
                    soon={!onMasterplan}
                  >
                    {t.sideMenu.masterplan}
                  </MenuButton>

                  <MenuButton
                    icon={<GridIcon width={20} height={20} />}
                    onClick={() => {
                      onSelectAvailability();
                      onClose();
                    }}
                  >
                    {t.sideMenu.availability}
                  </MenuButton>

                  {/* Galería (lightbox). Hoy con placeholders; los renders reales
                    entran por site.gallery. Sin onGallery, queda "Pronto". */}
                  <MenuButton
                    icon={<GalleryIcon width={20} height={20} />}
                    onClick={
                      onGallery
                        ? () => {
                            onGallery();
                            onClose();
                          }
                        : undefined
                    }
                    soon={!onGallery}
                  >
                    {t.sideMenu.gallery}
                  </MenuButton>

                  {/* El Proyecto (solo en el showroom): abre el modal con Amenities,
                    Calidad y Tecnología y El Equipo (secciones de proyecto). */}
                  {showProjectSections && projectPanels.length > 0 && (
                    <MenuButton
                      icon={<BuildingIcon width={20} height={20} />}
                      onClick={() => {
                        setProjectOpen(true);
                        onClose();
                      }}
                    >
                      {t.sideMenu.project}
                    </MenuButton>
                  )}

                  {/* Amenities (solo en el showroom): tour 360° de Kuula + TODAS las
                    especificaciones de amenities, en un modal. */}
                  {showProjectSections && (
                    <MenuButton
                      icon={<AmenitiesIcon width={20} height={20} />}
                      onClick={() => {
                        setAmenitiesOpen(true);
                        onClose();
                      }}
                    >
                      {t.sideMenu.amenities}
                    </MenuButton>
                  )}

                  {/* El Equipo (Miro 2026-07-15): respaldo institucional con logos,
                    en el menú general — mismo gate que El Proyecto/Amenities. */}
                  {showProjectSections && (
                    <MenuButton
                      icon={<TeamIcon width={20} height={20} />}
                      onClick={() => {
                        setTeamOpen(true);
                        onClose();
                      }}
                    >
                      {t.sideMenu.team}
                    </MenuButton>
                  )}

                  {/* Tours (desplegable) */}
                  <button
                    type="button"
                    onClick={() => setToursOpen((v) => !v)}
                    aria-expanded={toursOpen}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-white/10"
                  >
                    <span className="text-muted">
                      <CompassIcon width={20} height={20} />
                    </span>
                    <span className="flex-1 text-left">{t.sideMenu.tours}</span>
                    <motion.span
                      animate={{ rotate: toursOpen ? 180 : 0 }}
                      className="text-faint"
                    >
                      <ChevronDownIcon width={18} height={18} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {toursOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-4 border-l border-line pl-3">
                          {/* Hall y Amenities sólo si EXISTE el recorrido: TIER Bravo
                              todavía no tiene 360° de espacios comunes (ver
                              src/lib/vr-hotspots.ts). Sin gate, el item abriría un
                              modal vacío. */}
                          {hallTour && (
                            <SubItem onClick={() => openTour(hallTour)}>
                              {t.sideMenu.toursHall}
                            </SubItem>
                          )}
                          {amenitiesTour && (
                            <SubItem onClick={() => openTour(amenitiesTour)}>
                              {t.sideMenu.toursAmenities}
                            </SubItem>
                          )}

                          {/* Unidades (anidado): 360° de cada unidad, agrupadas por
                            piso. Sólo aparece si hay al menos una unidad con tour. */}
                          {UNIT_TOURS.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setUnitsOpen((v) => !v)}
                                aria-expanded={unitsOpen}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted transition hover:bg-white/10 hover:text-ink"
                              >
                                <span className="flex-1">
                                  {t.sideMenu.toursUnits}
                                </span>
                                <motion.span
                                  animate={{ rotate: unitsOpen ? 180 : 0 }}
                                  className="text-faint"
                                >
                                  <ChevronDownIcon width={16} height={16} />
                                </motion.span>
                              </button>
                              <AnimatePresence initial={false}>
                                {unitsOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="ml-3 border-l border-line pl-2.5">
                                      {UNIT_TOURS.map((group) => (
                                        <div
                                          key={group.floor}
                                          className="pt-1.5"
                                        >
                                          <p className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                                            {t.sideMenu.floor(group.floor)}
                                          </p>
                                          <div className="flex flex-wrap gap-1.5 px-1.5 pb-1.5">
                                            {group.units.map((u) => (
                                              <button
                                                key={u.id}
                                                type="button"
                                                onClick={() =>
                                                  openTour(u.url)
                                                }
                                                className="rounded-md px-2.5 py-1 text-xs font-medium tabular-nums text-muted ring-1 ring-line transition hover:bg-white/10 hover:text-ink hover:ring-gold/50"
                                              >
                                                {u.residence}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Brochure: PDF descargable. Abre/descarga el archivo de /public;
                    mismo item en showroom y en la landing. Se oculta mientras no haya
                    brochure cargado (BROCHURE_URL null) — un item que baja un 404 es
                    peor que no tener el item. */}
                  {BROCHURE_URL && (
                    <MenuLink
                      href={BROCHURE_URL}
                      icon={<BrochureIcon width={20} height={20} />}
                      onClick={() => {
                        captureCta("brochure", "side_menu");
                        onClose();
                      }}
                      download
                    >
                      {t.sideMenu.brochure}
                    </MenuLink>
                  )}

                  {/* Ubicación: en el showroom abre el mapa (el mismo de las landings);
                    en la landing de unidad queda "Pronto" (esa página ya tiene su mapa). */}
                  {showProjectSections ? (
                    <MenuButton
                      icon={<PinIcon width={20} height={20} />}
                      onClick={() => {
                        setLocationOpen(true);
                        onClose();
                      }}
                    >
                      {t.sideMenu.location}
                    </MenuButton>
                  ) : (
                    <MenuButton icon={<PinIcon width={20} height={20} />} soon>
                      {t.sideMenu.location}
                    </MenuButton>
                  )}

                  {/* Entorno / barrio: resalta los puntos más importantes de la zona.
                    Va junto a Ubicación y está disponible en el showroom y en la
                    landing. Se esconde mientras el cliente no entregue media del
                    barrio (ver HAS_DESTINATION_MEDIA en CaviahueCarousel). */}
                  {HAS_DESTINATION_MEDIA && (
                    <MenuButton
                      icon={<MountainIcon width={20} height={20} />}
                      onClick={() => {
                        setCaviahueOpen(true);
                        onClose();
                      }}
                    >
                      {t.sideMenu.caviahue}
                    </MenuButton>
                  )}

                  {/* Contacto: si hay `onContact` abre el formulario (que luego va a
                    WhatsApp) — pedido del cliente, no redirigir directo. Sin él,
                    cae al link wa.me (fallback). */}
                  {onContact ? (
                    <MenuButton
                      icon={<PhoneIcon width={20} height={20} />}
                      onClick={() => {
                        captureCta("contact_form", "side_menu");
                        onContact();
                        onClose();
                      }}
                    >
                      {t.sideMenu.contact}
                    </MenuButton>
                  ) : (
                    <MenuLink
                      href={consultHref}
                      icon={<PhoneIcon width={20} height={20} />}
                      onClick={onClose}
                    >
                      {t.sideMenu.contact}
                    </MenuLink>
                  )}

                  {/* Buscar unidades: abre el modal con la lista filtrable de las 44
                    residencias. Va debajo de "Contacto" y —al vivir en el menú
                    compartido— aparece tanto en el showroom como en la landing. */}
                  <MenuButton
                    icon={<SearchIcon width={20} height={20} />}
                    onClick={() => {
                      setFinderOpen(true);
                      onClose();
                    }}
                  >
                    {t.finder.open}
                  </MenuButton>
                </nav>

                {/* Acceso admin (discreto). Es un <a> PLANO a propósito, NO un <Link> de
                  Next: el <Link> prefetcheaba /admin/polygon-editor al abrir el menú, y
                  ese request cae en el Basic Auth de la middleware → al cliente le
                  aparecía el "Acceder" con sólo desplegar el sidebar. Con <a> no hay
                  prefetch: la clave se pide SÓLO al navegar de verdad a /admin/*. */}
                {polygonEditorHref && (
                  <footer className="border-t border-line px-3 py-3">
                    <a
                      href={polygonEditorHref}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-faint transition hover:bg-white/10 hover:text-ink"
                    >
                      <PolygonEditIcon width={16} height={16} />
                      {t.sideMenu.polygonEditor}
                    </a>
                  </footer>
                )}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
      </FloatingPortal>

      {/* Modal del tour 360° (sección "Tours"). Fuera del bloque `open` para que
        siga montado al cerrarse el menú. z-[160] = por encima del overlay de
        detalle (z-100) y del propio panel (z-[140] en residencia). */}
      <Vr360Modal
        src={tourUrl}
        onClose={() => setTourUrl(null)}
        zClass="z-[160]"
      />

      {/* "El Proyecto" — secciones de proyecto en el showroom (fuera del bloque
        `open` para seguir montado al cerrarse el menú). */}
      <ProjectModal
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        panels={projectPanels}
      />

      {/* "Amenities" (kuula + specs), "El Equipo" y "Ubicación" (mapa): sólo se abren
        desde el showroom/landing (gated por showProjectSections en los items). */}
      <AmenitiesModal
        open={amenitiesOpen}
        onClose={() => setAmenitiesOpen(false)}
        panel={amenitiesPanel}
      />
      <TeamModal open={teamOpen} onClose={() => setTeamOpen(false)} />
      <LocationModal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
      />
      <CaviahueModal
        open={caviahueOpen}
        onClose={() => setCaviahueOpen(false)}
      />

      {/* Buscador de unidades. Fuera del bloque `open` para seguir montado al cerrarse
        el menú. Sin `units`: se traen lazy de /api/unidades al abrir (funciona igual
        en el showroom y en la landing). */}
      <UnitFinderModal open={finderOpen} onClose={() => setFinderOpen(false)} />
    </>
  );
}

function MenuButton({
  icon,
  children,
  onClick,
  soon = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  soon?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      title={soon ? t.sideMenu.soonTitle : undefined}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-white/10"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-left">{children}</span>
      {soon && <SoonTag />}
    </button>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
  download = false,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  /** Fuerza descarga (ej.: el brochure PDF). Donde no se soporta, cae a abrir en pestaña. */
  download?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={download || undefined}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-white/10"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-left">{children}</span>
    </a>
  );
}

function SubItem({
  children,
  soon = false,
  onClick,
}: {
  children: React.ReactNode;
  soon?: boolean;
  onClick?: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      title={soon ? t.sideMenu.soonTitle : undefined}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted transition hover:bg-white/10 hover:text-ink"
    >
      <span className="flex-1">{children}</span>
      {soon && <SoonTag />}
    </button>
  );
}

function SoonTag() {
  const { t } = useI18n();
  return (
    <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-soft">
      {t.sideMenu.soon}
    </span>
  );
}
