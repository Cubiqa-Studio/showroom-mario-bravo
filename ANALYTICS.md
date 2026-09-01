# Analítica — contrato de eventos (PostHog)

Fuente única de verdad: [`src/lib/analytics.ts`](src/lib/analytics.ts) (los eventos) y
[`instrumentation-client.ts`](instrumentation-client.ts) (el init). **Este archivo es el
contrato con el dashboard.** Un rename acá deja los pasos del embudo en **cero, sin error
visible**. Si cambiás un nombre o una propiedad, actualizá este doc y avisale a quien
mantiene el dashboard.

Es el MISMO contrato que el de Caviahue (`showroom-caviahue/ANALYTICS.md`), a propósito:
los dos showrooms mandan al mismo proyecto de PostHog y se separan por `$host`, así que
los insights se arman una vez y sirven para los dos. La única diferencia está marcada
abajo: la propiedad `origen`, que acá existe y allá no.

## Lo que se manda

Automático (de la librería): **`$pageview`** y **`$pageleave`**. Con
`capture_pageview: "history_change"` cada `router.push` emite su pageview, así que las
rutas del SPA (`/` → `/showroom` → `/residencia/:id`) quedan cubiertas.

Apagado a propósito y en `false` explícito: autocapture, heatmaps, dead clicks, web
vitals, error tracking. **No se re-activan**: el ruido de un evento por click es lo que
hizo inservible el dashboard de Caviahue la primera vez.

### Eventos custom (son 3, no hay más)

| evento | cuándo | propiedades |
|---|---|---|
| `unit_selected` | se **abre la ficha** de una unidad, por el camino que sea | `unitId` (ej. `"402"`), `location` (origen, ver abajo) |
| `cta_clicked` | se toca una llamada a la acción | `cta`, `location` |
| `contact_form_submitted` | se **envía** un formulario (no cuando responde el mail) | `location`, `unitId` (sólo el form de la ficha), `origen` |

**`unit_selected.location`** — por dónde entró a la ficha:
`showroom_polygon` (click en el polígono del render, camino principal en desktop) ·
`showroom_tooltip` (tap en la tarjeta flotante, camino principal en mobile) ·
`unit_finder` (buscador de la lupa) · `masterplan` (Plan Maestro) ·
`floor_plate` (pestaña "Planta del piso") · `other_residences` ("Otras residencias") ·
`direct` (sin paso previo: Google, link compartido, F5 sobre la ficha).

**`cta_clicked.cta`**: `whatsapp` · `contact_form` · `brochure` · `tour_360` (declarado,
**hoy no lo dispara nadie**. No lo pongas como paso de un embudo).
**`cta_clicked.location`**: `showroom_toolbar` · `showroom_hotspot` · `side_menu` ·
`residence_plan` · `residence_nav` · `residence_contact_section` · `sidebar_contact_modal`.

### `origen` — lo propio de este showroom

`contact_form_submitted` suma **`origen`**: `desarrolladora` (default) o `inmobiliaria`,
según el link por el que entró la visita (`?v=inmobiliaria`, ver
[`src/lib/origen.ts`](src/lib/origen.ts) y el README § *Dos comercializadores, un
formulario*). Sirve para ver qué campaña convierte.

Dos límites que conviene tener presentes:

- Va **sólo en el último evento**, así que da conversiones por comercializador, **no**
  una tasa de conversión: los pasos de arriba del embudo (`$pageview`, `unit_selected`)
  no llevan la propiedad y no se pueden partir por ella. Si algún día hace falta la tasa,
  lo que corresponde es registrarla como *super property* (`posthog.register`) en el
  `OrigenProvider` — no agregarla a mano evento por evento.
- Es **atribución, no seguridad**: el parámetro está a la vista y cualquiera lo cambia.

Un insight que no filtre por `origen` cuenta todo igual: es una propiedad de más sobre el
mismo evento, no un rename.

### Dos reglas que hay que tener en la cabeza

1. **`unit_selected` lo emite el DESTINO**, no el botón: lo dispara `ResidenciaLanding`
   al montar, que es el único componente por el que pasan los 6 disparadores (y el único
   que ve la entrada directa). Los disparadores sólo dejan marcado el origen en
   `sessionStorage` justo antes de navegar.
2. **Se dedupea por unidad dentro de la sesión de PostHog.** O sea: `unit_selected` mide
   *unidades distintas abiertas por sesión*. Volver a la misma unidad no vuelve a
   disparar → **nunca va a cuadrar 1:1 con los `$pageview` de `/residencia/*`**, y está
   bien que no cuadre.

## Identidad: es un sitio anónimo, y está bien así

No hay login, así que **nadie llama `identify()`** y `person_profiles` queda en
`identified_only` (explícito en el init). Los eventos salen con
`$process_person_profile: false`: PostHog no crea perfil de persona, pero **sí** les
deriva un `person_id` determinístico a partir del `distinct_id`. Como el `$pageview` y
los eventos custom del mismo navegador comparten `distinct_id`, **el embudo los une
solo**. Agregar `identify()` no linkearía nada que no esté linkeado y encarece la ingesta.

Consecuencias para el dashboard:

- **No uses person properties, cohortes ni breakdowns de persona** en ningún paso: con
  eventos anónimos eso vacía el paso en silencio. Todo sobre propiedades de **evento**
  (`$current_url`, `$host`, `$pathname`, `cta`, `location`, `unitId`, `origen`).
- **Ojo con "Filter out internal and test users"** si el filtro del proyecto es una
  cohorte o una person property: puede borrar también a los usuarios anónimos, o sea a
  todo el tráfico real. Probá el embudo con y sin ese toggle.
- "Unique users" acá = **navegador único**. No hay dedup entre dispositivos.

## El embudo canónico

1. `$pageview` con `$pathname = /showroom` — entró al showroom
2. `unit_selected` — abrió una unidad
3. `contact_form_submitted` **o** `cta_clicked` con `cta = whatsapp` — convirtió

El paso 3 tiene que aceptar los dos eventos: WhatsApp es la conversión real del proyecto
y un embudo que sólo termina en el formulario subcuenta por diseño.

⚠ El paso 1 arranca en `/showroom`, no en `/`: `/` es la **portada** con los tres
desarrollos de TIER, y desde ahí se entra a este showroom. Un embudo que empiece en `/`
mezcla visitas que nunca miraron Bravo.

## Cómo separar este showroom del resto

Los dos showrooms mandan al **mismo proyecto de PostHog**. Lo que los distingue es
`$host`:

- producción de Bravo → `showroom-mario-bravo.netlify.app`
- Caviahue → `maihuenia.com`
- pruebas locales de Bravo → `test.mario-bravo.kuvus.app` (ver abajo)

**Filtrá todo insight por `$host`.** Sin eso, los números de los dos proyectos se suman.

## No se puede validar desde local

Con `defaults: "2026-01-30"` la librería marca a `localhost` como **internal/test user**
(le crea un person profile real, cosa que en producción no pasa), y con
`NEXT_PUBLIC_POSTHOG_MOCK_URL` seteada los eventos salen con `$host` de prueba
(`test.mario-bravo.kuvus.app`). Un evento disparado desde local **no es comparable** con
uno de producción.

## Historial de vocabulario (lo que murió)

Este repo salió de Caviahue con una copia **vieja** de `src/lib/analytics.ts` y se quedó
ahí hasta el **01-09-2026**, con PostHog además sin env vars (o sea: no mandaba nada). Al
ponerlo en marcha se trajo la versión corregida de Caviahue (`4fab5bb`), que cambió:

- `unit_selected` salía sólo desde el buscador de la lupa y con
  `location: "showroom_toolbar"`; ahora lo emite la ficha, con las 6 superficies reales
  más `direct`;
- `contact_form_submitted` esperaba el `res.ok` de `/api/contact`: si Resend fallaba, el
  lead se perdía del embudo. Ahora sale con el **submit**;
- `cta_clicked` sale con `sendBeacon` + `send_instantly` (en mobile el salto a WhatsApp
  se comía el evento que esperaba en la cola batcheada);
- el botón "Consultar" de la ficha (`residence_nav`), el CTA más visible, no emitía nada;
- `unit_selected` captura **antes** de marcar el dedup, no después;
- `person_profiles` explícito en el init.

Como nunca hubo tráfico real con el vocabulario viejo, **no hay histórico que reconciliar**:
el dashboard arranca limpio desde esa fecha.
