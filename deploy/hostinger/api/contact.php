<?php
declare(strict_types=1);

// ─────────────────────────────────────────────────────────────────────────────
// Envío de leads del showroom por email vía Resend. Puerto del route handler
// src/app/api/contact/route.dev.ts, que en `next dev` sigue siendo el que atiende.
//
// Lo consumen TODOS los formularios del sitio:
//   · ContactSection ("Hablemos", ficha):  { name, phone, email, message, unitId, residence }
//   · ContactModal   (sidebar + WhatsApp): { name, phone, comment, source }
// Campos flexibles: sólo `name` es obligatorio + al menos un medio de contacto
// (email o teléfono). El resto se muestra si viene. Así el mismo endpoint sirve a
// los dos forms sin ramificar.
//
// POR QUÉ LA PLANTILLA Y LOS DESTINATARIOS VIVEN ACÁ (y no en el cliente):
// un proxy que aceptara `{to, subject, html}` del navegador sería un RELAY DE SPAM
// abierto — cualquiera podría mandar cualquier cosa, a cualquiera, firmado con el
// dominio del cliente. El navegador sólo manda los datos del formulario; a quién le
// llega y cómo se ve lo decide el servidor.
//
// Config (ver config.example.php):
//   resend_api_key        – obligatoria (https://resend.com/api-keys).
//   email_to              – bandeja de la DESARROLLADORA (y default de todo lo demás).
//   email_to_inmobiliaria – bandeja de la inmobiliaria. El lead va acá cuando la
//                           visita entró por su link (`?v=inmobiliaria`, ver
//                           src/lib/origen.ts). Si no está cargada, el lead NO se
//                           pierde: cae en email_to y el mail dice por quién vino.
//   email_from            – remitente. Default `onboarding@resend.dev` (funciona SIN
//                           dominio verificado, sólo entrega a la cuenta dueña de la
//                           key). Al verificar el dominio en Resend →
//                           "Showroom TIER Bravo <consultas@tu-dominio>".
// ─────────────────────────────────────────────────────────────────────────────

require __DIR__ . '/_lib.php';

showroom_cors();
showroom_solo('POST', 'OPTIONS');

/** Comercializadores. Espejo de COMERCIALIZADORES en src/lib/origen.ts. */
const COMERCIALIZADORES = [
    'desarrolladora' => 'TIER Desarrollos',
    'inmobiliaria'   => 'Inmobiliaria',
];
const ORIGEN_DEFECTO = 'desarrolladora';

/** Alias aceptados para `?v=`. Espejo de ALIAS en src/lib/origen.ts. */
const ORIGEN_ALIAS = [
    'desarrolladora'   => 'desarrolladora',
    'desarrollador'    => 'desarrolladora',
    'desarrollo'       => 'desarrolladora',
    'tier'             => 'desarrolladora',
    'dev'              => 'desarrolladora',
    'inmobiliaria'     => 'inmobiliaria',
    'inmo'             => 'inmobiliaria',
    'comercializacion' => 'inmobiliaria',
    'comercializadora' => 'inmobiliaria',
];

function normalizar_origen(string $v): ?string
{
    $pelado = strtolower(trim($v));
    // Sin acentos, igual que `pelar()` en origen.ts.
    $pelado = strtr($pelado, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    return ORIGEN_ALIAS[$pelado] ?? null;
}

// ── Guardas del endpoint ──────────────────────────────────────────────────────
// El endpoint pasó a ser público y sin el gate del server de Next, así que acá va
// el freno. 5 envíos por IP cada 10 minutos: de sobra para una persona que manda
// una consulta (y para la que se equivoca y reintenta), y corta un bot enseguida.
// Es best-effort, no un WAF: si hace falta más, va delante un Cloudflare.
if (showroom_rate_limited('contact', 5, 600)) {
    showroom_error('Demasiados envíos. Probá de nuevo en unos minutos.', 429);
}

$apiKey = showroom_cfg('resend_api_key');
$emailTo = showroom_cfg('email_to');
if ($apiKey === '' || $emailTo === '') {
    // Falta configurar el envío. Log para el operador; el front sólo ve el 500.
    error_log('[contacto] Falta resend_api_key o email_to en showroom-config.php.');
    showroom_error('Envío de email no configurado.', 500);
}

$body = showroom_body_json();
if ($body === null) {
    showroom_error('Body inválido.', 400);
}

$name  = showroom_campo($body, 'name', 120);
$email = showroom_campo($body, 'email', 200);
$phone = showroom_campo($body, 'phone', 60);
// El form de la ficha manda `message`; el del sidebar manda `comment`.
$text = showroom_campo($body, 'message', 4000);
if ($text === '') {
    $text = showroom_campo($body, 'comment', 4000);
}

if ($name === '') {
    showroom_error('El nombre es obligatorio.', 400);
}
if ($email === '' && $phone === '') {
    showroom_error('Dejá un email o un teléfono de contacto.', 400);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    showroom_error('El formato del email es inválido.', 400);
}

$residence = showroom_campo($body, 'residence', 40);
$unitId    = showroom_campo($body, 'unitId', 40);
$unitLabel = $residence !== '' ? $residence : $unitId;
$source    = showroom_campo($body, 'source', 120);

// A quién le corresponde el lead. El valor viene del cliente, así que se valida
// contra la lista conocida; cualquier cosa rara cae en el default.
$origen = normalizar_origen(showroom_campo($body, 'origen', 40)) ?? ORIGEN_DEFECTO;
$comercializador = COMERCIALIZADORES[$origen];
$bandejaInmobiliaria = showroom_cfg('email_to_inmobiliaria');
$destino = ($origen === 'inmobiliaria' && $bandejaInmobiliaria !== '')
    ? $bandejaInmobiliaria
    : $emailTo;
if ($origen === 'inmobiliaria' && $bandejaInmobiliaria === '') {
    error_log('[contacto] Lead de la inmobiliaria sin email_to_inmobiliaria: va a email_to.');
}

// Etiqueta en el asunto sólo cuando NO es el default, para que se pueda filtrar
// de un vistazo sin ensuciar el asunto de todos los días.
$etiqueta = $origen === ORIGEN_DEFECTO ? '' : '[' . $comercializador . '] ';
$subject = $unitLabel !== ''
    ? $etiqueta . 'Nueva consulta — ' . $name . ' · ' . $unitLabel
    : $etiqueta . 'Nueva consulta — ' . $name;

$emailFrom = showroom_cfg('email_from');
if ($emailFrom === '') {
    $emailFrom = 'Showroom TIER Bravo <onboarding@resend.dev>';
}

$payload = [
    'from'    => $emailFrom,
    'to'      => [$destino],
    'subject' => $subject,
    'html'    => render_email([
        'name'      => $name,
        'email'     => $email,
        'phone'     => $phone,
        'text'      => $text,
        'unitLabel' => $unitLabel,
        'source'    => $source,
        'vinoPor'   => $comercializador,
    ]),
];
// Responder al email va directo al interesado (si dejó email).
if ($email !== '') {
    $payload['reply_to'] = $email;
}

[$status, $respuesta] = showroom_post_json(
    'https://api.resend.com/emails',
    $payload,
    ['Authorization: Bearer ' . $apiKey]
);

if ($status < 200 || $status >= 300) {
    error_log('[contacto] Resend error: ' . $status . ' ' . substr($respuesta, 0, 300));
    showroom_error('No se pudo enviar el email.', 502);
}

showroom_json(['ok' => true], 200);

// ── Plantilla del email (dorado del logo, #A07F46) ───────────────────────────

function esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function fila(string $label, string $value): string
{
    return '
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f1efe9;color:#8a7a5c;font-size:13px;width:150px;vertical-align:top;">' . $label . '</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1efe9;color:#1c1a15;font-size:14px;font-weight:500;">' . $value . '</td>
    </tr>';
}

function render_email(array $d): string
{
    $filas = fila('Nombre', esc($d['name']));
    if ($d['email'] !== '') {
        $filas .= fila('Email', '<a href="mailto:' . esc($d['email']) . '" style="color:#A07F46;">' . esc($d['email']) . '</a>');
    }
    if ($d['phone'] !== '') {
        $filas .= fila('Teléfono', '<a href="tel:' . esc($d['phone']) . '" style="color:#A07F46;">' . esc($d['phone']) . '</a>');
    }
    if ($d['unitLabel'] !== '') {
        $filas .= fila('Unidad', esc($d['unitLabel']));
    }
    if ($d['text'] !== '') {
        $filas .= fila('Mensaje', nl2br(esc($d['text']), false));
    }
    if ($d['source'] !== '') {
        $filas .= fila('Origen', esc($d['source']));
    }
    if ($d['vinoPor'] !== '') {
        $filas .= fila('Vino por', esc($d['vinoPor']));
    }

    return '
    <div style="font-family:\'Helvetica Neue\',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#1c1a15;padding:32px;text-align:center;">
        <h1 style="color:#f6f1e7;margin:0;font-size:22px;font-weight:600;letter-spacing:1px;">
          Showroom TIER Bravo — Nueva consulta
        </h1>
        <p style="color:#A07F46;margin:8px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
          Mario Bravo 955 · Buenos Aires
        </p>
      </div>
      <div style="padding:28px 24px;">
        <p style="color:#6b6455;font-size:14px;margin:0 0 20px;">Se recibió una nueva consulta desde la web:</p>
        <table style="width:100%;border-collapse:collapse;">' . $filas . '</table>
      </div>
      <div style="background:#f6f1e7;padding:18px 24px;text-align:center;">
        <p style="color:#8a7a5c;font-size:12px;margin:0;">Email enviado automáticamente desde el Showroom TIER Bravo.</p>
      </div>
    </div>';
}
