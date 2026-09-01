import posthog from "posthog-js";
import type { Origen } from "./origen";

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
 *
 * El contrato completo de eventos (nombres, propiedades y valores válidos) vive en
 * ANALYTICS.md, en la raíz del repo. Si cambiás algo acá, actualizalo ahí: el dashboard
 * de PostHog se arma contra ESOS nombres y un rename silencioso lo deja en cero.
 */
export type Cta = "whatsapp" | "contact_form" | "brochure" | "tour_360";

/** Superficie desde la que se tocó el CTA. */
export type CtaLocation =
  | "showroom_toolbar"
  | "showroom_hotspot"
  | "side_menu"
  | "residence_plan"
  | "residence_nav"
  | "residence_contact_section"
  | "sidebar_contact_modal";

export function captureCta(cta: Cta, location: CtaLocation) {
  // `send_instantly` + beacon: un CTA es lo ÚLTIMO que pasa en la página (WhatsApp y el
  // brochure abren otra pestaña; en mobile eso es un cambio de app). Por defecto el
  // evento espera en la cola batcheada hasta ~3s, y si el navegador se va a background
  // antes del flush se pierde. Con beacon sale en el acto y sobrevive al cambio de app.
  posthog.capture(
    "cta_clicked",
    { cta, location },
    { transport: "sendBeacon", send_instantly: true },
  );
}

/**
 * Superficie por la que se llegó a la ficha de una unidad. `direct` = se entró sin pasar
 * por un disparador nuestro: link compartido, resultado de Google, F5 sobre la ficha.
 */
export type UnitEntryPoint =
  | "showroom_polygon"
  | "showroom_tooltip"
  | "unit_finder"
  | "masterplan"
  | "floor_plate"
  | "other_residences"
  | "direct";

/**
 * `unit_selected` lo emite el DESTINO (ResidenciaLanding), no el disparador: es el único
 * punto por el que pasan los 8 caminos que abren una ficha —y el único que ve la entrada
 * directa, que ningún disparador puede ver—. El origen viaja aparte, en sessionStorage:
 * el disparador lo marca justo antes de navegar y el destino lo consume al montar.
 *
 * sessionStorage y no un ref de módulo porque la ficha standalone es un page load duro
 * (SSG): un ref no sobrevive. Si el storage está bloqueado (modo privado), el evento
 * igual sale, con `location: "direct"`.
 */
const ENTRY_KEY = "ph_unit_entry";
/** Ventana de validez del marcador: una navegación client-side tarda ms, no segundos. */
const ENTRY_TTL_MS = 10_000;

export function markUnitEntryPoint(entry: UnitEntryPoint, unitId: string) {
  try {
    window.sessionStorage.setItem(
      ENTRY_KEY,
      JSON.stringify({ entry, unitId, ts: Date.now() }),
    );
  } catch {
    return;
  }
}

/**
 * Lee el marcador y lo BORRA siempre (aunque no sirva): una navegación abortada —el
 * guard `navigatingId` del buscador, un push que no llega— dejaría un huérfano que le
 * mentiría a la próxima unidad. Por eso además exige que el `unitId` coincida y que el
 * marcador sea fresco; ante cualquier duda cae a `direct`, que subcuenta pero no atribuye
 * a la superficie equivocada.
 */
function consumeUnitEntryPoint(unitId: string): UnitEntryPoint {
  try {
    const raw = window.sessionStorage.getItem(ENTRY_KEY);
    window.sessionStorage.removeItem(ENTRY_KEY);
    if (!raw) return "direct";
    const mark = JSON.parse(raw) as {
      entry?: UnitEntryPoint;
      unitId?: string;
      ts?: number;
    };
    if (mark.unitId !== unitId) return "direct";
    if (typeof mark.ts !== "number" || Date.now() - mark.ts > ENTRY_TTL_MS) {
      return "direct";
    }
    return mark.entry ?? "direct";
  } catch {
    return "direct";
  }
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

/** Una unidad abierta = un evento, una sola vez por unidad en cada sesión de PostHog. */
export function captureUnitSelected(unitId: string) {
  const location = consumeUnitEntryPoint(unitId);
  // Devuelve "" si PostHog no inicializó (build sin env vars): no rompe, sólo no dedupea.
  const sessionId =
    typeof window === "undefined" ? "" : posthog.get_session_id();

  if (!sessionId) {
    posthog.capture("unit_selected", { unitId, location });
    return;
  }

  const seen = readSeenUnits(sessionId);
  if (seen.has(unitId)) return;

  // Capturar ANTES de marcar: al revés, un capture que falla dejaba la unidad marcada
  // como vista y el evento no volvía a intentarse en toda la sesión.
  posthog.capture("unit_selected", { unitId, location });
  seen.add(unitId);
  writeSeenUnits(sessionId, seen);
}

/**
 * Se dispara con el SUBMIT, no con la respuesta de /api/contact: el último paso del
 * embudo no puede depender de la salud de Resend (si falta la API key el endpoint tira
 * 500 y el lead —que el usuario sí mandó— no se registraba en ningún lado).
 *
 * `unitId` sólo lo manda el form de la ficha. `origen` es PROPIO de este showroom (ver
 * src/lib/origen.ts): por el link de quién entró la visita —desarrolladora o
 * inmobiliaria—, para ver qué campaña convierte. Es una propiedad de más sobre el mismo
 * evento, no un rename: un insight que no la filtre sigue contando todo igual.
 */
export function captureContactFormSubmitted(
  location: CtaLocation,
  extra?: { unitId?: string; origen?: Origen },
) {
  posthog.capture("contact_form_submitted", {
    location,
    ...(extra?.unitId ? { unitId: extra.unitId } : {}),
    ...(extra?.origen ? { origen: extra.origen } : {}),
  });
}
