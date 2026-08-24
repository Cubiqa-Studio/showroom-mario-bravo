import posthog from "posthog-js";

/**
 * Llamadas a la acción del sitio, en UN solo evento (`cta_clicked`) para poder
 * compararlas entre sí en un mismo insight. Los valores van tipados a propósito: que
 * cada punto de llamada invente su propia cadena es lo que vuelve inservible un
 * breakdown (pasó con `tour_kind`, que significaba una cosa en la bolita 360° y otra
 * en el menú).
 *
 * `tour_360` queda declarado pero hoy no lo dispara nadie: el recorrido 360° se abre
 * igual desde el menú y desde la bolita del render, sólo que sin registrarse. El valor
 * se mantiene en el tipo para poder volver a medirlo sin rehacer el vocabulario.
 *
 * Nada de PII: sólo qué CTA y desde qué superficie. Importa en WhatsApp, donde el
 * href lleva los datos del lead y por eso los <a> del ContactModal están marcados con
 * `ph-no-capture` (autocapture no los ve; este evento sí los cuenta, sin filtrarlos).
 */
export type Cta = "whatsapp" | "contact_form" | "brochure" | "tour_360";

/** Superficie desde la que se tocó el CTA. Mismo vocabulario que `entry_point`. */
export type CtaLocation =
  | "showroom_toolbar"
  | "showroom_hotspot"
  | "side_menu"
  | "residence_plan"
  | "residence_contact_section"
  | "sidebar_contact_modal";

export function captureCta(cta: Cta, location: CtaLocation) {
  posthog.capture("cta_clicked", { cta, location });
}

const UNIT_SELECTED_KEY = "ph_unit_selected";

function readSeenUnits(sessionId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(UNIT_SELECTED_KEY);
    if (!raw) return new Set();
    const stored = JSON.parse(raw) as { sid?: string; units?: string[] };
    if (stored.sid !== sessionId) return new Set();
    return new Set(stored.units ?? []);
  } catch {
    return new Set();
  }
}

function writeSeenUnits(sessionId: string, units: Set<string>) {
  try {
    window.localStorage.setItem(
      UNIT_SELECTED_KEY,
      JSON.stringify({ sid: sessionId, units: [...units] }),
    );
  } catch {
    return;
  }
}

export function captureUnitSelected(unitId: string, location: CtaLocation) {
  const sessionId =
    typeof window === "undefined" ? "" : posthog.get_session_id();

  if (!sessionId) {
    posthog.capture("unit_selected", { unitId, location });
    return;
  }

  const seen = readSeenUnits(sessionId);
  if (seen.has(unitId)) return;

  seen.add(unitId);
  writeSeenUnits(sessionId, seen);
  posthog.capture("unit_selected", { unitId, location });
}

export function captureContactFormSubmitted(location: CtaLocation) {
  posthog.capture("contact_form_submitted", { location });
}
