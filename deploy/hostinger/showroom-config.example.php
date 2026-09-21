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
// NO lo commitees con valores reales (el .gitignore ya cubre ese nombre).
//
// ⚠ GUARDALO SIN BOM (UTF-8 "plano"). Varios editores de Windows —Notepad, y
// PowerShell con `Set-Content -Encoding utf8`— le meten un BOM de 3 bytes al
// principio. Como está ANTES del `<?php`, PHP lo emite como contenido y a partir
// de ahí ya no puede mandar cabeceras: "headers already sent", el Content-Type
// queda en text/html y el JSON sale inválido. El proxy tiene una red para esto
// (un buffer de salida que lo descarta, ver _lib.php), pero mejor no depender de
// ella: en VS Code es "UTF-8" y no "UTF-8 with BOM".
// ─────────────────────────────────────────────────────────────────────────────

return [
    // ── Cubiqa — unidades y brochure EN VIVO ─────────────────────────────────
    // De dónde salen: el admin carga el proyecto con sus unidades en el panel,
    // copia el ID del proyecto y lo pega acá. Ninguna de las dos es un secreto
    // (el endpoint /projects/:id/public es público), pero viven acá igual para
    // poder apuntar el showroom a otro proyecto SIN rebuildear ni resubir el zip.
    //
    // ⚠ Cada showroom apunta a SU proyecto: el match es por el número de unidad
    // (TEXTO) contra las keys de units.json, y un id ajeno pinta unidades de otro
    // edificio. Si el id no existe —o el proyecto está desactivado— el back
    // devuelve 404 y el sitio cae a los datos horneados, sin romperse.
    //
    // Sin barra final.
    'cubiqa_api_base'       => 'https://api.kuvus.app',
    'cubiqa_project_id'     => '00000000-0000-0000-0000-000000000000',

    // ── Airtable — SÓLO el avance de obra ────────────────────────────────────
    // Las unidades se migraron a Cubiqa; esto quedó porque ese back todavía no
    // tiene entidad de avance de obra. El día que la tenga, las tres claves de
    // abajo se borran.
    //
    // Personal Access Token (https://airtable.com/create/tokens).
    // Scopes: data.records:read · Acceso: SÓLO la base de este showroom.
    'airtable_token'        => 'pat_xxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

    // Base de TIER Bravo (no es secreta; el token sí):
    'airtable_base_id'      => 'appVdj9WzBYpKtUcu',
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
