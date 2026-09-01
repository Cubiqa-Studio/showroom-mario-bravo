import posthog from "posthog-js";
import { buildPostHogUrlOverride } from "@/lib/posthog-url-override";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!projectToken || !host) {
  if (process.env.NODE_ENV === "development") {
    const missingVariable = !projectToken
      ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
      : "NEXT_PUBLIC_POSTHOG_HOST";

    console.warn(
      `[posthog] falta ${missingVariable}: la analítica queda apagada en este entorno. Configurala en .env.local (y en el panel del host) para volver a registrar eventos.`,
    );
  }
} else {
  const urlOverride = buildPostHogUrlOverride();

  posthog.init(projectToken, {
    api_host: host,
    defaults: "2026-01-30",
    debug: process.env.NODE_ENV === "development",

    // Sitio anónimo, sin login: NADIE llama identify() y no hay a quién identificar.
    // Con `identified_only` los eventos van sin person profile y PostHog les deriva el
    // person_id del distinct_id, que es el MISMO para el $pageview y para los eventos
    // custom del mismo navegador: el embudo los une solo. Va explícito —es el default
    // de hoy— para que un cambio de default de la librería no mueva la identidad por
    // debajo, y para que quede escrito que llamar identify() acá sería un error
    // (encarece la ingesta y no linkea nada que no esté ya linkeado).
    person_profiles: "identified_only",

    // Sólo mandamos lo que alimenta el dashboard: $pageview, $pageleave y nuestros
    // eventos custom. Todo lo demás va apagado EXPLÍCITAMENTE (en false, no borrado):
    // estas opciones caen al toggle remoto del proyecto si quedan sin declarar.
    capture_exceptions: false,
    autocapture: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,

    session_recording: {
      maskAllInputs: true,
    },

    ...(urlOverride ? { before_send: urlOverride } : {}),
  });
}
