# TIER Bravo — Showroom

Showroom interactivo de **TIER Bravo**, el desarrollo de CCM Desarrollos en Mario Bravo
955 (CABA): recorrido 360° del exterior con las unidades clicables sobre el render, y una
ficha por departamento. Construido sobre el motor de showrooms de CUBIQA (Next.js 15 ·
App Router · React 19 · Tailwind 4).

> **Nombre.** El producto se llama **TIER Bravo** (TIER es la marca paraguas de CCM; sus
> otros desarrollos son TIER Avenue y TIER Sinclair). *Mario Bravo 955* es la dirección —
> se conserva en títulos y descripciones porque es lo que la gente googlea.

> **Estado: bootstrap.** El showroom navega, las plantas están cargadas y el editor de
> polígonos está listo para trazar. Falta data comercial y varios assets — ver
> [Qué falta](#qué-falta).

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:3000
```

No hace falta ninguna variable de entorno: sin Airtable la app lee `src/data/units.json`,
y sin Resend el formulario de contacto devuelve 500 controlado. Copiá `.env.example` a
`.env.local` cuando conectes los servicios. `ffmpeg` sólo hace falta para los pipelines
de video/frames.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Intro — portada a pantalla completa con el CTA "Descubrir". Hoy es un still (falta el video). |
| `/showroom` | Las 4 vistas del edificio, flechas para girar, polígonos clicables por unidad. |
| `/residencia/[id]` | Ficha de la unidad. Como overlay sobre el showroom o como página propia. |
| `/admin/polygon-editor` | Editor de polígonos — herramienta interna, apagada por defecto. |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | Metadata routes. |

---

## Editor de polígonos

Es la herramienta para dibujar el área clicable de cada unidad. **Apagada por defecto**
(`/admin/*` y `/api/admin/*` devuelven 404); se prende con una env var:

```bash
# .env.local  — ya viene creado con esto
ENABLE_POLYGON_EDITOR=true
```

| URL | Qué edita |
|---|---|
| `/admin/polygon-editor/0` … `/3` | Los polígonos de cada una de las 4 vistas del showroom. |
| `/admin/polygon-editor/plano/1` … `/7` | Los polígonos de cada planta. |

**Cómo se guarda.** El editor postea a `/api/admin/*`, que en local escribe directo a
`src/data/stops.json` / `plates.json`. Eso es lo que se commitea, y en producción **ese
JSON es la fuente de verdad**. Después de trazar: revisá el diff y commiteá.

**Reglas del trazado:**

- Los puntos van en **píxeles nativos** de cada imagen (`4000×2250` los stops; cada
  planta tiene los suyos, ver la tabla de más abajo). El editor ya trabaja en ese espacio.
- El `unitId` tiene que existir como key de `units.json` — el editor avisa con un ⚠ si no.
  El desplegable trae las 61.
- Polígonos **pegados** (bordes compartidos, sin huecos): si quedan gaps, el hover
  parpadea al pasar entre dos unidades.
- Si se re-renderiza una imagen **a otra resolución, hay que re-trazarla** entera.

### Atajo para los pisos 2 a 5

Son la misma planta tipo: las unidades están en idéntica posición y sólo cambia el
prefijo del id. **Trazá sólo el piso 2** y cloná:

```bash
npm run plates:clone -- 2 3 4 5
```

Remapea `2xx → 3xx/4xx/5xx`, valida contra `units.json` y descarta lo que no exista.
Ahorra 30 polígonos y evita el vértice corrido que aparece al trazar lo mismo cuatro veces.

Antes de deployar, sacá `ENABLE_POLYGON_EDITOR` del entorno de producción.

---

## Data y assets

### Las 61 unidades

`src/data/units.json` — key = `<piso><UF>` como **texto**:

```
1° a 5°   101…110, 201…210, 301…310, 401…410, 501…510   (10 c/u)
6°        601 602 603 604 606 607 608 609               (8 — sin 05 ni 10)
7°        701 702 706                                   (3 — piso de retiro)
```

Sale de `MB 955 - UNIDADES EN VENTA.pdf`; las superficies dan exacto contra los TOTALES
del PDF. Ese `unitId` es **la clave de join de todo**: `polygon.unitId` ↔ key de
`units.json` ↔ columna `Unidad` de Airtable.

Cargado: `residence`, `beds`, `ambientes`, `areas`, `sqft`, `status`, y —desde el mapeo
de Camila— `tipologia` + `tour360` en los pisos 1 a 5. Pendiente:

- `price` en `units.json` queda en `"Consultar"`: los precios reales llegan EN VIVO
  desde Airtable (ver más abajo), no hardcodeados. Sin Airtable el sitio no muestra precio.
- `baths` está puesto por convención (1 para mono y 2 amb., 2 para 3 y 4 amb.). **No sale
  de ningún documento del cliente** — verificalo contra los planos de tipología.
- `floorPlan` apunta a un placeholder hasta procesar las tipologías.

### Tipologías y recorridos 360°

Camila mapeó los 5 recorridos Kuula a pares de unidades funcionales sobre la planta tipo
(Miro, 25-08). Cruzado contra la planilla de venta **los ambientes dan exacto**, así que
está aplicado:

| Tipología | UF | Qué es | Unidades |
|---|---|---|---|
| A | 03 y 10 | Monoambiente, 34 m² | 10 (pisos 1–5) |
| B | 04 y 09 | Monoambiente, 34 m² | 10 |
| C | 05 y 08 | 2 ambientes, 51–52 m² | 10 |
| D | 01 y 07 | 3 ambientes, 77–82 m² | 10 |
| E | 02 y 06 | 2 ambientes, 57–58 m² | 10 |

El 1° comparte layout interior con la planta tipo (idénticas superficies cubiertas; sólo
cambian los patios), por eso entra en el mapeo. **El 6° y el 7° quedaron sin recorrido**:
son plantas de retiro con otras unidades — hay que preguntarle a Camila si reusan alguno
de los A–E o si van a tener el suyo.

### Data en vivo (Airtable)

La base **TIER Bravo** (`appVdj9WzBYpKtUcu`) maneja estado, precio, ambientes y
superficies de las 61 unidades; `units.json` es el fallback si Airtable se cae o tarda
más de 2,5 s. Las credenciales van en `.env.local` (gitignoreado) — ver `.env.example`.

Los nombres de columna de esta base **no son los del template**, así que
`src/lib/airtable.ts` los lee con alias tolerantes:

| Columna en Airtable | Va a | Nota |
|---|---|---|
| `Unidad` | clave de join | TEXTO, matchea las keys de `units.json` |
| `Precio USD` | `price` | número plano → se formatea como `USD 279.248` |
| `Ambientes` | `ambientes` | |
| `Superficie Total` | `areas.total` | |
| `Superficie Cubierta` | `areas.interior` | |
| `Superficie Semi/Desc` | `areas.exterior` | |
| `Piso` | `piso` | |
| `Tipología` | — | **se ignora**: dice "3 AMBIENTES" (duplica `Ambientes`). La tipología del sitio es la LETRA A–E, que vive en `units.json`. Si el cliente algún día carga letras, entran solas. |
| `Estado` | `status` | ⚠ **la columna NO EXISTE en la base** |

> ⚠️ **Falta la columna `Estado`.** Es la que pinta el contorno de cada unidad (verde
> disponible / amarillo reservada) y la que alimenta el filtro "Disponibilidad" del
> buscador. Mientras no exista, las 61 quedan con el estado de `units.json` y **el
> showroom se ve como si estuviera todo disponible**. Hay que pedirle al cliente que la
> agregue con valores "Disponible" / "Reservada" — el código ya la lee (y también acepta
> `Estado de la unidad` o `Disponibilidad`).

> 💰 **Los precios viajan en el HTML aunque no se muestren.** Ningún componente los
> renderiza hoy, y el JSON-LD no los publica (`PRICE_CURRENCY = null` en `seo.ts`), pero
> el valor llega al navegador dentro del payload de React y se ve en "ver código fuente".
> Si el cliente no quiere precios públicos, la solución es una línea: no mapear
> `Precio USD` en `fetchAirtableUnits`. **Preguntar antes de publicar.**

La tabla **Avance de Obra** (`tbldUfUyV1eoT8gBe`) sí coincide con el template:
`Porcentaje` + `Hito en curso` → hoy devuelve 59% / "Terminaciones".

### Cómo se llega a una unidad

Hoy hay tres caminos, y **falta el principal**:

| Camino | Estado |
|---|---|
| **Buscador de unidades** (la lupa del showroom, el item del menú lateral, y la lupa de la nav de la ficha) | ✅ anda — filtra por ambientes, baños, piso y disponibilidad, con la data en vivo de Airtable |
| **Carrusel "Unidades Disponibles"** al pie de cada ficha | ✅ anda |
| **Links crawleables** del bloque SEO del showroom (61 `<a>`, `sr-only`) | ✅ anda |
| **Clic en la unidad sobre el render / la planta** | ❌ **falta trazar los polígonos** — es el paso siguiente |

Sin polígonos, el showroom muestra las vistas y las plantas pero no hay nada clicable
encima. Todo lo demás (la ficha, el zoom, el overlay, la data en vivo) ya funciona: se
puede comprobar entrando directo a `/residencia/205`.

### Los 4 stops

`public/stops/stop-{0..3}.jpg` (nativo, 4000×2250) + `.webp` (2560×1440, el que se sirve):

| Stop | Vista | Render |
|---|---|---|
| 0 | Fachada frontal sobre Mario Bravo, atardecer | `View 01` |
| 1 | Esquina a nivel de calle, locales de PB | `View 02` |
| 2 | Contrafrente ancho con pileta | `View 03` |
| 3 | Contrafrente cerca desde el jardín | `View 04` |

Se regeneran con `npm run stops:stills` (lee `_media-src/stops/stop-N-src.jpg`,
**conserva los polígonos ya trazados**).

**Desviación del estándar:** el runbook de CUBIQA lockea los stops en 5000×2812; el
cliente entrega 4000×2250. Los dos son 16:9 exacto, así que se respeta el nativo en vez
de upscalear. `imageWidth`/`imageHeight` reflejan el tamaño real, que es lo único que
importa para que los polígonos caigan donde deben.

### El stop intermedio (View 02b)

Juani está preparando un stop entre `View 02` y `View 03` —o sea entre `stop-1` y
`stop-2`— para que la transición no fuerce tanto. **Cuando llegue entra como `stop-4`, no
como "2b"**: el viewer resuelve los segmentos por `from`/`to` y no le importa el orden de
los ids, así que agregarlo al final evita renumerar 2 y 3 — y renumerar obligaría a
**re-trazar todos sus polígonos**.

Pasos: dejar el render en `_media-src/stops/stop-4-src.jpg` → `npm run stops:stills` →
poner `const RING = [0, 1, 4, 2, 3];` en `scripts/make-placeholder-frames.mjs` (o generar
los tramos reales con `flyby:frames` respetando esa cadena).

### Las 7 plantas

`public/tipology/piso-*.webp`, con los números de unidad ya rotulados en el render:

| Piso | Imagen | Espacio de trazado |
|---|---|---|
| 1 | `piso-1.webp` | 2040×2182 |
| 2, 3, 4, 5 | `piso-tipo-2-5.webp` *(compartida)* | 2040×2182 |
| 6 | `piso-6.webp` | 1991×2249 |
| 7 | `piso-7.webp` | 2122×2326 |

Se regeneran con `npm run plates:images` (conserva polígonos). El mapeo piso → archivo
está en `FLOOR_SOURCES`, arriba de `scripts/make-plates.mjs`.

El subsuelo (cochera), la planta baja (amenities) y el 8° (azotea común) **no tienen
unidades**, así que no son plates. Quedan en `_media-src/plantas/` con `_` adelante por
si algún día se muestran como contexto.

### Los frames del flyby son PROVISORIOS

Las flechas del showroom reproducen los frames pre-renderizados del tramo entre dos
vistas. Todavía no llegaron los mp4 del 3D, y sin frames el `FlybyViewer` no dibuja las
flechas. Así que hay un andamio: `scripts/make-placeholder-frames.mjs` genera un
**cross-dissolve** entre vistas consecutivas (14 frames, 720p, ~8 MB el set).

**No es una órbita: la cámara no se mueve, las vistas se funden.** Sirve para que la
navegación exista y se puedan trazar los polígonos.

Cuando lleguen los tramos:

```bash
npm run flyby:frames -- "_media-src/flyby/tramo-0-1.mp4" 0 1   # ×N
```

y borrá `make-placeholder-frames.mjs` + su línea de `package.json`. Es drop-in: mismas
rutas, cero cambios de código. El script imprime el PSNR del empalme — el último frame
tiene que dar **≥30 dB** contra la vista destino.

### Marca y paleta

El logotipo es el wordmark **TIER** (`_media-src/logos/tier-negro.svg`). El cliente lo
entrega en negro y blanco; `npm run brand:logos` genera las tres variantes que usa la app:

| Archivo | Color | Dónde |
|---|---|---|
| `public/logo.png` | oro `--gold` | Superficies claras: nav de la ficha, modal de contacto, plano, 404 |
| `public/logo_b_n.png` | ink | Donde se pide monocromo (ContactSection) |
| `public/logo_blanco.png` | blanco | Sobre los renders del showroom y en el OG — el oro se pierde contra un cielo claro |

**Paleta.** El key visual de TIER es negro + oro `#BF9753`, pensado para fondo oscuro; ese
oro sobre blanco da 2,7:1 (ilegible). Decisión tomada con Juani: se mantiene el **lienzo
claro** del template y se oscurecen los neutros hacia **grafito** —no hacia beige—,
dejando el oro como único acento cálido:

```
--ink   #0F0F11    --mist  #F1F1F3    --line  #E2E2E4    --cream #F5F1E8
--gold        #A07F46   oro TIER oscurecido · 3,7:1 sobre blanco (AA texto grande)
--gold-soft   #8A6D3C   4,9:1 (AA cuerpo)
--gold-bright #BF9753   el CRUDO del key visual — SÓLO sobre superficies oscuras (6,9:1)
```

El favicon (`src/app/icon.svg`) usa el path real de la "T" del logotipo sobre el grafito
de la marca; `npm run og:generate` deriva de ahí todo el set (og.jpg, icon-192/512,
apple-icon, favicon.ico).

⚠ **La tipografía del logo no se puede saber desde los archivos**: el `.ai`, el `.pdf` y
el `.svg` traen las letras vectorizadas, sin fuente embebida ni metadata. Por las formas
(sans geométrica monolínea, "E" en tres barras) se parece mucho a **Futura / Jost Light**,
y Jost ya está cargada en el sitio — pero confirmalo con el cliente antes de armar lockups.

### Estructura de carpetas

```
_media-src/          Masters crudos del cliente — GITIGNOREADO, no deploya.
  stops/             Los 4 exteriores (+ _v1-2026-08-24/ con los de la 1ª entrega)
  plantas/           Las 7 plantas generales
  gallery/           Los 10 renders de amenities e interiores
  tipology/          Los 5 PDF de tipología
  planos/            El PDF de plantas CAD de la 1ª entrega
  comercial/         El listado de unidades en venta
  logos/  marca/     El wordmark TIER y el key visual de la marca
  360/               Los links de los tours Kuula
  MANIFIESTO-ENTREGA.md   ← mapeo original→destino, entrega por entrega

reordenar-(no-subir)/   Buzón de entregas crudas — GITIGNOREADO.
public/              Derivados web (esto SÍ se commitea)
scripts/             Pipelines de ingesta
src/data/            units · stops · plates · flyby · gallery · site.ts
```

Cuando llegue una entrega nueva: tirala en `reordenar-(no-subir)/<fecha>/`, reorganizala
en `_media-src/` y agregá su sección al manifiesto.

**Leé `_media-src/MANIFIESTO-ENTREGA.md`** antes de pedirle nada más al cliente: registra
los problemas de cada drop (archivos con extensión equivocada, duplicados, logos
faltantes) y de dónde salió cada asset.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` / `lint` | Next. |
| `npm run stops:stills` | `_media-src/stops/` → stills servidos + `stops.json` (conserva polígonos). |
| `npm run plates:images` | `_media-src/plantas/` → plantas WebP + `plates.json` (conserva polígonos). |
| `npm run plates:clone -- 2 3 4 5` | Clona los polígonos de un piso a otros, remapeando el `unitId`. |
| `npm run brand:logos` | Wordmark TIER → las tres variantes de color de `public/`. |
| `npm run og:generate` | `og.jpg` + todo el set de iconos. |
| `npm run flyby:frames -- <mp4> <from> <to>` | Extrae los frames de un tramo y los cablea en `flyby.json` (+ PSNR). |
| `npm run gallery:optimize` | `_media-src/gallery/` → WebP + `gallery.json`. |
| `npm run video:mario-bravo` | Comprime un master de video a mp4 + webm + poster. |
| `node scripts/make-placeholder-frames.mjs` | ⚠ Provisorio — los fundidos entre vistas. |
| `node scripts/apply-new-tipologias.mjs` | Recorta planos de tipología a cards. Hay que ajustarle el mapeo m²→letra. |

---

## Qué falta

### Del cliente

| Qué | Bloquea |
|---|---|
| **Columna `Estado` en Airtable** | Sin ella el contorno de las unidades no refleja disponibilidad: todo se ve libre. Es el pedido más urgente. |
| **Dominio de producción** | `PROD_SITE_URL` (`src/lib/seo.ts`), el redirect www→apex de `next.config.ts` y `netlify.toml`, y `NEXT_PUBLIC_SITE_URL`. Hoy tienen un placeholder con la dirección; **desde el rebranding probablemente sea un dominio TIER**. No deployar así. |
| **Tipografía del logotipo** | Camila se lo preguntó al cliente. Sin eso no se pueden armar lockups tipográficos coherentes con el wordmark. |
| **Teléfonos de ventas** | `WHATSAPP_NUMBER` (`src/lib/contact.ts`) está vacío → los CTA abren el selector de contacto. |
| **Casilla de leads + verificar dominio en Resend** | `EMAIL_TO`. Sin dominio verificado, Resend sólo entrega a la cuenta dueña de la key. |
| **¿Los precios son públicos?** | Airtable los trae y hoy viajan en el HTML sin mostrarse. Ver el aviso en [Data en vivo](#data-en-vivo-airtable). |
| **Token de Airtable definitivo** | El actual lo pasó el cliente para probar y va a ser rotado. |
| **Pin exacto del edificio** | `SITE.location` tiene coordenadas aproximadas de la altura 900 de Mario Bravo. |
| **POIs del barrio** | `SITE.pois` está vacío a propósito (inventarlos publica datos falsos). |
| **Recorrido 360° del 6° y 7°** | 11 unidades sin `tour360`. ¿Reusan A–E o llevan el suyo? |
| **View 02b** | Juani la está preparando. Ver [El stop intermedio](#el-stop-intermedio-view-02b). |
| **Los 4 tramos mp4 del flyby** | Reemplazar los fundidos provisorios por la órbita real. |
| **Video de intro** | La portada `/` está en modo still. Con `public/intro.mp4` + `intro-mobile.mp4` poné `INTRO_VIDEO_READY = true` en `IntroScreen.tsx`. |
| **Identificar las tipologías B y C** | Están como `tipologia-B-o-C-{1,2}.pdf`. Se resuelve mirándolas: **B es un monoambiente de 34 m²** y **C un 2 ambientes de 51-52 m²**. |
| **Baños por tipología** | Hoy están por convención, no por documento. |
| **Brochure comercial** | `BROCHURE_URL` es `null` → el item del menú y el botón "Ver PDF" están ocultos. |
| **Logo de Estudio Mizraji** | Va en "El Equipo". El drop sólo trajo el de CCM. |
| **Media del barrio** | La sección de entorno del menú está oculta (`HAS_DESTINATION_MEDIA`). |

### Del lado nuestro

1. **Trazar los polígonos**: las 4 vistas + el piso 2 (y clonar a 3-5) + los pisos 1, 6 y 7.
2. **Tipologías**: procesar los PDF con `apply-new-tipologias.mjs` y apuntar el `floorPlan`
   de cada unidad a la suya. El mapeo tipología → unidades ya está en `units.json`.
3. **Airtable**: base propia del proyecto, tabla de unidades con la columna `Unidad` en
   TEXTO matcheando estas 61 keys.
4. **`src/i18n/translations.ts` todavía tiene prosa editorial de Caviahue** — el equipo, la
   narrativa constructiva y el namespace de destino. Todo lo que se RENDERIZA ya está
   migrado (las tres rutas principales dan cero menciones); lo que queda sale en los
   modales "El Proyecto" y "El Equipo" y necesita reescritura real, no find/replace.

---

## Deploy

Prod pensado para un host con Node (SSR): `npm run build` + `npm start`. `netlify.toml` y
`public/_headers` traen la cache larga de `/frames/*`, `/stops/*` y `/gallery/*` — sin ella
el navegador re-baja los frames tras un rato idle y la transición "teletransporta" en vez
de animar. Verificar post-deploy con `curl -I`.

En producción **no** seteés `ENABLE_POLYGON_EDITOR`: sin esa var, todo `/admin/*` y
`/api/admin/*` devuelve 404.
