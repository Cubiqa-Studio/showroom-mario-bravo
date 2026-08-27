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

- Los puntos van en **píxeles nativos** de cada imagen (`4999×2812` las cinco vistas del
  showroom; cada planta tiene los suyos, ver la tabla de más abajo). El editor ya trabaja
  en ese espacio.
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

Cargado: `residence`, `beds`, `ambientes`, `areas`, `sqft`, `status`, `exposure`, y
—desde el mapeo de Camila— `tipologia` + `tour360` en los pisos 1 a 5. Pendiente:

- `price` en `units.json` queda en `"Consultar"`: los precios reales llegan EN VIVO
  desde Airtable (ver más abajo), no hardcodeados. Sin Airtable el sitio no muestra precio.
- `baths` está puesto por convención (1 para mono y 2 amb., 2 para 3 y 4 amb.). **No sale
  de ningún documento del cliente**, y los planos que llegaron el 25-08 dicen otra cosa:
  ver [Baños: lo que muestran los planos](#baños-lo-que-muestran-los-planos).
- `floorPlan`: cargado en 60 de las 61 unidades. Ver [Los planos de unidad](#los-planos-de-unidad).

### La galería y el hero de cada unidad

`_media-src/gallery/` (14 renders, gitignored) → `npm run gallery:optimize` →
`public/gallery/optimized/` + el manifiesto `src/data/gallery.json`, que es lo que
consume el lightbox del menú. De cada render salen **tres tamaños**, y cada uno tiene
su lugar:

| Variante | Ancho | Peso | Dónde se usa |
|---|---|---|---|
| `<slug>.webp` | 2400px | ~517 KB | el visor grande del lightbox |
| `<slug>-mid.webp` | 800px | ~61 KB | los 3 mosaicos del hero de la ficha (miden ≤340px) |
| `<slug>-thumb.webp` | 320px | ~11 KB | la tira de miniaturas del lightbox |

Los originales del cliente pesan **108 MB**; los 14 full optimizados, 7,1 MB. Abrir la
galería del menú baja 147 KB (los thumbs) y recién el full de la foto que se mira.

**Los nombres de archivo son el orden de exhibición**: el script ordena por nombre, así
que van numerados `01`…`14` de exterior a interior (fachada, esquina, contrafrente,
jardín · pileta, solárium, parrilla, gimnasio, lobby, coworking, SUM · living, cocina,
dormitorio).

**El hero de una unidad** sale de `unitGallery()` (`src/lib/residencia.ts`):

- Con `tour360` (las 50 de los pisos 1 a 5) → el recorrido de Kuula embebido, sin fotos.
- Sin `tour360` (las 11 del 6° y 7°) → `DEFAULT_HERO_VIEWS`: la **fachada** grande y
  **cocina, dormitorio y living** en los tres mosaicos del header. Lo eligió el cliente
  el 26-08.
- Una unidad puede traer su propia `gallery` en `units.json` y pisa el default.

⚠ `DEFAULT_HERO_VIEWS` y los `previewImage` de `vr-hotspots.ts` son rutas **escritas a
mano** a archivos que genera el script. Si se renombra un original en `_media-src`, hay
que actualizarlas — una ruta rota no rompe el build, sólo deja una imagen fantasma.

### Exposición: frente y contrafrente

`unit.exposure` (`"frente"` | `"contrafrente"`). Pedido del cliente el 25-08: el mismo
tratamiento que el chip de dúplex. Sale de las plantas —**Airtable no tiene columna de
orientación**, verificado contra la base— así que vive en `units.json` y se carga con
`npm run units:exposure`.

| | Unidades |
|---|---|
| **Frente** (Mario Bravo) | 23 — la 01, 02, 06 y 07 de los pisos 1 a 5, más 601, 606 y 701 |
| **Contrafrente** (pulmón: pileta, deck y parque) | 37 — la 03, 04, 05, 08, 09 y 10 de los pisos 1 a 5, más 602-604, 607-609 y 702 |
| **Sin dato, a propósito** | 1 — la **706 es PASANTE**: los tres dormitorios dan al pulmón y el estar-comedor a la calle. El campo es opcional justamente para esto: sin valor no muestra chip, que es mejor que etiquetarla mal. |

Cómo se dedujo, por tres caminos independientes que dan lo mismo:

1. `_planta-baja-amenities.png` fija la orientación de TODAS las plantas: abajo está la
   calle (LOCAL 1 = el café, el hall con la recepción al centro, LOCAL 2 = el local),
   que es exactamente lo que se ve en el render de fachada. Arriba, pileta y parque.
2. En `piso-tipo-2-5.png` los rótulos 01, 02, 06 y 07 caen en la mitad de abajo.
3. El Miro del cliente colorea la fachada y la numera 1, 2, 6 y 7 — cuatro unidades, y
   en el render se cuentan cuatro módulos de balcón por piso.

Dónde se ve: el chip en la tarjeta de unidad (hover del polígono, planta del piso y
unidades disponibles), la etiqueta en la tarjeta del buscador, la fila "Exposición" en
la ficha, el grupo de filtros del buscador, la línea de stats de "Unidades disponibles",
el blurb sr-only y el `additionalProperty` del JSON-LD.

⚠ **No meterlo en `unitFillColor`.** El violeta del dúplex es un OVERRIDE que tapa el
verde/ámbar de disponibilidad; la exposición la tienen las 61 unidades, así que pintaría
todos los polígonos y borraría el estado. Por eso el chip es sólo textual, en gris.

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

### Los 5 stops

`public/stops/stop-{0..4}.jpg` (nativo, 4999×2812) + `.webp` (2560×1440, el que se sirve):

| Stop | Vista | Render del cliente |
|---|---|---|
| 0 | Fachada frontal sobre Mario Bravo, atardecer | `View 01_02` |
| 1 | Esquina a nivel de calle, locales de PB | `View 02` |
| 2 | Primer plano de los balcones (punto intermedio) | `View 02b` |
| 3 | Contrafrente ancho con pileta | `View 03` |
| 4 | Contrafrente cerca desde el jardín | `View 04` |

Se regeneran con `npm run stops:stills` (lee `_media-src/stops/stop-N-src.jpg`,
**conserva los polígonos ya trazados**, indexados por id de stop).

El drop del 27-08 re-renderizó las cuatro vistas originales a 4999×2812 (antes la 0 ya
iba a 5k y las otras tres a 4000×2250) y sumó la `View 02b` en el medio. Las cinco
comparten espacio de coordenadas: **los polígonos y los hotspots se trazan sobre
4999×2812**, y `imageWidth`/`imageHeight` de `stops.json` son la fuente de verdad.

#### Por qué los ids se renumeraron

La `View 02b` entra en el medio del recorrido, así que el stop 2 viejo (`View 03`) pasó a
ser el 3 y el 3 (`View 04`) pasó a ser el 4.

La nota anterior de este README recomendaba lo contrario —meterla al final como `stop-4`
para no renumerar— porque **renumerar obliga a re-trazar los polígonos** del stop movido.
Esa razón dejó de aplicar: cuando llegó el drop, los stops 1, 2 y 3 tenían **cero
polígonos** (el único trazado es el stop 0, que no se movió y conservó sus 24). Contra
eso, mantener el orden tiene dos ventajas concretas:

- los labels son **visibles**: `aria-label="Avanzar a la vista N"` y el `alt` de cada
  still. Con ids salteados un lector de pantalla anunciaría 1 → 4 → 2 → 3;
- los chips y las flechas del editor de polígonos ordenan por id, así que el orden de
  edición coincide con el del recorrido.

Si en el futuro entra otro stop intermedio **y ya hay polígonos trazados**, vuelve a
convenir el append: el viewer resuelve los segmentos por `from`/`to` y le da igual el
orden de los ids.

### Las 10 plantas

`public/tipology/*.webp`, con los números de unidad ya rotulados en el render. El
selector las recorre en este orden, de abajo hacia arriba:

| Clave | Planta | Imagen | Espacio de trazado | Unidades |
|---|---|---|---|---|
| `SS` | Subsuelo — cochera | `subsuelo-cochera.webp` | 1596×2068 | — |
| `0` | Planta baja — amenities | `planta-baja-amenities.webp` | 2274×4093 | — |
| `1` | 1° | `piso-1.webp` | 1589×1711 | 10 |
| `2`-`5` | 2° a 5° | `piso-tipo-2-5.webp` *(compartida)* | 1589×1711 | 10 c/u |
| `6` | 6° | `piso-6.webp` | 1587×1711 | 8 |
| `7` | 7° | `piso-7.webp` | 1587×1408 | 3 |
| `8` | 8° — azotea común | `azotea-8vo.webp` | 1583×1049 | — |

Se regeneran con `npm run plates:images` (conserva polígonos). El mapeo piso → archivo
está en `FLOOR_SOURCES`, y el orden en `FLOOR_ORDER`, arriba de `scripts/make-plates.mjs`.

**El subsuelo y la planta baja no tienen unidades**, así que no llevan polígonos —no hay
nada que clickear— pero **sí se muestran**: son la cochera y los amenities, que es justo
lo que pregunta el que compra.

**El 8° es la azotea, y sí lleva polígonos — pero apuntando al 7°.** No existe ninguna
unidad `8xx`: la planilla de venta tiene 61 y ninguna es de ese piso. Lo que hay arriba
son las **terrazas privadas de las tres unidades del 7°**, cada una con su escalera
propia (se ven las tres en el plano, además del núcleo común y la sala de máquinas). Por
eso los polígonos de la azotea llevan `unitId` **701, 702 y 706**: la terraza es clicable
y abre su departamento, sin inventar unidades. El motor ya lo soporta —
`/api/plate/[floor]` adjunta la metadata de unidades de otro piso (se hizo para los
dúplex de Caviahue), así que el color de estado y el tooltip salen bien.

> Si alguna vez el cliente confirma que esas terrazas se venden por separado, ahí sí van
> como unidades propias en `units.json` **con sus superficies y precio**, y se re-apuntan
> los polígonos. Mientras tanto, crearlas vacías rompería el conteo de 61 (que aparece en
> el copy, el sitemap y el JSON-LD) y quedarían sin precio para siempre, porque Airtable
> tampoco las tiene.

El editor lista **todas las plantas con plano** (`getPlateFloors()`), no sólo las que
tienen unidades: en la azotea hay que poder trazar aunque el piso no tenga unidades propias.

Tres cosas que hay que mantener sincronizadas, o el selector queda incompleto:
`FLOOR_ORDER` (make-plates.mjs) = `SITE.floors` (`src/data/site.ts`) = las claves de
`plates.json`. `getFloors()` avisa en dev si `SITE.floors` se olvida de un piso que sí
tiene unidades — es un chequeo de superconjunto, porque estas tres plantas están de más
a propósito.

⚠ `plates:images` **reescribe `src/data/plates.json`**, el mismo archivo donde el editor
de polígonos guarda. Conserva lo ya trazado, pero si lo corrés mientras alguien está
trazando podés pisarle un guardado hecho entre la lectura y la escritura. Corrélo con el
editor cerrado, o revisá el diff después.

### El encuadre del render

**El render llena la pantalla (`cover`), nunca hay franjas.** Lo que sobra se recorta,
hoy **centrado**: mitad arriba y mitad abajo.

La cuenta, que conviene tener a mano porque se la van a preguntar:

| | Ancho × alto | Aspecto | Recorte sobre el render de cualquier vista (4999×2812) |
|---|---|---|---|
| Monitor 1920×1080 | 1920 × 1080 | 1,78 | **cero** |
| Navegador en **pantalla completa** (F11 o el botón ⛶) | 1920 × 1080 | 1,78 | **cero** |
| Navegador **maximizado** (pestañas + barra de direcciones + favoritos + barra de tareas ≈ 175px) | 1903 × 903 | **2,11** | **440px nativos de alto**, 220 arriba (cielo) y 220 abajo (asfalto) |

O sea: el render y la pantalla SÍ son los dos 16:9; el que no lo es es el viewport del
navegador cuando la ventana está maximizada. Un 16:9 no llena un 2,1:1 sin recortar —
la única alternativa es dejar franjas al costado, que se ve peor.

> **Pendiente.** Hubo un ancla (`STOP_CROP_BIAS`) para correr el recorte hacia arriba en
> las dos vistas frontales y perder cielo en vez de vereda: se perdió antes de commitear
> y **no está en el código**. Con el render de 5k del 25-08 el asunto es menor —la puerta
> y su punto 360° quedan holgados—, pero se recuperarían ~77px nativos de calle. Si vuelve
> un render más ajustado, hay que reponerlo.

**El arreglo de fondo es el encuadre del render, no el código.** Si el 3D entrega estas
mismas cámaras con ~440px menos de alto —5000×2375 en vez de 4999×2812— una ventana
maximizada las muestra ENTERAS, sin recortar nada. Y son *menos* píxeles: no cuesta más
tiempo de render. Mientras tanto, para mostrárselo al cliente, el botón ⛶ del sitio pone
el navegador en pantalla completa de verdad y ahí no se pierde un solo píxel.

En **táctil** es al revés: el stage se sobre-dimensiona (`cover` + paneo) porque en un
celular vertical la imagen entraría como una tira finita; ahí el dedo recorre el render.

### El punto 360° del exterior

La "bolita" que flota sobre el render del showroom. Vive en `src/lib/vr-hotspots.ts`,
con las coordenadas en **píxeles nativos del render** (4999×2812), igual que los polígonos.

El cliente marcó **un solo punto** (Miro "Division showroom", 25-08): la puerta del hall,
entre el café y el local. Se ve desde las dos vistas a nivel de calle, así que va en las
dos —es el mismo punto desde otro ángulo—. Las otras tres no llevan bolita: la 2 es un
primer plano de balcones que deja la planta baja fuera de cuadro, y la 3 y la 4 son
contrafrente.

Con el re-render del 27-08 la vista 1 pasó de 4000×2250 a 4999×2812 **sin cambiar el
encuadre** (39,6 dB de PSNR entre los dos masters remuestreados), así que su punto se
convirtió por escala pura: `1390,1520` → `1737,1900`, verificado sobre el JPG nuevo.

Ojo con el borde de abajo: en una ventana maximizada se recortan los últimos ~220px
nativos (ver [El encuadre del render](#el-encuadre-del-render)), así que un `y` muy pegado
al piso queda fuera de cuadro. Por eso la bolita de la vista 0 va en 2400 y no más abajo.
El clamp de `VrHotspot` es sólo la red de seguridad para contenedores muy bajos.

⚠ **`ENTRANCE_HALL_360` y `AMENITIES_360` están en `null`**: TIER Bravo todavía no tiene
360° de espacios comunes. Todo lo que los consume se esconde solo (los items del submenú
Tours y el iframe del modal de Amenities); la bolita se sigue viendo —el cliente la
pidió— pero no abre nada hasta que lleguen. **No reusar las colecciones de otro
proyecto**: son otro edificio.

### Los planos de unidad

Es la imagen de "Plano de la unidad" en la ficha (`unit.floorPlan`). Los renders del
cliente están en `_media-src/tipologias/` con **su nombre original**, que es el que dice
a qué unidades va cada uno: `"PLANTA DEL 1 AL 5TO - 8 Y 5"` = unidades 05 y 08 de los
pisos 1 a 5. Los pares caen exactos sobre el mapeo de recorridos 360° del Miro, que es
la validación cruzada:

| Plano | Unidades | Tipología |
|---|---|---|
| `tipologia-A.webp` | 03 y 10 de los pisos 1-5 | A — monoambiente 34 m² |
| `tipologia-B.webp` | 04 y 09 de los pisos 1-5 | B — monoambiente 34 m² |
| `tipologia-C.webp` | 05 y 08 de los pisos 1-5 | C — 2 amb. 51-52 m² |
| `tipologia-D.webp` | 01 y 07 de los pisos 1-5 | D — 3 amb. 77-82 m² |
| `tipologia-E.webp` | 02 y 06 de los pisos 1-5 | E — 2 amb. 57-58 m² |
| `piso-6-01.webp` / `piso-6-06.webp` | 601 y 606 | 4 amb. de retiro |
| `piso-7-01.webp` / `piso-7-06.webp` | 701 y 706 | 4 amb. de retiro |

Se regeneran con `npm run plans:units` (recorta el lienzo, escala a 1400 px de lado
mayor y reescribe el `floorPlan` de cada unidad). El mapeo vive en `PLANS`, arriba de
`scripts/make-unit-plans.mjs`.

**El 6° reusa las tipologías del piso tipo, con la numeración corrida.** En el 6° las
unidades 01 y 06 son las grandes de retiro y se comen la numeración, así que las seis
chicas quedan un número atrás: `602↔03 · 603↔04 · 604↔05 · 607↔08 · 608↔09 · 609↔10`.
Se verifica por dos caminos independientes que dan lo mismo — la posición de los rótulos
en `piso-6.png` vs `piso-tipo-2-5.png`, y la superficie cubierta de la planilla de venta.
Igual **el cliente no las nombró: lo dedujimos nosotros**, así que conviene que Camila lo
confirme. Está en `INFERRED`, en el mismo script.

**Falta el plano de la 702** (la unidad de arriba a la izquierda del 7°): el cliente
mandó sólo el 01 y el 06 de ese piso. Es la única de las 61 que sigue con el placeholder.

#### Baños: lo que muestran los planos

Los planos del 25-08 y los rótulos `BAÑO` / `TOIL.` de las plantas generales coinciden
entre sí, y **no** con el `baths` de `units.json` (que está por convención). Lo que dicen
los documentos, para las tipologías del piso tipo:

| Tipología | Documentos | `units.json` hoy |
|---|---|---|
| A, B (monoambientes) | 1 baño | `baths: 1` ✔ |
| C (2 amb.) | 1 baño + 1 toilette | `baths: 1` |
| D (3 amb.) | 2 baños + 1 toilette | `baths: 2` |
| E (2 amb.) | 1 baño + 1 toilette | `baths: 1` |

El modelo ya tiene `toilette` aparte de `baths` (`unitTotalBaths()` los suma para el
"N baños" del resumen y la tarjeta desglosa "2 baños · toilette"). **No se aplicó todavía**:
es dato comercial que se publica en la ficha, así que va con el OK del cliente. Los del
6° y 7° hay que contarlos aparte.

### Los frames del flyby

Las flechas del showroom reproducen los frames pre-renderizados del tramo entre dos
vistas, y son también lo que se arrastra al hacer scrub. Desde el drop del 27-08 son
**reales**: el cliente entregó los cuatro tramos en mp4 (1920×1080, 30 fps, 1 s cada uno)
y reemplazaron a los fundidos provisorios.

```bash
npm run flyby:frames -- "_media-src/flyby/tramo-0-1.mp4" 0 1
npm run flyby:frames -- "_media-src/flyby/tramo-1-2.mp4" 1 2
npm run flyby:frames -- "_media-src/flyby/tramo-2-3.mp4" 2 3
npm run flyby:frames -- "_media-src/flyby/tramo-3-4.mp4" 3 4
```

**Sale exactamente lo que trae el video, frame por frame** (`-fps_mode passthrough`): 30
entran, 30 salen. Nada se agrega ni se descarta.

El script regenera el segmento en `flyby.json` **leyendo el disco**, así el conteo nunca
se desincroniza, e imprime el PSNR de empalme contra los stills de los dos extremos. El
aterrizaje tiene que dar **≥30 dB** o se ve un salto al estacionar. Hoy:

| Tramo | Frames | Arranque | Aterrizaje | Peso |
|---|---|---|---|---|
| 0→1 | 30 | 37,39 dB | 33,17 dB | 3,9 MB |
| 1→2 | 30 | 38,12 dB | 35,13 dB | 3,0 MB |
| 2→3 | 30 | 32,44 dB | **16,60 dB** ⚠ | 2,3 MB |
| 3→4 | 30 | 33,79 dB | 33,77 dB | 5,9 MB |

15,5 MB en total. Pesan más que los de Caviahue (9,2 MB con los mismos 30 frames a 1080p y
la misma calidad) porque las escenas son mucho más densas —calle urbana, follaje, ladrillo
texturado—. Bajar la calidad de WebP 78 → 70 ahorra sólo un 15%, así que no vale la pena
moverse del baseline. Los frames no bloquean nada: el preload es en dos fases y sólo
"gatea" la vista inicial.

**El recorrido es lineal, no un anillo.** No hay tramo de vuelta del 4 al 0, así que el
stop 0 no tiene flecha de retroceso y el 4 no tiene de avance. Sale solo: el viewer
deriva las flechas de los segmentos que existen (`segments.find(s => s.from === id)`).

#### Cuándo aparece una flecha

Una flecha se muestra **sólo cuando su tramo está bajado entero y con el head
decodificado** (`warmSegs` en `FlybyViewer`). Mientras tanto, en su lugar va el pill
"Cargando recorrido… %". La regla es: **flecha visible ⇒ arranque instantáneo**, nunca un
control que al tocarlo se queda esperando la red.

El reveal de la vista gatea sólo el still inicial (~0,4 MB), no los ~15 MB de frames — por
eso el showroom aparece rápido y los tramos siguen bajando atrás. Este gate es lo que
evita que esa asimetría se note.

Hasta el 27-08 el gate era **sólo táctil**: en desktop las flechas salían apenas
decodificaba el still, con los 3,9 MB del tramo 0→1 todavía en vuelo, así que un click
apenas entrabas a `/showroom` esperaba la red y a los 350ms mostraba "Preparando la
vista…". Ahora aplica en los dos.

#### ⚠ El tramo 2→3 no llega al stop 3

`Transicion 60-90.mp4` **corta en pleno movimiento**: no desacelera y su último frame queda
a **16,60 dB** del still del stop 3 (los otros tres tramos aterrizan entre 33 y 35 dB). Al
estacionar en el stop 3 se ve un salto.

Se puede confirmar mirando el propio clip: el frame 1 del `90-120` —que es la posición
exacta del stop 3, empalma a 33,79 dB— no es contiguo con el último frame del `60-90`.

Es un problema del render, no del pipeline: **hay que pedir ese tramo de nuevo**, completo
hasta el stop. El script tiene una opción `--land <mp4-del-tramo-siguiente>` que le pega el
frame 1 del clip siguiente como cierre y lo lleva a 33,79 dB, pero agrega un frame y **hoy
no se usa**: los cuatro tramos salen tal cual vienen.

#### Otras opciones del script (hoy sin usar)

Ninguna se aplica a lo que se sirve; están para diagnosticar un clip.

| Flag | Qué hace |
|---|---|
| `--land <mp4>` | Agrega el frame 1 de ese clip como frame de cierre del tramo (ver arriba). |
| `--drop-stalls` | Descarta los frames sin movimiento. Dos clips del 27-08 traen tiras de frames idénticos —43-48 dB entre consecutivos, o sea la misma imagen— al principio del `0-30` y en los dos extremos del `90-120`. Como el visor mapea el progreso linealmente al índice de frame (`frameAtProgress`, sin easing), esos frames se comen ~20% de la transición sin mover la cámara. El criterio se calibra contra el propio clip (`STALL_FLOOR`, 8% del movimiento mediano). |

#### ⚠ El tramo 2→3 tiene marca de agua

`Transicion 60-90.mp4` viene con el logo **KlingAI** abajo a la derecha, en los 30/30
frames (bbox `x 1688..1885 · y 1007..1054` del frame de 1920×1080). Los otros tres clips
están limpios — se verificó con la mediana temporal de cada uno.

**Se dejó a propósito** (27-08): el hermano de Joaquim pidió probar así primero y mandar
el reemplazo limpio si el resultado gusta. Cuando llegue, es sólo volver a correr esa
línea con `--land`; conviene revisar el PSNR de aterrizaje porque el re-export puede
traer también el frame que falta.

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
  gallery/           Los 14 renders: 4 exteriores + amenities + interiores
  tipologias/        Los 9 planos de unidad (con el nombre original del cliente)
  tipology/          Los 5 PDF de tipología de la 1ª entrega (los reemplazan los de arriba)
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
| `npm run plans:units` | `_media-src/tipologias/` → planos de unidad WebP + el `floorPlan` de cada unidad. |
| `npm run brand:logos` | Wordmark TIER → las tres variantes de color de `public/`. |
| `npm run og:generate` | `og.jpg` + todo el set de iconos. |
| `npm run flyby:frames -- <mp4> <from> <to> [--land <mp4>]` | Extrae los frames de un tramo y los cablea en `flyby.json` (+ PSNR de empalme). |
| `npm run gallery:optimize` | `_media-src/gallery/` → WebP + `gallery.json`. |
| `npm run video:mario-bravo` | Comprime un master de video a mp4 + webm + poster. |

---

## Qué falta

### Del cliente

| Qué | Bloquea |
|---|---|
| **Columna `Estado` en Airtable** | Sin ella el contorno de las unidades no refleja disponibilidad: todo se ve libre. Es el pedido más urgente. |
| **Renders con ~440px menos de alto** (5000×2375) | Con 16:9 se recorta el 15,6% del alto en una ventana maximizada. Ver [El encuadre del render](#el-encuadre-del-render) — son *menos* píxeles, no cuesta más tiempo de render. |
| **Dominio de producción** | `PROD_SITE_URL` (`src/lib/seo.ts`), el redirect www→apex de `next.config.ts` y `netlify.toml`, y `NEXT_PUBLIC_SITE_URL`. Hoy tienen un placeholder con la dirección; **desde el rebranding probablemente sea un dominio TIER**. No deployar así. |
| **Tipografía del logotipo** | Camila se lo preguntó al cliente. Sin eso no se pueden armar lockups tipográficos coherentes con el wordmark. |
| **Teléfonos de ventas** | `WHATSAPP_NUMBER` (`src/lib/contact.ts`) está vacío → los CTA abren el selector de contacto. |
| **Casilla de leads + verificar dominio en Resend** | `EMAIL_TO`. Sin dominio verificado, Resend sólo entrega a la cuenta dueña de la key. |
| **¿Los precios son públicos?** | Airtable los trae y hoy viajan en el HTML sin mostrarse. Ver el aviso en [Data en vivo](#data-en-vivo-airtable). |
| **Token de Airtable definitivo** | El actual lo pasó el cliente para probar y va a ser rotado. |
| **Pin exacto del edificio** | `SITE.location` tiene coordenadas aproximadas de la altura 900 de Mario Bravo. |
| **POIs del barrio** | `SITE.pois` está vacío a propósito (inventarlos publica datos falsos). |
| **360° del hall y de los amenities** | Sólo llegaron los 5 de departamento. La bolita del exterior está en su lugar pero **no abre nada**, y los items "Hall"/"Amenities" del menú están ocultos. Ver [El punto 360° del exterior](#el-punto-360-del-exterior). |
| **Recorrido 360° del 6° y 7°** | 11 unidades sin `tour360`. ¿Reusan A–E o llevan el suyo? |
| **`Transicion 60-90.mp4` sin la marca KlingAI** | Es el tramo 2→3. Se dejó con marca a pedido del cliente para probar; el reemplazo limpio queda pendiente. Ver [Los frames del flyby](#los-frames-del-flyby). |
| **Video de intro** | La portada `/` está en modo still. Con `public/intro.mp4` + `intro-mobile.mp4` poné `INTRO_VIDEO_READY = true` en `IntroScreen.tsx`. |
| **Copy de "Un equipo con trayectoria"** | El cliente pidió dejar los tres logos TIER (Bravo, Avenue, Sinclair). El texto que los acompaña lo escribimos nosotros y conviene que lo apruebe. |
| **¿Cómo etiquetar la 706?** | Es pasante (dormitorios al contrafrente, estar a la calle). Hoy no muestra chip de exposición. Si la quieren rotulada, decidir si va como "Frente", "Contrafrente" o si sumamos un valor "Pasante". |
| **Plano de la unidad 702** | Del 7° mandaron sólo el 01 y el 06. Es la única de las 61 sin plano. |
| **Confirmar la numeración corrida del 6°** | Deducimos que `602↔03 · 603↔04 · 604↔05 · 607↔08 · 608↔09 · 609↔10`. Ver [Los planos de unidad](#los-planos-de-unidad). |
| **OK para corregir los baños** | Los planos dicen que la C, la D y la E tienen un toilette además del baño. Ver [Baños](#baños-lo-que-muestran-los-planos). |
| **Brochure comercial** | `BROCHURE_URL` es `null` → el item del menú y el botón "Ver PDF" están ocultos. |
| **Logo de Estudio Mizraji** | Va en "El Equipo". El drop sólo trajo el de CCM. |
| **Media del barrio** | La sección de entorno del menú está oculta (`HAS_DESTINATION_MEDIA`). |

### Del lado nuestro

1. **Trazar los polígonos**: las vistas 1 a 4 (la 0 ya tiene sus 24) + el piso 2 (y
   clonar a 3-5) + los pisos 1, 6 y 7.
2. **Copy del cliente cargado el 26-08.** Especificaciones (Arquitectura y Los
   Departamentos), los cuatro paneles de "El Proyecto" (Amenities, Calidad y Tecnología,
   Financiación, Beneficios), la hoja de Amenities, el resumen de la unidad y "Hablemos",
   en ES y EN. Lo único que queda con prosa de Caviahue es el namespace `t.caviahue`
   ("Conocé Caviahue"), que **no se renderiza**: el item del menú está gateado por
   `HAS_DESTINATION_MEDIA` hasta que lleguen las fotos del barrio. Se reescribe cuando
   se active.

---

## Deploy

Prod pensado para un host con Node (SSR): `npm run build` + `npm start`. `netlify.toml` y
`public/_headers` traen la cache larga de `/frames/*`, `/stops/*` y `/gallery/*` — sin ella
el navegador re-baja los frames tras un rato idle y la transición "teletransporta" en vez
de animar. Verificar post-deploy con `curl -I`.

En producción **no** seteés `ENABLE_POLYGON_EDITOR`: sin esa var, todo `/admin/*` y
`/api/admin/*` devuelve 404.
