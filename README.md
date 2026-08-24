# Showroom Mario Bravo 955

Showroom interactivo del desarrollo **Mario Bravo 955** (CABA): recorrido 360° del
exterior con las unidades clicables sobre el render, y una ficha por departamento.
Construido sobre el motor de showrooms de CUBIQA (Next.js 15 · App Router · React 19 ·
Tailwind 4), el mismo que corre el showroom de Maihuenia.

> **Estado: bootstrap.** El showroom navega y el editor de polígonos está listo para
> empezar a trazar. Falta casi toda la data comercial y varios assets del cliente —
> ver [Qué falta](#qué-falta).

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:3000
```

No hace falta ninguna variable de entorno para levantarlo: sin Airtable la app lee
`src/data/units.json`, y sin Resend el formulario de contacto devuelve 500 controlado.
Copiá `.env.example` a `.env.local` cuando conectes los servicios.

`ffmpeg` tiene que estar en el PATH sólo para los pipelines de video/frames.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Intro — portada a pantalla completa con el CTA "Descubrir". Hoy es un still (falta el video, ver [Qué falta](#qué-falta)). |
| `/showroom` | El showroom: las 4 vistas del edificio, flechas para girar, polígonos clicables por unidad. |
| `/residencia/[id]` | Ficha de la unidad. Como overlay sobre el showroom (navegación interna) o como página propia (link directo). |
| `/admin/polygon-editor` | Editor de polígonos — herramienta interna, apagada por defecto. |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | Metadata routes. |

---

## Editor de polígonos

Es la herramienta para dibujar el área clicable de cada unidad sobre los renders.
**Está apagada por defecto** (`/admin/*` y `/api/admin/*` devuelven 404); se prende
con una env var:

```bash
# .env.local  — ya viene creado con esto
ENABLE_POLYGON_EDITOR=true
```

Después, con `npm run dev`:

| URL | Qué edita |
|---|---|
| `/admin/polygon-editor` | Redirige al stop 0. |
| `/admin/polygon-editor/0` … `/3` | Los polígonos de cada una de las 4 vistas. |
| `/admin/polygon-editor/plano/1` … `/7` | Los polígonos de cada planta (todavía sin planos cargados). |

**Cómo se guarda.** El editor postea a `/api/admin/*`, que en local escribe
directamente a `src/data/stops.json` / `plates.json`. Eso es lo que se commitea, y en
producción **ese JSON es la fuente de verdad**. Después de trazar: revisá el diff y
commiteá.

**Reglas del trazado** (las que cuestan caro si se rompen):

- Los puntos van en **píxeles nativos del render**: `0..4000` × `0..2250`. El editor ya
  trabaja en ese espacio.
- El `unitId` de cada polígono tiene que existir como key de `units.json` —
  el editor te avisa con un ⚠ si escribís uno que no existe. El desplegable trae las 61.
- Polígonos **pegados** (bordes compartidos, sin huecos): si quedan gaps, el hover
  parpadea al pasar entre dos unidades.
- Si algún día se re-renderiza una vista **a otra resolución, hay que re-trazar** esa
  vista entera (y sus hotspots VR). Por eso el orden de los stops está congelado.

Antes de deployar, sacá `ENABLE_POLYGON_EDITOR` del entorno de producción.

---

## Data y assets

### Las 61 unidades

`src/data/units.json` — una entrada por unidad, key = `<piso><UF>` como **texto**:

```
1° piso   101 … 110      (10)
2° piso   201 … 210      (10)
3° piso   301 … 310      (10)
4° piso   401 … 410      (10)
5° piso   501 … 510      (10)
6° piso   601 602 603 604 606 607 608 609   (8 — el 6° no tiene 05 ni 10)
7° piso   701 702 706                       (3 — piso de retiro)
```

Sale de `MB 955 - UNIDADES EN VENTA.pdf`. Las superficies están verificadas: la suma
por columna da exacto contra los TOTALES del PDF (cubierta 3.344,00 · semi/descubierta
857,50 · común 167,20 · total 4.368,70 m²).

Ese `unitId` es **la clave de join de todo**: `polygon.unitId` ↔ key de `units.json` ↔
columna `Unidad` de Airtable. Tienen que ser byte-idénticos.

Lo que ya está cargado: `residence`, `beds`, `ambientes`, `areas` (total / cubierta /
semi-descubierta), `sqft`, `status`. Lo que **no**:

- `price` está en `"Consultar"` a propósito. El PDF trae precios, pero es una planilla
  comercial interna — que se publiquen o no lo decide el cliente, y una vez decidido
  van por Airtable, no hardcodeados.
- `baths` está puesto por convención (1 para mono y 2 ambientes, 2 para 3 y 4
  ambientes). **No sale de ningún documento del cliente** — verificalo contra los
  planos de tipología.
- `floorPlan` apunta a un placeholder hasta que se procesen las tipologías.

### Los 4 stops

`public/stops/stop-{0..3}.jpg` (nativo, 4000×2250) + `.webp` (2560×1440, el que se
sirve). El anillo de navegación es:

| Stop | Vista |
|---|---|
| 0 | Fachada frontal sobre Mario Bravo, atardecer |
| 1 | Esquina a nivel de calle, locales de PB |
| 2 | Contrafrente ancho con pileta |
| 3 | Contrafrente cerca desde el jardín |

**Desviación del estándar:** el runbook de CUBIQA lockea los stops en 5000×2812; el
cliente entregó 4000×2250. Los dos son 16:9 exacto, así que se respeta el nativo en vez
de upscalear — inventar píxeles no agrega detalle y sí agrega peso. `imageWidth`/
`imageHeight` de `stops.json` reflejan el tamaño real, que es lo único que importa para
que los polígonos caigan donde deben.

Se regeneran con `npm run stops:stills` (lee `_media-src/stops/stop-N-src.jpg`,
**conserva los polígonos ya trazados**).

### Los frames del flyby son PROVISORIOS

Las flechas del showroom reproducen los frames pre-renderizados del tramo entre dos
vistas. Todavía no llegaron los mp4 del 3D, y sin frames el `FlybyViewer` no dibuja las
flechas — el showroom quedaría clavado en una sola vista. Así que hay un andamio:
`scripts/make-placeholder-frames.mjs` genera un **cross-dissolve** entre vistas
consecutivas (14 frames, 720p, ~8 MB el set).

**No es una órbita: la cámara no se mueve, las dos vistas se funden.** Sirve para que
la navegación exista y se puedan trazar los polígonos.

Cuando lleguen los tramos:

```bash
npm run flyby:frames -- "_media-src/flyby/tramo-0-1.mp4" 0 1   # ×4 (0-1, 1-2, 2-3, 3-0)
```

y borrá `scripts/make-placeholder-frames.mjs` + su línea de `package.json`. Es drop-in:
`flyby.json` referencia los frames por ruta y las rutas no cambian, así que no hay que
tocar código. El script imprime el PSNR del empalme contra los stills — el último frame
tiene que dar **≥30 dB** contra la vista destino, si no se ve un salto al frenar.

### Marca

`public/logo.png` y `logo_b_n.png` derivan del logotipo de **CCM DESARROLLOS** que vino
en la entrega. El original es dorado + texto NEGRO sobre transparente (pensado para
fondo claro); como el showroom lo apoya sobre renders oscuros, `logo.png` tiene el texto
recoloreado a claro y `logo_b_n.png` es la versión full negro.

La paleta sale de ese logo: el dorado crudo es `#C69A3C`, que sobre blanco sólo llega a
2,6:1 de contraste, así que `--gold` usa el mismo tono oscurecido a `#A68132` (3,6:1) y
`--gold-soft` a `#8F6F2B` (4,7:1, AA para texto). El favicon (`src/app/icon.svg`) es el
monolito dorado del logo sobre negro; `npm run og:generate` deriva de ahí todo el set
(og.jpg, icon-192/512, apple-icon, favicon.ico).

⚠ Es el logo de la **desarrolladora**, no un wordmark propio del proyecto. Si el cliente
entrega uno de "Mario Bravo 955", reemplazalo y volvé a correr `og:generate`.

### Estructura de carpetas

```
_media-src/          Masters crudos del cliente — GITIGNOREADO, no deploya.
  stops/             Los 4 exteriores originales
  gallery/           Los 10 renders de amenities e interiores
  tipology/          Los 5 PDF de tipología
  planos/            Las plantas CAD (9 páginas)
  comercial/         El listado de unidades en venta
  logos/             El logotipo de CCM
  360/               Los links de los tours Kuula
  MANIFIESTO-ENTREGA.md   ← mapeo original→destino + los problemas del drop

reordenar-(no-subir)/   Buzón de entregas crudas — GITIGNOREADO.
public/              Derivados web (esto SÍ se commitea)
scripts/             Pipelines de ingesta (imágenes, video, frames, OG)
src/data/            units.json · stops.json · plates.json · flyby.json · gallery.json · site.ts
```

Cuando llegue una entrega nueva del cliente: tirala en `reordenar-(no-subir)/`,
reorganizala en `_media-src/` y actualizá el manifiesto.

**Leé `_media-src/MANIFIESTO-ENTREGA.md`** antes de pedirle nada más al cliente: la
entrega inicial vino con dos PDF disfrazados de `.jpg`/`.log`, un log disfrazado de
`.pdf`, dos renders con nombre de logo y cuatro pares duplicados. Todo está mapeado ahí.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` / `lint` | Next. |
| `npm run stops:stills` | `_media-src/stops/stop-N-src.jpg` → stills servidos + `stops.json` (conserva polígonos). |
| `npm run flyby:frames -- <mp4> <from> <to>` | Extrae los frames de un tramo, los cablea en `flyby.json` e imprime el PSNR del empalme. |
| `npm run gallery:optimize` | `_media-src/gallery/` → WebP + `gallery.json`. |
| `npm run og:generate` | `og.jpg` + todo el set de iconos, desde `stop-0.jpg` e `icon.svg`. |
| `npm run video:mario-bravo` | Comprime un master de video a mp4 + webm + poster. |
| `node scripts/make-placeholder-frames.mjs` | ⚠ Provisorio — los fundidos entre vistas. Borrar cuando lleguen los tramos reales. |
| `node scripts/apply-new-tipologias.mjs` | Recorta los planos de tipología a las cards `TIPOLOGIA A-F`. Hay que ajustarle el mapeo m²→letra. |

---

## Qué falta

### Del cliente

| Qué | Bloquea |
|---|---|
| **Dominio de producción** | `PROD_SITE_URL` (`src/lib/seo.ts`), el redirect www→apex de `next.config.ts` y `netlify.toml`, y `NEXT_PUBLIC_SITE_URL`. Hoy los tres tienen un placeholder: **no deployar así**, el canonical apuntaría a un dominio inexistente. |
| **Teléfonos de ventas** | `WHATSAPP_NUMBER` (`src/lib/contact.ts`) está vacío → los CTA de WhatsApp abren el selector de contacto en vez de un chat. |
| **Casilla de leads + verificar dominio en Resend** | `EMAIL_TO`. Sin dominio verificado, Resend sólo entrega a la cuenta dueña de la key. |
| **Pin exacto del edificio** | `SITE.location` tiene coordenadas aproximadas de la altura 900 de Mario Bravo. Posiciona el marker del mapa y el JSON-LD. |
| **POIs del barrio** | `SITE.pois` está vacío a propósito (inventarlos publica datos falsos). Sin ellos el mapa no tiene pines de entorno. |
| **Los 4 tramos mp4 del flyby** | Reemplazar los fundidos provisorios por la órbita real. |
| **Video de intro** | La portada `/` está en modo still. Cuando existan `public/intro.mp4` + `intro-mobile.mp4`, poné `INTRO_VIDEO_READY = true` en `IntroScreen.tsx`. |
| **Identificar las tipologías B y C** | Llegaron 5 PDF pero sólo 3 rotulados (A, D, E). Los otros dos están como `SIN-IDENTIFICAR-1/2` en `_media-src/tipology/`. |
| **Baños por tipología** | Hoy están por convención, no por documento. |
| **Brochure comercial** | `BROCHURE_URL` es `null` → el item del menú y el botón "Ver PDF" están ocultos. Las plantas CAD y el listado de unidades no son material para el público. |
| **Logo de Estudio Mizraji** | El drop traía uno solo (CCM) pese a los nombres de archivo. Va en "El Equipo". |
| **Media del barrio** | La sección de entorno del menú está oculta (`HAS_DESTINATION_MEDIA` en `CaviahueCarousel.tsx`). |
| **¿Wordmark propio del proyecto?** | Hoy la marca visible es la de la desarrolladora. |

### Del lado nuestro

1. **Trazar los polígonos** de las 4 vistas — el paso siguiente, y la razón de este push.
2. **Plantas** (`plates.json`): las 9 páginas de `_media-src/planos/` dan PB, 1°, tipo
   2°-5°, 6° y 7°. Hay que exportarlas a PNG, cargarlas y trazar los polígonos de planta.
3. **Tipologías**: procesar los PDF con `apply-new-tipologias.mjs` y apuntar el
   `floorPlan` de cada unidad a la suya.
4. **Tours Kuula**: los 5 links (A–E) están en `_media-src/360/kuula-360.txt`. Hay que
   mapear tipología → unidades y cargarlos en `units.json`. Ojo: ocultar el logo de
   Kuula (`logo=-1`) requiere cuenta PRO — confirmarlo antes de prometerlo.
5. **Airtable**: base propia del proyecto (no reusar la de otro showroom), tabla de
   unidades con la columna `Unidad` en TEXTO matcheando estas 61 keys.
6. **`src/i18n/translations.ts` todavía tiene el copy de Caviahue**, en ES y EN. Es el
   archivo más grande del repo y se reemplaza entero, no a parches: hasta entonces
   varios textos del menú y de la ficha hablan del proyecto anterior. La identidad del
   resto del código (SEO, metadata, emails, manifest, paleta) ya está migrada.

---

## Deploy

Prod pensado para un host con Node (SSR): `npm run build` + `npm start`. `netlify.toml`
y `public/_headers` traen la cache larga de `/frames/*`, `/stops/*` y `/gallery/*` — sin
ella el navegador re-baja los frames tras un rato idle y la transición "teletransporta"
en vez de animar. Verificar post-deploy con `curl -I`.

En producción **no** seteés `ENABLE_POLYGON_EDITOR`: sin esa var, todo `/admin/*` y
`/api/admin/*` devuelve 404.
