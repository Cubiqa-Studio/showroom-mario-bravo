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
| `/showroom` | Las 5 vistas del edificio, flechas para girar, polígonos clicables por unidad. |
| `/residencia/[id]` | Ficha de la unidad. Como overlay sobre el showroom o como página propia. |
| `/admin/polygon-editor` | Editor de polígonos — herramienta interna, apagada por defecto. |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | Metadata routes. |

### La portada `/` y la vuelta desde el showroom

`/` no es la puerta de TIER Bravo: es el índice de los **tres** desarrollos de TIER
(Sinclair, Bravo, Avenue). Hoy sólo Bravo tiene a dónde llevar; Avenue va a vivir en
otro dominio. De ahí que el showroom necesite una salida de vuelta, y que esa salida
esté en dos lugares:

| Dónde | Desde | Por qué ahí |
|---|---|---|
| Flecha al lado del logotipo, arriba a la izquierda | 560px | Sobra lugar y es donde cualquiera la busca. |
| Flecha dentro de la pastilla de "Disponibilidad" (2º renglón) | 341-559px | **La primera fila NO tiene lugar**: medido, quedan 8px libres a 320px y también a 412, donde el rótulo "Consultar" ensancha la pastilla de acciones. |
| Item "Volver a TIER Desarrollos" en el menú | siempre | Es la única salida por debajo de 341px, donde la flecha no entra en ningún renglón. |

⚠ **No se puede reusar el logotipo del showroom para volver a `/`**: su click ya es
"volver a la primera vista", que es la ÚNICA forma de resetear el recorrido (el item
"Inicio" del menú sólo cierra el menú).

**Al entrar a un proyecto, el panel avisa.** `/showroom` es `force-dynamic` y espera a
Airtable, así que el click tarda. `useLinkStatus()` ya ponía un spinner en el CTA, pero
mide 13px y en escritorio el `<Link>` es el panel COMPLETO: se puede clickear a 400px
del botón. Ahora, mientras la navegación está en vuelo, `MarcaEntrando` le pone
`data-entrando` al panel y eso apaga los otros dos, deja el CTA visible aunque el
puntero se haya ido, pasa el cursor a `progress`, corre un barrido dorado arriba y
anuncia "Entrando…" al lector de pantalla.

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
| `/admin/polygon-editor/0` … `/4` | Los polígonos de cada una de las 5 vistas del showroom. |
| `/admin/polygon-editor/plano/SS`, `/0`, `/1` … `/8` | Los polígonos de cada planta (incluye subsuelo, PB y azotea). |

**Cómo se guarda.** El editor postea a `/api/admin/*`, que en local escribe directo a
`src/data/stops.json` / `plates.json`. Eso es lo que se commitea, y en producción **ese
JSON es la fuente de verdad**. Después de trazar: revisá el diff y commiteá.

**Reglas del trazado:**

- Los puntos van en **píxeles nativos** de cada imagen (`4999×2812` las cinco vistas del
  showroom; cada planta tiene los suyos, ver la tabla de más abajo). El editor ya trabaja
  en ese espacio.
- El `unitId` tiene que existir como key de `units.json` — el editor avisa con un ⚠ si no.
  El desplegable trae las 63.
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

### Las 63 unidades

`src/data/units.json` — key = `<piso><UF>` como **texto**:

```
1° a 5°   101…110, 201…210, 301…310, 401…410, 501…510   (10 c/u)
6°        601…610                                       (10 — ver el aviso de abajo)
7°        701 702 706                                   (3 — piso de retiro)
```

Sale de `MB 955 - UNIDADES EN VENTA.pdf`; las superficies dan exacto contra los TOTALES
del PDF, **salvo la 605 y la 610**, que no están en ese PDF y las sumó el cliente por
Airtable el 30-08 (ver el aviso más abajo). Ese `unitId` es **la clave de join de todo**: `polygon.unitId` ↔ key de
`units.json` ↔ columna `Unidad` de Airtable.

Cargado: `residence`, `beds`, `ambientes`, `areas`, `sqft`, `status`, `exposure`, y
—desde el mapeo de Camila— `tipologia` + `tour360` en los pisos 1 a 5. Pendiente:

- `price` en `units.json` queda en `"Consultar"`: los precios reales llegan EN VIVO
  desde Airtable (ver más abajo), no hardcodeados. Sin Airtable el sitio no muestra precio.
- `baths` está puesto por convención (1 para mono y 2 amb., 2 para 3 y 4 amb.). **No sale
  de ningún documento del cliente**, y los planos que llegaron el 25-08 dicen otra cosa:
  ver [Baños: lo que muestran los planos](#baños-lo-que-muestran-los-planos).
- `floorPlan`: cargado en las 63. Ver [Los planos de unidad](#los-planos-de-unidad).

> ⚠ **La 605 y la 610 las agregó el cliente el 30-08 y NO están en su propio plano del 6°.**
> Ese plano (`6TO PISO.png`, rotulado por ellos) tiene **ocho** departamentos: 01, 02, 03,
> 04, 06, 07, 08 y 09 — sin 05 ni 10. La aritmética lo confirma: el 601 (161,6 m²) es el
> 01+02 del piso tipo (95,6 + 68,35) y el 606 (157,6) el 06+07 (69,9 + 86,85), o sea que
> las dos unidades de retiro **se comen dos departamentos cada una** y por eso la
> numeración salta. Aun así Juani pidió cargarlas (2 amb. de 60,60 m² y monoambiente de
> 39,70), así que están, con los valores que él cargó en Airtable.
>
> **Consecuencia visible:** la planta del 6° tiene ocho polígonos para diez unidades, así
> que a la 605 y la 610 se llega por el showroom (vistas 04 y 05, que ya las tienen
> trazadas), por el buscador y por URL, pero **no se pueden clickear en "Planta del piso"
> ni en el Plan Maestro**: no hay dónde dibujarlas sin encimarlas a otra. Se destraba con
> un plano del 6° actualizado.

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
- Sin `tour360` (las 13 del 6° y 7°) → `DEFAULT_HERO_VIEWS`: la **fachada** grande y
  **cocina, dormitorio y living** en los tres mosaicos del header. Lo eligió el cliente
  el 26-08.
- Una unidad puede traer su propia `gallery` en `units.json` y pisa el default.

⚠ `DEFAULT_HERO_VIEWS` y los `previewImage` de `vr-hotspots.ts` son rutas **escritas a
mano** a archivos que genera el script. Si se renombra un original en `_media-src`, hay
que actualizarlas — una ruta rota no rompe el build, sólo deja una imagen fantasma.

### La hoja de Amenities

Un solo componente (`AmenitiesModal`) con **dos pestañas**, y se abre desde dos lados:

| Desde | Cómo |
|---|---|
| Showroom | item "Amenities" del sidebar |
| Ficha de una unidad | botón **"Ver amenities"** en la fila Amenities del resumen (31-08) |

- **Recorrido 360°** — el iframe de Kuula (`AMENITIES_360`). ⚠ **No se desmonta al
  cambiar de pestaña**, se esconde con `hidden`: volver a montarlo recarga el tour entero
  y en táctil obliga a pasar otra vez por la pantalla de título de Kuula.
- **Galería** — los nueve renders de espacios comunes (`AMENITIES_GALLERY`, en
  `src/lib/amenities-gallery.ts`). Dos columnas en celular, tres de tablet para arriba.
  Al tocar uno abre el MISMO visor grande que la galería del proyecto, ya acotado a los
  amenities; va a `z-160`, sobre la hoja (`z-150`), así que se abre encima sin cerrarla.

La barra de pestañas sólo aparece si están las dos cosas: sin tour queda la galería
sola, sin renders queda el tour solo, y en los dos casos sin barra.

⚠ **`.res-landing.sheet` lleva `min-width: 0`, y no es decorativo.** Como ítem flex su
mínimo por defecto es el ancho MÍNIMO DE SU CONTENIDO, así que cualquier cosa adentro que
no sepa achicarse estira la hoja más allá del overlay — y como el overlay es
`overflow: hidden`, eso no se ve como scroll sino como contenido cortado. Pasó con el
mosaico: la primera versión usaba `repeat(auto-fill, minmax(min(300px, 100%), 1fr))`, el
`min()` con porcentaje se resolvía contra el ancho de la propia grilla (que todavía no
estaba decidido) y la hoja medía **1012px sobre un viewport de 390**. Es el mismo
mecanismo que el `nowrap` de la fila de amenities del resumen.

### Terraza propia (el último piso)

`unit.terraza` (bool). Las **tres unidades del 7°** —701, 702 y 706— tienen terraza
privada en la azotea: su escalera propia sale en el plano del 8° (por eso esa planta
lleva polígonos que apuntan al 7°) y entre **120 y 129 m² descubiertos**, contra los
40-44 de "balcón terraza" de las de retiro del 6°, que **no** llevan el chip. Lo pidió
Juani el 30-08: "en violetita como hiciste en Caviahue con los que eran duplex".

Se ve como un chip violeta en la tarjeta de unidad (junto a estado y exposición) y como
etiqueta en el buscador. ⚠ A diferencia del dúplex, **no entra en `unitFillColor`**: el
relleno del polígono comunica DISPONIBILIDAD y pintarlo de violeta la taparía.

> Pendiente: **el plano de la terraza en la ficha**. Juani lo pidió el 30-08 para que la
> pestaña "Plano de la unidad" del 7° muestre también la terraza, pero Camila todavía no
> separó el plano individual de cada una. Cuando lleguen, entran por `unit.floorPlan`
> (o una segunda imagen) — no está hecho a propósito.

### Exposición: frente y contrafrente

`unit.exposure` (`"frente"` | `"contrafrente"`). Pedido del cliente el 25-08: el mismo
tratamiento que el chip de dúplex. Sale de las plantas —**Airtable no tiene columna de
orientación**, verificado contra la base— así que vive en `units.json` y se carga con
`npm run units:exposure`.

| | Unidades |
|---|---|
| **Frente** (Mario Bravo) | 24 — la 01, 02, 06 y 07 de los pisos 1 a 5, más 601, 606, 701 y 702 |
| **Contrafrente** (pulmón: pileta, deck y parque) | 38 — la 03, 04, 05, 08, 09 y 10 de los pisos 1 a 5, más 602-605 y 607-610 |
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
verde/ámbar de disponibilidad; la exposición la tienen las 63 unidades, así que pintaría
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
superficies de las 63 unidades; `units.json` es el fallback si Airtable se cae o tarda
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
| `Estado` | `status` | valores `Disponible` / `Reservada` (el mapeo es por prefijo, así que "Reservado" también entra) |

> ✅ **La columna `Estado` ya existe** (la creó el cliente el 31-08). Es la que pinta el
> contorno de cada unidad —verde disponible / ámbar reservada— y la que alimenta el filtro
> "Disponibilidad" del buscador. Verificado contra la base el 31-08: las 63 unidades
> traen `Estado`, las 63 resuelven, y los ids coinciden uno a uno con `units.json` (ni
> sobra ni falta ninguna). Hoy están las 63 en "Disponible".
>
> El mapeo es por PREFIJO (`mapEstado`): cualquier cosa que empiece con "dispon" es
> disponible y con "reserv" es reservada, así que "Reservado" y "Reservada" entran las
> dos. Un valor que no matchee ninguno de los dos NO rompe: cae al estado de
> `units.json`. También se aceptan los alias `Estado de la unidad` y `Disponibilidad`.
>
> Probado de punta a punta: forzando una unidad a "Reservada" su polígono pasa de
> `#22c55e` a `#eab308` y su tarjeta dice "Reservada", con el resto del piso intacto.

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
| **Links crawleables** del bloque SEO del showroom (63 `<a>`, `sr-only`) | ✅ anda |
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
| 3 | Contrafrente ancho con pileta | `View 03` (v2 del 29-08) |
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

⚠ **La tarjeta toma la proporción del plano, no una fija.** Mirá la última columna: los
espacios van de 0,56:1 (planta baja) a 1,51:1 (azotea), y casi todos rondan 0,93 — o sea
VERTICALES. La tarjeta estaba clavada en `aspect-ratio: 1100/740` (1,49, apaisado), que
sólo le quedaba bien a la azotea; como el SVG usa `preserveAspectRatio="meet"`, el resto
entraba por ALTO y dejaba media tarjeta vacía a los costados. En un teléfono eso daba una
caja de 380×256 con el plano ocupando la mitad del ancho.
Hoy `FloorPlate.tsx` inyecta `--plate-ar` = `imageWidth / imageHeight` del piso actual, y
el CSS lo usa para el `aspect-ratio` y para derivar el ancho de un tope de alto
(`--plate-max-h`, y en el Plan Maestro `100dvh − chrome`). Sirve para los dos lugares
donde se muestra la planta —la pestaña de la ficha y el Plan Maestro del menú—, porque
los dos montan el mismo `<FloorPlate>`. **Si mañana entra un plano con otra proporción,
no hay que tocar nada**: sale de `plates.json`.

`--plate-max-h` por pantalla: `78vh` de escritorio, `max(300px, calc(100svh - 190px))` en
≤720px de ancho, y `calc(100svh - 40px)` en ≤560px de **alto** (celular acostado, que
entra por "ancho de tablet": con el `78vh` de escritorio la tarjeta quedaba en 321px y el
dibujo en ~250 de ancho sobre una pantalla de 915 — "se ve super chico", 30-08).

**Las plantas se cachean a nivel de MÓDULO** (`plantasResueltas` / `imagenesListas` en
`FloorPlate.tsx`), no por componente. `/api/plate/:floor` es `force-dynamic` —lee el Blob
de Netlify y Airtable—, así que sin cache cada cambio de piso volvía a pedirla y mostraba
el spinner otra vez, **incluso al volver a un piso ya visto** ("es super molesto y tosco
de ver", 30-08). Guardado fuera del componente, la pestaña de la ficha y el Plan Maestro
comparten lo mismo: se paga una vez por piso y por sesión. Además:

- al entrar a un piso se **precalientan los dos vecinos** (JSON + decode de la imagen),
  que son los únicos alcanzables con las flechas → avanzar y retroceder no vuelve a
  mostrar el spinner nunca;
- las **pastillas de piso** precalientan en `pointerenter` / `pointerdown`, que llega
  ~100ms antes del click, porque saltan a cualquier piso;
- **no** se precargan las diez de una: entre todos los planos son 3,2 MB (la PB sola
  pesa 1) y en un celular eso se paga. La primera vez que se salta a un piso lejano por
  pastilla puede haber spinner; a partir de ahí no.

**El marcador de cada unidad** (el círculo con el número que muta a "+" en hover) se
pide en **píxeles de PANTALLA** (`R_PANTALLA` en `FloorPlate.tsx`) y se convierte a
unidades del plano con la escala real de render, medida con un `ResizeObserver`. Antes
salía de `min(w,h) × 0,019` —el tamaño NATIVO del plano— y eso rompía por dos lados:
el mismo marcador medía 24px en escritorio y **9 en un celular**, y `min(w,h)` castigaba
a los planos apaisados (la azotea sacaba un radio 34% menor que el piso tipo aunque se
dibuja igual de grande). Hoy mide 34px de diámetro en TODOS los casos.
**Dónde se planta.** No en el centroide, sino en el **polo de inaccesibilidad**: el punto
interior más lejano de cualquier borde, lo mismo que usan los mapas para colocar la
etiqueta de un país. El centroide de una unidad en L o en T cae cerca del recodo —o
directamente sobre el hueco que la L abraza—, y con el disco a 34px se derramaba fuera
del dibujo: el marcador del 706 quedaba sobre el patio (31-08). Con el polo, la holgura
del 706 pasa de 56 a 268 px de plano y la del 702 en la azotea de 63 a 200. Cuesta 18ms
para las ocho plantas enteras y va memoizado por planta.

Dos redes de seguridad acotan el radio, las dos por planta:

- `HOLGURA_VECINOS` — nunca más del 40% de la distancia entre los dos marcadores más
  próximos, así dos discos no se tocan. Apenas aprieta: el par más cercano de un piso
  tipo está a 189px de plano.
- `HOLGURA_BORDE` — nunca más del 90% del aire que tiene el marcador **más justo** de la
  planta hasta su propio contorno, así ninguno se derrama. Hoy no llega a activarse. Se
  toma el mínimo de toda la planta, y no uno por unidad, a propósito: los marcadores de
  un mismo plano tienen que medir todos igual.

Verificado en el DOM con `isPointInFill` (el centro del disco + 16 puntos de su borde,
contra el `<polygon>` de cada unidad): **0 marcadores fuera** en las 8 plantas × celular,
tablet y escritorio.

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

**Qué abre la bolita.** Desde el 30-08 abre el recorrido de **amenities**
(`AMENITIES_360`, colección `7TyxW` — verificado: el título es "MARIO BRAVO - AMENITIES").
Lo pidió Joaquim así: el cliente mandó ese link y va en la bolita de las vistas 01 y 02.
El preview del hover es un **mosaico de tres renders de amenities** (pileta grande arriba,
gimnasio y SUM al 50% abajo), no el lobby: lo que se ve tiene que ser lo que se abre.
Entra en la MISMA caja de siempre —16/10 del ancho de la tarjeta— así que el globo no
crece; lo arma `previewImages` (`[grande, chica, chica]`) en `vr-hotspots.ts`. ⚠ Las tres
`<img>` llevan `min-h-0`: un `<img>` es un ítem de grilla con tamaño intrínseco y su
`min-height: auto` no deja achicar la fila (medido: 171 + 73 sobre 160 de alto). La misma constante enciende sola
el item "Amenities" del submenú Tours y el iframe del modal de Amenities.

⚠ **`ENTRANCE_HALL_360` sigue en `null`**: el 360° del hall no llegó. Todo lo que lo
consume se esconde solo (el item "Hall" del submenú Tours). **No apuntarlo al de
amenities ni reusar la colección de otro proyecto**: son otro edificio.

En apaisado la bolita se **achica y baja** hasta apoyarse justo arriba de las flechas
‹ GIRAR ›. No es un capricho: con 412px de alto la puerta cae *detrás* de los controles
(el vano va de y≈355 a y≈403 en pantalla y las flechas ocupan 340-388), así que no hay
forma de dejarla dentro del vano sin encimarla a los botones. Los tres números viven en
`VrHotspot.tsx` (`PANTALLA_BAJA`, `ESCALA_COMPACTA`, `BANDA_FLECHAS`).

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
| `piso-7-01.webp` | 702 — **prestado del 701**, ver abajo | 4 amb. de retiro |

Se regeneran con `npm run plans:units` (recorta el lienzo, escala a 1400 px de lado
mayor y reescribe el `floorPlan` de cada unidad). El mapeo vive en `PLANS`, arriba de
`scripts/make-unit-plans.mjs`.

⚠ **Son tiras muy verticales** — 1400 px de alto y entre 516 y 729 de ancho, o sea de
0,37:1 a 0,52:1. A ancho completo en un teléfono, la tipología A pedía **939 px de
alto sobre un viewport de 915**: no entraba entera en pantalla y la ficha se sentía
interminable. Por eso la imagen lleva **tope de alto** en `residencia.css`, distinto
según la pantalla:

| Pantalla | Tope | Por qué |
|---|---|---|
| `≤720px` de ancho (celular parado) | `min(500px, calc(100svh - 220px))` | 500 es la palanca: el cliente lo quería más chico ("la landing tiene el plano gigante"). |
| `≤560px` de **alto** (celular acostado) | `min(420px, calc(100svh - 40px))` | Entra por "ancho de tablet" y tomaba el tope de escritorio (620 + 88 de padding = 708px de tarjeta sobre 412 de pantalla). |
| resto | `620px` | Escritorio, sin cambios. |

⚠ **`svh` y NO `dvh`**: `dvh` es el alto *dinámico* y **crece** cuando el navegador
esconde su barra de direcciones al scrollear — con `dvh` el plano cambiaba de tamaño en
plena lectura, como un salto visual.

**El 6° reusa las tipologías del piso tipo, con la numeración corrida.** En el 6° las
unidades 01 y 06 son las grandes de retiro y se comen la numeración, así que las seis
chicas quedan un número atrás: `602↔03 · 603↔04 · 604↔05 · 607↔08 · 608↔09 · 609↔10`.
Se verifica por dos caminos independientes que dan lo mismo — la posición de los rótulos
en `piso-6.png` vs `piso-tipo-2-5.png`, y la superficie cubierta de la planilla de venta.
Igual **el cliente no las nombró: lo dedujimos nosotros**, así que conviene que Camila lo
confirme. Está en `INFERRED`, en el mismo script.

La **605** y la **610** (altas del 30-08) NO entran en esa lógica —no existen en el plano
del 6°, ver el aviso de [Las 63 unidades](#las-63-unidades)— y se emparejan por POSICIÓN
del piso tipo, que es lo que dicen sus superficies: `605↔05` (tipología C, 60,60 m²) y
`610↔10` (tipología A, 39,70). Van en el mismo `INFERRED`. ⚠ Si algún día llega un plano
del 6° con diez unidades, **revisá el mapeo entero**: puede que las corridas sean las que
están mal.

⚠ **La 702 usa el plano del 701.** El cliente mandó sólo el 01 y el 06 del 7°
(`_media-src/tipologias/`), así que la 702 quedó con el placeholder hasta el 30-08, que
Joaquim pidió ponerle "el mismo plano que el otro del piso 7". Es una aproximación
razonable —las dos son 4 amb. / 3 dorm. / 2 baños y, sobre `piso-7.webp`, la 02 es la 01
**espejada en vertical**: mismo orden estar-comedor → cocina → 3 dormitorios, con la
terraza arriba en vez de abajo— pero **no es el dibujo de la 702**: está espejado y las
superficies no coinciden (229 m² contra 217,65). Sigue pendiente pedirle a Camila el
"PLANTA 7MO PISO - 02"; cuando llegue, entra por `npm run plans:units`.

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
vistas, y son también lo que se arrastra al hacer scrub. Desde el drop del 29-08 el
recorrido es un **ANILLO CERRADO**: llegó el tramo de vuelta (`Transicion 120-150`,
del stop 4 al 0), así que se puede girar el edificio entero sin fondo de saco.

```bash
npm run flyby:frames -- "_media-src/flyby/tramo-0-1.mp4" 0 1 --land "_media-src/flyby/tramo-1-2.mp4"
npm run flyby:frames -- "_media-src/flyby/tramo-1-2.mp4" 1 2 --land "_media-src/flyby/tramo-2-3.mp4"
npm run flyby:frames -- "_media-src/flyby/tramo-2-3.mp4" 2 3 --land "_media-src/flyby/tramo-3-4.mp4"
npm run flyby:frames -- "_media-src/flyby/tramo-3-4.mp4" 3 4 --land "_media-src/flyby/tramo-4-0.mp4"
npm run flyby:frames -- "_media-src/flyby/tramo-4-0.mp4" 4 0 --land "_media-src/flyby/tramo-0-1.mp4"
```

El script regenera el segmento en `flyby.json` **leyendo el disco**, así el conteo nunca
se desincroniza, e imprime el PSNR de empalme contra los stills de los dos extremos. El
aterrizaje tiene que dar **≥30 dB** o se ve un salto al estacionar. Hoy:

| Tramo | Frames | Arranque | Aterrizaje | Peso |
|---|---|---|---|---|
| 0→1 | 31 | 37,39 dB | 38,12 dB | 4,0 MB |
| 1→2 | 31 | 38,12 dB | 34,61 dB | 3,1 MB |
| 2→3 | 31 | 34,61 dB | 27,39 dB | 2,6 MB |
| 3→4 | 31 | 27,39 dB | 30,29 dB | 3,9 MB |
| 4→0 | 31 | 30,29 dB | 37,39 dB | 2,5 MB |

Fijate que **el aterrizaje de cada tramo es idéntico al arranque del siguiente**. Esa es la
firma de un anillo bien armado: cada stop está representado por UN frame, compartido como
último de un tramo y primero del otro. Si esos dos números dejan de coincidir, algo se
desincronizó.

Los 27,39 dB del stop 3 son el único valor bajo el umbral y **no son un defecto**: se midió
el desplazamiento óptimo entre el still y el frame del video y da **0,0 px** — no hay
corrimiento. Es detalle fino, el render de `View 03` tiene follaje denso y la pileta, y un
video de 1080p no puede reproducir esa textura. El crossfade de aterrizaje lo tapa; el
cliente lo probó y no se ve nada.

17 MB en total. Pesan más que los de Caviahue (9,2 MB con 30 frames a 1080p y la misma
calidad) porque las escenas son mucho más densas —calle urbana, follaje, ladrillo
texturado—. Bajar la calidad de WebP 78 → 70 ahorra sólo un 15%, así que no vale la pena
moverse del baseline. Los frames no bloquean nada: se precargan desde la intro y el
preload del visor es en dos fases.

#### ⚠ El cliente entrega cada clip UN FRAME CORTO — por eso todos llevan `--land`

El master viene cortado en clips de 30 frames (`0-30`, `30-60`, … `120-150`) y **el corte
se lleva el frame del stop**: el clip N termina uno ANTES y la posición exacta del stop
destino es el frame 1 del clip N+1.

No es una teoría: se midió en los cinco tramos y el patrón es sistemático. En los cinco, el
primer frame del clip siguiente empalma con un paso **más suave que el paso mediano del
propio clip** — o sea que agregarlo no es un salto, es un frame más de movimiento normal.
Y en los cinco, ese frame matchea el still mucho mejor que el último frame del clip:

| Tramo | Último frame del clip | Frame 1 del siguiente |
|---|---|---|
| 0→1 | 33,17 dB | **38,12 dB** |
| 1→2 | 35,13 dB | 34,61 dB |
| 2→3 | 20,78 dB | **27,39 dB** |
| 3→4 | 27,88 dB | **30,29 dB** |
| 4→0 | 16,94 dB | **37,39 dB** |

El caso que lo hace evidente es el 4→0: sin el frame de cierre, el último frame que se
sirve todavía tiene la cámara en movimiento —el edificio corrido a la izquierda y el árbol
barrido— y al estacionar pegaba un tirón al centro. Con `--land` aterriza a 37,39 dB.

El arreglo de fondo es upstream: pedir los clips **incluyendo su frame de destino**. Con
eso se saca el `--land` de los cinco comandos y cada tramo vuelve a 30 frames.

#### Hacia dónde apunta cada flecha

Lo decide el campo **`dir` de cada segmento** en `flyby.json`, que es *hacia qué lado manda
la CÁMARA ese movimiento*. Un solo dato gobierna las tres cosas, así que no pueden
contradecirse:

- el **chevron** de la flecha de avanzar (el de volver es el opuesto, porque volver
  reproduce el mismo tramo al revés);
- la **posición** en la fila: la que mira a la izquierda va a la izquierda de "Girar";
- el **sentido del arrastre**, con lógica de "agarrá y tirá": tirás la escena para un lado
  y la cámara va al contrario.

En TIER Bravo los cinco tramos van en `"right"`: **avanzar es la flecha derecha, y
arrastrar hacia la izquierda avanza**.

Se había asumido al revés (`"left"`, avanzar con la flecha izquierda) y lo corrigió Juani
el 27-08. La prueba está en el render: yendo de la vista 1 a la 2 quedás **por detrás** de
la puerta del garaje, no por delante — si la cámara fuera hacia la izquierda sería al
revés. Medido sobre los frames, el contenido barre hacia la izquierda, que es lo mismo
dicho al revés. (El 0→1 es un zoom-in fuerte donde esa lectura es ambigua, pero va
uniforme con el resto: partir las flechas a mitad del recorrido se siente peor que
cualquier imprecisión óptica.)

⚠ Antes el chevron estaba **hardcodeado** en el JSX e ignoraba `dir`, así que la flecha y
el arrastre podían apuntar a lados distintos. Ahora los dos leen el dato.

#### Cuándo aparece una flecha

Una flecha se muestra **sólo cuando su tramo está bajado entero y con el head
decodificado** (`warmSegs` en `FlybyViewer`). Mientras tanto, en su lugar va el pill
"Cargando recorrido… %". La regla es: **flecha visible ⇒ arranque instantáneo**, nunca un
control que al tocarlo se queda esperando la red.

El reveal de la vista gatea sólo el still inicial (~0,4 MB), no los ~15 MB de frames — por
eso el showroom aparece rápido y los tramos siguen bajando atrás. Este gate es lo que
evita que esa asimetría se note.

⚠ **El pill tiene retardo de aparición y duración mínima** (`NAV_PILL_DELAY_MS` 600 ms /
`NAV_PILL_MIN_MS` 500 ms), y esto NO es cosmético. `warmSegs` arranca vacío en cada
montaje, así que la condición cruda se cumple **siempre** por un instante — incluso con
todo en la cache del disco (F5, volver de una ficha) o viniendo del precalentado de la
intro, donde los frames resuelven en decenas de milisegundos. Sin el retardo el pill
parpadeaba en cada carga y **siempre decía "0%"**, que es exactamente cuando no tenía
nada para informar. Con él, sólo aparece cuando de verdad hay una descarga esperando — y
para entonces el porcentaje ya es un número real.

Hasta el 27-08 el gate era **sólo táctil**: en desktop las flechas salían apenas
decodificaba el still, con los 3,9 MB del tramo 0→1 todavía en vuelo, así que un click
apenas entrabas a `/showroom` esperaba la red y a los 350ms mostraba "Preparando la
vista…". Ahora aplica en los dos.

#### `--drop-stalls`, la otra opción del script (hoy sin usar)

Descarta los frames **sin movimiento**. Los clips del 27-08 traían tiras de frames
idénticos —43-48 dB entre consecutivos, o sea la misma imagen— al principio del `0-30` y en
los dos extremos del `90-120`. Como el visor mapea el progreso linealmente al índice de
frame (`frameAtProgress`, sin easing), esos frames se comían ~20% de la transición sin
mover la cámara. El criterio se calibra contra el propio clip (`STALL_FLOOR`, 8% del
movimiento mediano), no en dB absolutos: cada tramo tiene su velocidad.

**Está apagado**: el cliente prefiere que salga tal cual viene el video, y los clips del
29-08 vienen bastante mejor. Queda para diagnosticar un clip que se vea a los tirones.

#### La marca de agua de KlingAI: RESUELTA

El `Transicion 60-90.mp4` del 27-08 traía el logo **KlingAI** abajo a la derecha en los
30/30 frames. El re-export del 29-08 llegó **limpio**, y se verificó con la mediana
temporal de los cinco clips: cero píxeles blancos fijos en esa esquina en todos.

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

### La escala tipográfica

**El público de estos showrooms son compradores grandes con la vista cansada**, y el
cliente lo marcó tres veces. No es una preferencia estética: es el requisito de
accesibilidad que manda en este proyecto. Ante la duda, más grande.

Se subió en tres rondas (26-08 dos veces, 27-08 la definitiva pidiendo "20-30% más").
Hoy los tamaños de lectura están **~25% por encima** de donde arrancaron y los títulos
~15%: crece más abajo que arriba, porque un display de 36px un 30% más grande grita y
rompe el layout, y lo que cuesta leer es el cuerpo, no los títulos.

…pero eso vale para el ESCRITORIO. Un teléfono de 360-412px no es un monitor de 1400:
el 29-08 Joaquim reportó que en celular la barra del showroom tapaba media foto y los
textos quedaban gigantes. Así que la escala es **responsive, en cuatro escalones**, y en
el más chico sigue estando ~8-10% por encima del default de Tailwind (17px de lectura
contra 16): la pauta del cliente se respeta, lo que se corrige es el tamaño relativo.

| Escalón | Ancho | `--text-base` | `--fs-k` |
|---|---|---|---|
| Escritorio | > 1180px | 20px | 1 |
| Tablet | 721-1180px | 17.5px | 0.9 |
| Celular | ≤ 720px | 17px | 0.85 |
| Celular chico | ≤ 400px | 16px | 0.81 |

Dos palancas, y nada más:

| Dónde | Qué cubre |
|---|---|
| `--fs-xs … --fs-7xl` en el `:root` de `src/app/globals.css` | Todo el chrome: showroom, menú, buscador, pills, tarjetas |
| `--fs-k` (mismo `:root`) | La ficha de unidad: `residencia.css` tiene ~160 `font-size` envueltos en `calc(<px> * var(--fs-k))` |

⚠ **Los px van en `:root`, NO en `@theme`.** En Tailwind 4, `@theme inline` mete el
VALOR dentro de la utilidad —emite `.text-xs { font-size: 17.5px }`— así que una media
query sobre `--text-xs` no cambia nada: es el motivo por el que la escala no era
responsive hasta el 29-08. Declarando los px en `:root` y dejando en `@theme` sólo la
referencia (`--text-xs: var(--fs-xs)`), Tailwind emite `font-size: var(--fs-xs)` y los
bloques por breakpoint sí pegan. Es el mismo truco que ya usaban los colores
(`--color-gold: var(--gold)`). Se verifica en un segundo:

```bash
curl -s http://localhost:3000/_next/static/css/app/layout.css | grep -o 'font-size: *var(--fs-[a-z0-9]*)'
```

⚠ **Hay que definir la escala ENTERA, no sólo `xs`/`sm`.** Los defaults de Tailwind no se
mueven, así que tocar sólo los escalones chicos deja `text-sm` más grande que `text-base`
y **se invierte la jerarquía**. Las `line-height` de Tailwind 4 son RAZONES
(`calc(1.25 / 0.875)`), no valores fijos, así que acompañan solas en los cuatro escalones.

⚠ **Un `font-size` nuevo en `residencia.css` va envuelto en `calc(… * var(--fs-k))`**, o
queda clavado en su tamaño de escritorio también en el teléfono. Lo mismo con los
literales tipo `text-[15px]` en TSX: no siguen la escala.

**El lockup TIER/BRAVO del showroom queda afuera a propósito**: es una marca calibrada
contra el alto del logotipo (un PNG), no copy. Crecer sólo el texto rompería la
alineación. Si hay que agrandarlo, se agrandan las dos cosas juntas.

### El precalentado desde la intro

Los assets pesados del showroom (5 stills + 120 frames, ~18 MB) se empiezan a bajar
**mientras el visitante mira la portada `/`**, no al entrar a `/showroom`. Así, cuando
aprieta "Descubrir", los bytes ya están en la cache del navegador: sin
"Cargando recorrido… %" y con las flechas listas de entrada.

`getShowroomPreloadSrcs()` (`src/lib/data.ts`) arma la lista en el orden en que se toca
—primer still, tramo 0→1, tramo 1→2, el resto— y `IntroScreen` dispara un `Image()` por
cada una en prioridad **baja**. Dos detalles que importan:

- la función es **sincrónica** y lee el JSON commiteado, no `getStops()`: eso leería el
  Blob y convertiría `/` en dinámica, que es lo último que querés en la primera pantalla.
  Las rutas de imagen son estables aunque cambie la geometría (el editor edita puntos, no
  agrega vistas);
- los `Image()` viven a **nivel de módulo**, no en el componente: la intro se desmonta al
  navegar y con las referencias morirían las descargas a medio camino.

Hoy la intro no tiene video (`INTRO_VIDEO_READY = false`), así que el precalentado tiene
la red para él solo. **Cuando llegue el video de intro hay que volver a medir**: van a
competir, y quizá convenga arrancar el precalentado recién con el `canplay` del video.

### Estructura de carpetas

```
_media-src/          Masters crudos del cliente — GITIGNOREADO, no deploya.
  stops/             Los 5 exteriores (+ _v1…_v5/ con las entregas anteriores)
  flyby/             Los 4 mp4 de las transiciones (fuente de `npm run flyby:frames`)
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
| **Renders con ~440px menos de alto** (5000×2375) | Con 16:9 se recorta el 15,6% del alto en una ventana maximizada. Ver [El encuadre del render](#el-encuadre-del-render) — son *menos* píxeles, no cuesta más tiempo de render. |
| **Dominio de producción** | `PROD_SITE_URL` (`src/lib/seo.ts`), el redirect www→apex de `next.config.ts` y `netlify.toml`, y `NEXT_PUBLIC_SITE_URL`. Hoy tienen un placeholder con la dirección; **desde el rebranding probablemente sea un dominio TIER**. No deployar así. |
| **Tipografía del logotipo** | Camila se lo preguntó al cliente. Sin eso no se pueden armar lockups tipográficos coherentes con el wordmark. |
| **Teléfonos de ventas** | `WHATSAPP_NUMBER` (`src/lib/contact.ts`) está vacío → los CTA abren el selector de contacto. |
| **Casilla de leads + verificar dominio en Resend** | `EMAIL_TO`. Sin dominio verificado, Resend sólo entrega a la cuenta dueña de la key. |
| **¿Los precios son públicos?** | Airtable los trae y hoy viajan en el HTML sin mostrarse. Ver el aviso en [Data en vivo](#data-en-vivo-airtable). |
| **Token de Airtable definitivo** | El actual lo pasó el cliente para probar y va a ser rotado. |
| **Pin exacto del edificio** | `SITE.location` tiene coordenadas aproximadas de la altura 900 de Mario Bravo. |
| **POIs del barrio** | `SITE.pois` está vacío a propósito (inventarlos publica datos falsos). |
| **360° del hall** | El de amenities llegó el 30-08 y ya está puesto (bolita del exterior + submenú Tours + modal de Amenities). Falta el del hall: `ENTRANCE_HALL_360` sigue en `null` y su item del menú, oculto. Ver [El punto 360° del exterior](#el-punto-360-del-exterior). |
| **Recorrido 360° del 6° y 7°** | 11 unidades sin `tour360`. ¿Reusan A–E o llevan el suyo? |
| **Clips que incluyan su frame de destino** | Hoy cada uno corta uno antes y se compensa con `--land`. Ver [Los frames del flyby](#los-frames-del-flyby). |
| **Video de intro** | La portada `/` está en modo still. Con `public/intro.mp4` + `intro-mobile.mp4` poné `INTRO_VIDEO_READY = true` en `IntroScreen.tsx`. |
| **Copy de "Un equipo con trayectoria"** | El cliente pidió dejar los tres logos TIER (Bravo, Avenue, Sinclair). El texto que los acompaña lo escribimos nosotros y conviene que lo apruebe. |
| **¿Cómo etiquetar la 706?** | Es pasante (dormitorios al contrafrente, estar a la calle). Hoy no muestra chip de exposición. Si la quieren rotulada, decidir si va como "Frente", "Contrafrente" o si sumamos un valor "Pasante". |
| **Plano de la unidad 702** | Del 7° mandaron sólo el 01 y el 06. Hoy la 702 muestra el del 701 (misma tipología, pero espejado y con 11 m² de diferencia). Ver [Los planos de unidad](#los-planos-de-unidad). |
| **Plano del 6° con la 605 y la 610** | El plano que mandaron tiene OCHO departamentos (01-04, 06-09) y el cliente sumó dos unidades más por Airtable. Sin un plano actualizado esas dos no pueden tener polígono en "Planta del piso" ni en el Plan Maestro. **Es el pedido más urgente.** Ver [Las 63 unidades](#las-63-unidades). |
| **Confirmar la numeración corrida del 6°** | Deducimos que `602↔03 · 603↔04 · 604↔05 · 607↔08 · 608↔09 · 609↔10`. Con la 605 y la 610 en la mezcla esto hay que confirmarlo sí o sí. Ver [Los planos de unidad](#los-planos-de-unidad). |
| **OK para corregir los baños** | Los planos dicen que la C, la D y la E tienen un toilette además del baño. Ver [Baños](#baños-lo-que-muestran-los-planos). |
| **Brochure comercial** | `BROCHURE_URL` es `null` → el item del menú y el botón "Ver PDF" están ocultos. |
| **Plano individual de cada terraza** | Juani (30-08): en el 7°, la pestaña "Plano de la unidad" debería mostrar también la terraza privada. Camila todavía no las separó. Ver [Terraza propia](#terraza-propia-el-último-piso). |
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
