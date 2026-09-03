<?php
// ─────────────────────────────────────────────────────────────────────────────
// SECRETOS DEL PROXY DEL SHOWROOM.
//
// ⚠ ESTE ARCHIVO VA **FUERA** DEL DOC ROOT. En Hostinger:
//
//     ~/domains/<tu-dominio>/
//       ├── public_html/          ← acá va el contenido de out/ + api/
//       └── showroom-config.php   ← acá va ESTE archivo  (al lado, NO adentro)
//
// Por qué afuera: si algún día PHP se cae o se desconfigura, un `.php` que esté
// dentro del doc root se sirve como TEXTO PLANO y el token queda a la vista de
// cualquiera que pida la URL. Afuera del doc root no hay URL que lo alcance.
// El .htaccess igual bloquea el nombre por si alguien lo copia adentro por error,
// pero eso es el cinturón, no el asiento.
//
// Copiá este archivo como `showroom-config.php`, completá los valores y subilo.
// NO lo commitees con valores reales.
// ─────────────────────────────────────────────────────────────────────────────

return [
    // ── Airtable — data EN VIVO (estado, precio, ambientes, superficies) ──────
    // Personal Access Token (https://airtable.com/create/tokens).
    // Scopes: data.records:read · Acceso: SÓLO la base de este showroom.
    // ⚠ Cada showroom necesita su PROPIA base y sus propios table IDs: el match es
    // por la columna "Unidad" (TEXTO) contra las keys de units.json, y mezclar
    // bases pinta unidades ajenas.
    'airtable_token'        => 'pat_xxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

    // Base y tablas de TIER Bravo (no son secretas; el token sí):
    'airtable_base_id'      => 'appVdj9WzBYpKtUcu',
    'airtable_units_table'  => 'tble9NSwIDP5yAtuJ',
    // Opcional: sin esto, el modal "Avance de obra" muestra el estado vacío.
    'airtable_avance_table' => 'tbldUfUyV1eoT8gBe',

    // ── Resend — emails de los formularios de contacto ───────────────────────
    // API key (https://resend.com/api-keys). Sin ella, /api/contact da 500.
    'resend_api_key'        => 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',

    // Bandeja donde llegan los leads de la DESARROLLADORA (y default de todo).
    // ⚠ PENDIENTE: definir la casilla real con el cliente.
    // SIN dominio verificado, Resend sólo entrega a la cuenta dueña de la key.
    'email_to'              => '',

    // Bandeja de la INMOBILIARIA. El lead va acá cuando la visita entró por SU
    // link (`?v=inmobiliaria`). Si queda vacía, esos leads NO se pierden: caen en
    // email_to y el mail dice "Vino por".
    'email_to_inmobiliaria' => '',

    // Remitente. Vacío → "Showroom TIER Bravo <onboarding@resend.dev>", que
    // funciona sin dominio verificado pero SÓLO entrega a la cuenta dueña de la
    // key. Con el dominio verificado en Resend:
    //   'email_from' => 'Showroom TIER Bravo <consultas@tu-dominio>',
    'email_from'            => '',

    // ── CORS ─────────────────────────────────────────────────────────────────
    // Dejalo VACÍO si el sitio y este PHP viven en el mismo dominio (el caso
    // normal: los dos en public_html). Sólo hace falta si el HTML se sirve desde
    // otro origen — ahí listá los orígenes EXACTOS. Nunca '*': este endpoint
    // manda mails.
    //   'allowed_origins' => ['https://mariobravo955.com.ar'],
    'allowed_origins'       => [],
];
