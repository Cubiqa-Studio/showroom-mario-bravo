# Deploy en Hostinger (sitio estático + proxy PHP)

El sitio se publica como **export estático de Next** (`output: "export"`): HTML, CSS,
JS y assets planos, sin proceso Node corriendo. Tres endpoints los atiende un **proxy
PHP** de ~4 archivos, porque manejan secretos que no pueden viajar en el bundle.

```
Navegador
   │
   ├── HTML/CSS/JS/assets ─────────────► Apache (archivos de out/)
   │
   └── /api/unidades  /api/avance ─────► PHP ──► Airtable   (token server-side)
       /api/contact  ──────────────────► PHP ──► Resend     (API key server-side)
```

**Por qué PHP y no Node**: Hostinger corre PHP-FPM nativo, que no deja ningún proceso
vivo entre pedidos. A diferencia de una app Node, no suma a la métrica de procesos de
la cuenta — que era justo el motivo de la migración.

---

## 1. Build y paquete

```bash
npm ci
npm run build                 # → out/
npm run preview:static        # opcional: mirá out/ como lo sirve Apache → localhost:4321

npm run deploy:zip -- --test  # → DEPLOY.zip  (subdominio de PRUEBA, agrega noindex)
npm run deploy:zip            # → DEPLOY.zip  (PRODUCCIÓN, indexable)
npm run deploy:config         # → showroom-config.php  (secretos, desde .env.local)
```

`DEPLOY.zip` se extrae **dentro** de `public_html`. `showroom-config.php` va **un
nivel arriba** y por eso NO viene en el zip.

`--test` le agrega al `.htaccess` un `X-Robots-Tag: noindex, nofollow`, así el
subdominio de prueba no compite con el sitio real por las mismas queries. El default
es producción (sin noindex) a propósito: olvidarse el `--test` en una prueba es
molesto pero se arregla; olvidarse de sacar el noindex en producción dejaría el sitio
real sin tráfico, en silencio.

`npm run preview:static` aplica las mismas reglas del `.htaccess` (URLs sin
extensión, 404, cache) y hace de stand-in del PHP para `/api/unidades` y
`/api/avance`, así verificás la data en vivo antes de subir nada. No manda mails.

### Variables que necesita el BUILD

| Variable | Para qué | Si falta |
| --- | --- | --- |
| `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_UNITS_TABLE_ID` | Hornear estado/precio/superficies reales en el HTML | Cae a `units.json`: el HTML sale con "Consultar" hasta que el navegador refresca desde el proxy |
| `AIRTABLE_AVANCE_TABLE_ID` | Avance de obra | El badge queda oculto hasta el refresco del cliente |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | Analítica | Sin eventos |
| `NEXT_PUBLIC_SITE_URL` | Canonical, `og:url`, **`og:image`**, sitemap, JSON-LD | Cae al placeholder de `src/lib/seo.ts` — ver abajo |
| `NEXT_PUBLIC_API_BASE` | Sólo si el proxy NO vive en el mismo dominio | Default `/api` (el caso normal) |

⚠ `RESEND_API_KEY`, `EMAIL_TO` y compañía **no** van en el build: son del PHP.

### Ojo con `NEXT_PUBLIC_SITE_URL`

Si no la setéas, `src/lib/seo.ts` cae a su placeholder `https://mariobravo955.com.ar`,
que **todavía no resuelve**. El sitio funciona igual, así que es fácil no darse
cuenta — hasta que compartís el link: WhatsApp, Discord y Meta Ads muestran el
título y la descripción bien, pero **la imagen sale rota**, porque `og:image` es
absoluta y la van a buscar a un dominio que no existe.

Ponela apuntando al host donde realmente se sirve (el subdominio de prueba mientras
se prueba) y rebuildeá: se hornea en el HTML.

---

## 2. Qué subir y dónde

```
~/domains/<tu-dominio>/
├── public_html/                 ← doc root
│   ├── .htaccess                ← de deploy/hostinger/.htaccess
│   ├── api/
│   │   ├── _lib.php             ← de deploy/hostinger/api/
│   │   ├── unidades.php
│   │   ├── avance.php
│   │   └── contact.php
│   ├── index.html               ┐
│   ├── showroom.html            │
│   ├── residencia/…             ├── TODO el CONTENIDO de out/
│   ├── api/plate/…              │   (el contenido, no la carpeta out/ en sí)
│   ├── _next/…                  │
│   └── frames/ stops/ gallery/… ┘
└── showroom-config.php          ← FUERA de public_html. Secretos.
```

**Orden recomendado**: primero el contenido de `out/`, después el `api/` y el
`.htaccess` encima (así el `api/` del export —que sólo tiene `plate/`— no borra los
`.php`).

### El archivo de secretos

Copiá `deploy/hostinger/showroom-config.example.php` como `showroom-config.php`,
completalo y subilo **un nivel arriba de `public_html`**.

Va afuera del doc root porque si PHP alguna vez se cae o se desconfigura, un `.php`
dentro del doc root se sirve como **texto plano** y el token queda expuesto. El
`.htaccess` igual bloquea ese nombre de archivo, pero eso es el cinturón, no el
asiento.

⚠ **Guardalo sin BOM.** Notepad y `Set-Content -Encoding utf8` de PowerShell le meten
un BOM de 3 bytes que, al estar antes del `<?php`, rompe las cabeceras de todos los
endpoints. El proxy lo descarta con un buffer de salida, pero no dependas de eso: en
VS Code elegí "UTF-8", no "UTF-8 with BOM".

### NO subir

`out/` como carpeta (subí su contenido), `.next/`, `node_modules/`, el código fuente,
`.env.local`, `deploy/`. Y no hace falta ningún comando de arranque de Node.

---

## 3. Verificación post-deploy

```bash
S=https://<tu-subdominio>

curl -sI  $S/                      # 200, text/html
curl -sI  $S/showroom              # 200 (el .htaccess resolvió showroom.html)
curl -sI  $S/residencia/101        # 200
curl -sI  $S/residencia/9999       # 404 + la página 404 del sitio
curl -s   $S/api/plate/5 | head -c 120   # {"plate":{"floor":"5"…  (archivo estático)
curl -s   $S/api/unidades | head -c 120  # {"records":[{"id":"rec…  (PHP → Airtable)
curl -s   $S/api/avance   | head -c 120  # {"records":[…]}
curl -sI  $S/frames/  --   # (elegí un frame real) → Cache-Control: max-age=86400
curl -sI  $S/sitemap.xml           # 200, application/xml
```

Y en el navegador, lo que sólo se ve ahí:

1. `/showroom` → el recorrido carga, las flechas giran sin lag.
2. Click en una unidad → **zoom-in y la ficha abre encima; la URL pasa a
   `/residencia/<id>` sin recargar**. El back cierra con zoom-out y el recorrido
   queda en la misma vista.
3. F5 sobre `/residencia/<id>` → carga la ficha standalone.
4. Los contornos de las unidades toman el color del estado real de Airtable a los
   pocos ms (mirá `/api/unidades` en la pestaña Network).
5. Pestaña "Planta del piso" → carga el plano.
6. Mandá una consulta desde "Hablemos" y desde el modal del menú → llega el mail.
   Probá también con `?v=inmobiliaria` y confirmá que va a la otra bandeja.
7. La consola no tiene errores nuevos (los avisos del iframe de Kuula sobre
   `xr-spatial-tracking` y `accelerometer` son de siempre y a propósito, ver
   `Hero360.tsx`).

---

## 4. Cosas que hay que saber

### El formulario y la data en vivo dependen del PHP

Si el PHP no está o está mal configurado, el sitio **no se rompe**: muestra los datos
horneados en el build y el formulario devuelve error. Pero no se actualiza solo y no
entran leads. Los detalles quedan en el `error_log` del hosting, no en la respuesta.

### Un cambio de dato NO necesita rebuild, un cambio de código SÍ

Estado, precio, ambientes y superficies salen del proxy en runtime: se cambian en
Airtable y se ven en ≤2 minutos (60 s de cache del PHP + 60 s del navegador). Lo que
necesita rebuild + subida es todo lo demás: geometría de polígonos, planos, tours,
textos, y el HTML que leen los crawlers.

### El editor de polígonos ahora es sólo local

`/admin/polygon-editor` y `/api/admin/*` **no se publican** (son archivos
`page.dev.tsx` / `route.dev.ts`, ver la nota de `pageExtensions` en
`next.config.ts`). El flujo es: `npm run dev` → trazás → se escribe
`src/data/stops.json` / `plates.json` → commiteás → rebuild.

Lo que se perdió es la edición online contra producción (el Blob de Netlify). Lo que
se ganó: el editor no existe en el sitio público, así que no hay nada que proteger
con clave.

### El deploy de Netlify queda a medias

Con `output: "export"` la build de Netlify también pasa a ser estática, así que allá
**los tres endpoints dejan de existir**: sin data en vivo y sin formulario. El
`netlify.toml` sigue sirviendo para los headers de cache del CDN.

Si hace falta mantener Netlify funcionando en paralelo, la salida más corta es
apuntar ese build al PHP de Hostinger con
`NEXT_PUBLIC_API_BASE=https://<dominio-hostinger>/api` y agregar ese origen a
`allowed_origins` en `showroom-config.php` (ahí sí hace falta CORS).

### El dominio sigue siendo un placeholder

`PROD_SITE_URL` en `src/lib/seo.ts`, el redirect `www` → apex comentado en el
`.htaccess`, y el de `netlify.toml`. Los tres se actualizan juntos cuando se defina
el dominio real. **En el subdominio de prueba, dejá el redirect comentado.**
