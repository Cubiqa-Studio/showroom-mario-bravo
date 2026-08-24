import type { BeforeSendFn, CaptureResult } from "posthog-js";

/**
 * Reemplaza el origen local por uno de prueba en las propiedades de URL que viajan a
 * PostHog. En local los eventos salen con `localhost:3000`, que el controller rechaza;
 * con esto salen como `https://test.<proyecto>.kuvus.app` y las pruebas de cada
 * showroom quedan aisladas entre sí.
 *
 * Para llevarlo a otro front alcanza con copiar este archivo y cambiar el valor de
 * `NEXT_PUBLIC_POSTHOG_MOCK_URL`: acá no hay nada propio del proyecto.
 */

/**
 * PostHog manda la URL repartida en tres familias: la del evento, la `$initial_*` que
 * queda pegada a la persona y la `$session_entry_*` que congela la entrada a la sesión.
 * Hay que tocar las tres o el origen local igual se filtra por alguna. Ojo con
 * `$session_entry_url`: PostHog le cambia el nombre a `$current_url` al derivarla.
 *
 * `$pathname` y sus variantes no llevan origen, así que quedan como están. Tampoco se
 * toca `$lib_custom_api_host`, que es el endpoint de ingesta y no una URL de página.
 */

/** Valor = URL completa; se reemplaza el prefijo del origen local. */
const URL_PROPS = [
  "$current_url",
  "$initial_current_url",
  "$session_entry_url",
  "$referrer",
  "$initial_referrer",
  "$session_entry_referrer",
];

/** Valor = `host:puerto` a secas; se reemplaza entero. */
const HOST_PROPS = [
  "$host",
  "$initial_host",
  "$session_entry_host",
  "$referring_domain",
  "$initial_referring_domain",
  "$session_entry_referring_domain",
];

function rewrite(
  bag: Record<string, unknown> | undefined,
  localOrigin: string,
  localHost: string,
  mockOrigin: string,
  mockHost: string,
) {
  if (!bag) return;

  for (const key of URL_PROPS) {
    const value = bag[key];
    if (typeof value === "string" && value.startsWith(localOrigin)) {
      bag[key] = mockOrigin + value.slice(localOrigin.length);
    }
  }

  for (const key of HOST_PROPS) {
    if (bag[key] === localHost) bag[key] = mockHost;
  }
}

/**
 * Devuelve el hook de `before_send` cuando el override corresponde, o `null` cuando no.
 * Sólo devuelve algo con `NODE_ENV === "development"`, o sea nunca en un build
 * desplegado: Next reemplaza esa comparación en tiempo de compilación y la rama entera
 * desaparece del bundle de producción aunque la variable esté cargada en el host.
 */
export function buildPostHogUrlOverride(): BeforeSendFn | null {
  if (process.env.NODE_ENV !== "development") return null;

  const mockUrl = process.env.NEXT_PUBLIC_POSTHOG_MOCK_URL;
  if (!mockUrl) return null;

  let mockOrigin: string;
  try {
    mockOrigin = new URL(mockUrl).origin;
  } catch {
    console.warn(
      `[posthog] NEXT_PUBLIC_POSTHOG_MOCK_URL no es una URL válida ("${mockUrl}"): los eventos salen con la URL real. Formato esperado: https://test.nombre-de-proyecto.kuvus.app`,
    );
    return null;
  }

  const localOrigin = window.location.origin;
  const localHost = window.location.host;
  const mockHost = new URL(mockOrigin).host;

  console.info(
    `[posthog] override de URL activo: los eventos de este entorno salen como ${mockOrigin} en lugar de ${localOrigin}.`,
  );

  return (result: CaptureResult | null) => {
    if (!result) return result;

    rewrite(result.properties, localOrigin, localHost, mockOrigin, mockHost);
    rewrite(result.$set, localOrigin, localHost, mockOrigin, mockHost);
    rewrite(result.$set_once, localOrigin, localHost, mockOrigin, mockHost);

    return result;
  };
}
