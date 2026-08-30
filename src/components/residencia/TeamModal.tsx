"use client";

// Reusa el CSS scopeado `.res-landing` + la "hoja" `.sheet-*` (mismo chasis que
// ProjectModal): este modal se abre desde el SHOWROOM y desde la landing de unidad.
import "./residencia.css";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";
import { lockBodyScroll } from "@/lib/scroll-lock";

/* eslint-disable @next/next/no-img-element */

/**
 * "El Equipo" — modal propio del menú general: respaldo institucional. Los
 * `featured` van arriba en tarjetas grandes, el resto en tarjetas chicas debajo, y
 * los `solo` en su propia fila centrada al pie. Con logo donde hay archivo en
 * /public; si no, el nombre en texto. Los datos viven en t.team.members — hoy, los
 * tres desarrollos de TIER (Bravo, Avenue y Sinclair), todos con el mismo logotipo.
 */
export function TeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const featured = t.team.members.filter((m) => m.featured);
  // Espejo del brochure: destacados arriba, fila del medio, y los `solo`
  // (RE/MAX) en su propia fila centrada al pie.
  const rest = t.team.members.filter((m) => !m.featured && !m.solo);
  const solo = t.team.members.filter((m) => m.solo);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="res-landing sheet">
              <header className="sheet-head">
                <div>
                  <p className="sheet-eyebrow">{t.team.eyebrow}</p>
                  <h2 className="sheet-title">{t.team.title}</h2>
                </div>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label={t.team.close}
                  onClick={onClose}
                >
                  <CloseIcon width={22} height={22} />
                </button>
              </header>

              <div className="sheet-body">
                <div className="team-wrap">
                  <p className="team-intro">{t.team.intro}</p>

                  <div className="team-grid team-grid--featured">
                    {featured.map((m) => (
                      <TeamCard key={m.name} m={m} featured />
                    ))}
                  </div>

                  <div className="team-grid">
                    {rest.map((m) => (
                      <TeamCard key={m.name} m={m} />
                    ))}
                  </div>

                  {solo.length > 0 ? (
                    <div className="team-grid team-grid--solo">
                      {solo.map((m) => (
                        // `featured`: la tarjeta de RE/MAX va del MISMO tamaño que las
                        // destacadas (logo 56px, padding y nombre grandes) — pedido 21/07.
                        <TeamCard key={m.name} m={m} featured />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}

/** Tarjeta de un miembro: rol arriba (kicker), logo si hay archivo y el nombre
 *  siempre en texto (cuando hay logo, como caption chico debajo). */
function TeamCard({
  m,
  featured = false,
}: {
  m: { role: string; name: string; logo?: string };
  featured?: boolean;
}) {
  return (
    <div className={`team-card${featured ? " team-card--featured" : ""}`}>
      <p className="team-role">{m.role}</p>
      {m.logo ? (
        <>
          <img
            className={`team-logo${featured ? " team-logo--big" : ""}`}
            src={m.logo}
            alt={m.name}
          />
          <p className="team-name team-name--sub">{m.name}</p>
        </>
      ) : (
        <p className="team-name serif">{m.name}</p>
      )}
    </div>
  );
}
