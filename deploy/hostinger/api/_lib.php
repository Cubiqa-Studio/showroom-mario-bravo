<?php
declare(strict_types=1);

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades compartidas del proxy del showroom.
//
// POR QUÉ EXISTE ESTE PHP. El sitio se publica como export estático de Next
// (`output: "export"`): HTML plano, sin proceso Node. Pero hay tres cosas que
// necesitan un servidor porque manejan SECRETOS que NO pueden viajar en el bundle
// de JavaScript (donde cualquiera los lee con F12):
//
//   · el token de Airtable  → lectura de la base del cliente
//   · la API key de Resend  → mandar mails desde el dominio del cliente
//
// Hostinger corre PHP nativo (PHP-FPM), sin proceso persistente: a diferencia de
// una app Node, no queda nada corriendo entre pedidos, así que no suma a la métrica
// de procesos de la cuenta. Sólo se ejecuta durante el request.
//
// El proxy es TONTO a propósito: pasa los registros crudos de Airtable y no sabe
// nada del dominio. El parseo (nombres de columna, merge sobre units.json) vive en
// TypeScript, en src/lib/airtable-parse.ts, y lo comparten el build y el navegador.
// Así no hay dos implementaciones del mismo parseo para mantener en sincronía.
//
// La excepción es contact.php: ahí la plantilla del mail y la lista de
// destinatarios SÍ tienen que estar server-side, porque un proxy que aceptara
// `{to, html}` arbitrarios sería un relay de spam abierto.
// ─────────────────────────────────────────────────────────────────────────────

/** Techo de espera de una llamada a un servicio externo, en segundos. */
const SHOWROOM_TIMEOUT = 8;

// ── Higiene de la respuesta ───────────────────────────────────────────────────
//
// 1. Los errores de PHP van al log del hosting, NUNCA al cuerpo de la respuesta.
//    Un warning impreso rompe el JSON (el cliente recibe basura antes del `{`) y
//    encima filtra rutas absolutas del servidor.
//
// 2. Un buffer de salida para poder DESCARTAR cualquier cosa que se haya impreso
//    antes de que mandemos las cabeceras. El caso que de verdad pasa: un editor de
//    Windows guarda `showroom-config.php` con **BOM UTF-8**, esos 3 bytes se
//    emiten al hacer el `require`, y a partir de ahí PHP ya mandó las cabeceras →
//    "Cannot modify header information - headers already sent", el Content-Type
//    queda en text/html, el status no se puede cambiar y el JSON sale inválido.
//    Con el buffer, el BOM se tira y la respuesta sale limpia igual.
//    (Aun así: guardá el config SIN BOM. Esto es la red, no la solución.)
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
if (ob_get_level() === 0) {
    ob_start();
}

/**
 * Configuración (secretos incluidos). Se busca en este orden:
 *
 *   1. La ruta de la variable de entorno SHOWROOM_CONFIG.
 *   2. `showroom-config.php` UN NIVEL ARRIBA del doc root. Es el lugar
 *      recomendado en Hostinger: `~/domains/<dominio>/showroom-config.php`, al
 *      lado de `public_html/` pero FUERA de él → no es accesible por web ni con la
 *      URL exacta.
 *   3. Variables de entorno sueltas (si el panel del host permite definirlas).
 *
 * El archivo devuelve un array (ver config.example.php). Nunca lo pongas dentro de
 * public_html: si PHP se cae o se desconfigura, un .php dentro del doc root se
 * sirve como TEXTO PLANO y el token queda expuesto.
 */
function showroom_config(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $GLOBALS['showroom_config_desde_archivo'] = false;

    $candidatos = [];
    $desdeEnv = getenv('SHOWROOM_CONFIG');
    if (is_string($desdeEnv) && $desdeEnv !== '') {
        $candidatos[] = $desdeEnv;
    }
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    if ($docRoot !== '') {
        $candidatos[] = rtrim(dirname($docRoot), '/') . '/showroom-config.php';
    }
    // Relativo a este archivo (api/ → doc root → un nivel arriba), por si el
    // DOCUMENT_ROOT del host no es el que uno espera.
    $candidatos[] = dirname(__DIR__, 2) . '/showroom-config.php';

    foreach ($candidatos as $ruta) {
        if (is_string($ruta) && $ruta !== '' && is_readable($ruta)) {
            $cargado = require $ruta;
            if (is_array($cargado)) {
                $cache = $cargado;
                $GLOBALS['showroom_config_desde_archivo'] = true;
                return $cache;
            }
        }
    }

    // Sin archivo: probamos variables de entorno. Devuelve strings vacíos si no hay
    // nada — cada endpoint decide qué es obligatorio para él.
    $cache = [
        'airtable_token'         => (string) (getenv('AIRTABLE_TOKEN') ?: ''),
        'airtable_base_id'       => (string) (getenv('AIRTABLE_BASE_ID') ?: ''),
        'airtable_units_table'   => (string) (getenv('AIRTABLE_UNITS_TABLE_ID') ?: ''),
        'airtable_avance_table'  => (string) (getenv('AIRTABLE_AVANCE_TABLE_ID') ?: ''),
        'resend_api_key'         => (string) (getenv('RESEND_API_KEY') ?: ''),
        'email_to'               => (string) (getenv('EMAIL_TO') ?: ''),
        'email_to_inmobiliaria'  => (string) (getenv('EMAIL_TO_INMOBILIARIA') ?: ''),
        'email_from'             => (string) (getenv('EMAIL_FROM') ?: ''),
        'allowed_origins'        => [],
    ];
    return $cache;
}

function showroom_cfg(string $clave, string $default = ''): string
{
    $cfg = showroom_config();
    $v = $cfg[$clave] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

/**
 * Por qué NO hay datos, en una palabra. Se devuelve en el JSON para que un
 * `{"records":[]}` diga qué le pasa en vez de quedar mudo.
 *
 * Sin esto los dos fallos más probables —"no subiste el config" y "Airtable no
 * respondió"— se ven EXACTAMENTE IGUAL desde el navegador: una lista vacía y el
 * sitio mostrando los datos horneados. Pasó en el primer deploy y costó una vuelta
 * entera averiguar cuál de los dos era.
 *
 * Sólo devuelve NOMBRES de claves y estados, nunca valores: es seguro que sea público.
 */
function showroom_motivo_sin_datos(array $obligatorias): array
{
    showroom_config(); // fuerza la carga, que setea la bandera de abajo
    $desdeArchivo = !empty($GLOBALS['showroom_config_desde_archivo']);

    $faltan = [];
    foreach ($obligatorias as $clave) {
        if (showroom_cfg($clave) === '') {
            $faltan[] = $clave;
        }
    }
    if (!$faltan) {
        return [];
    }
    return [
        'motivo' => $desdeArchivo ? 'config_incompleta' : 'falta_showroom_config',
        'faltan' => $faltan,
        'ayuda' => $desdeArchivo
            ? 'Encontré showroom-config.php pero le faltan estas claves.'
            : 'No encontré showroom-config.php. Tiene que estar UN NIVEL ARRIBA de public_html '
                . '(al lado, no adentro). Generalo con `npm run deploy:config`.',
    ];
}

/**
 * CORS. Por defecto NO se emite nada: el PHP vive en el MISMO origen que el sitio
 * estático (ambos en el doc root), así que el navegador no hace preflight ni pide
 * cabeceras. Sólo hace falta si el sitio se sirve desde otro dominio que el de la
 * API — en ese caso listá los orígenes exactos en `allowed_origins` del config.
 * Nunca `*`: este endpoint manda mails.
 */
function showroom_cors(): void
{
    $cfg = showroom_config();
    $permitidos = $cfg['allowed_origins'] ?? [];
    if (!is_array($permitidos) || $permitidos === []) {
        return;
    }
    $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origen !== '' && in_array($origen, $permitidos, true)) {
        header('Access-Control-Allow-Origin: ' . $origen);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Respuesta JSON y fin del request. `$maxAge` = cache del NAVEGADOR, en segundos. */
function showroom_json($datos, int $status = 200, int $maxAge = 0): void
{
    // Tirá lo que haya en el buffer (BOM del config, un warning, un espacio suelto)
    // ANTES de tocar las cabeceras — ver la nota de arriba.
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    if ($maxAge > 0 && $status === 200) {
        header('Cache-Control: public, max-age=' . $maxAge);
    } else {
        header('Cache-Control: no-store');
    }
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function showroom_error(string $mensaje, int $status): void
{
    showroom_json(['error' => $mensaje], $status);
}

/** Sólo permite estos métodos; cualquier otro corta con 405. */
function showroom_solo(string ...$metodos): void
{
    $m = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($m, $metodos, true)) {
        header('Allow: ' . implode(', ', $metodos));
        showroom_error('Método no permitido.', 405);
    }
}

/** Directorio de trabajo del proxy (cache y contadores). Fuera del doc root. */
function showroom_dir_tmp(): string
{
    $base = sys_get_temp_dir() . '/showroom-mario-bravo';
    if (!is_dir($base)) {
        @mkdir($base, 0700, true);
    }
    return $base;
}

/**
 * GET a una URL externa. Devuelve [status, body]. cURL y no file_get_contents
 * porque `allow_url_fopen` suele estar apagado en shared hosting.
 */
function showroom_get(string $url, array $headers = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => SHOWROOM_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        error_log('[showroom] GET falló: ' . $url . ' — ' . $err);
        return [0, ''];
    }
    return [$status, (string) $body];
}

/** POST JSON a una URL externa. Devuelve [status, body]. */
function showroom_post_json(string $url, array $payload, array $headers = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_TIMEOUT        => SHOWROOM_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        error_log('[showroom] POST falló: ' . $url . ' — ' . $err);
        return [0, ''];
    }
    return [$status, (string) $body];
}

// ─────────────────────────────────────────────────────────────────────────────
// Airtable: pass-through con cache y "última copia buena".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trae TODOS los registros de una tabla de Airtable (paginando por `offset`) y los
 * devuelve tal como vienen: `[{ id, fields: {...} }, ...]`.
 *
 * CACHE A ARCHIVO de 60 s. Es lo que replica el `revalidate: 60` que tenía el
 * server de Next, y hace falta por dos razones: Airtable limita a ~5 req/s por base
 * (sin cache, una tanda de visitantes la rate-limitea) y el dato no cambia tan
 * seguido como para pagar una llamada por visita.
 *
 * Si Airtable falla, se sirve la copia vieja aunque esté vencida (mejor un dato de
 * hace un rato que ningún dato: el sitio cae a units.json y muestra "Consultar").
 * Devuelve null sólo si nunca hubo una copia buena.
 */
function showroom_airtable_records(string $tabla, int $ttl = 60): ?array
{
    $token = showroom_cfg('airtable_token');
    $baseId = showroom_cfg('airtable_base_id');
    if ($token === '' || $baseId === '' || $tabla === '') {
        return null;
    }

    $cache = showroom_dir_tmp() . '/at-' . sha1($baseId . '|' . $tabla) . '.json';
    $vencida = true;
    $vieja = null;
    if (is_readable($cache)) {
        $crudo = @file_get_contents($cache);
        $vieja = $crudo === false ? null : json_decode($crudo, true);
        if (is_array($vieja)) {
            $vencida = (time() - (int) @filemtime($cache)) >= $ttl;
        } else {
            $vieja = null;
        }
    }
    if (!$vencida && is_array($vieja)) {
        return $vieja;
    }

    $records = [];
    $offset = null;
    $intentos = 0;
    do {
        $url = 'https://api.airtable.com/v0/' . rawurlencode($baseId) . '/' . rawurlencode($tabla)
            . '?pageSize=100' . ($offset !== null ? '&offset=' . rawurlencode($offset) : '');
        [$status, $body] = showroom_get($url, ['Authorization: Bearer ' . $token]);
        if ($status !== 200) {
            error_log('[showroom] Airtable ' . $status . ' en "' . $tabla . '": ' . substr($body, 0, 200));
            // Falló: servimos la copia vieja si la hay.
            return is_array($vieja) ? $vieja : null;
        }
        $data = json_decode($body, true);
        if (!is_array($data)) {
            return is_array($vieja) ? $vieja : null;
        }
        if (isset($data['records']) && is_array($data['records'])) {
            foreach ($data['records'] as $r) {
                $records[] = $r;
            }
        }
        $offset = isset($data['offset']) && is_string($data['offset']) ? $data['offset'] : null;
        $intentos++;
        // Tope de seguridad: 20 páginas × 100 = 2000 filas. Un showroom tiene decenas.
    } while ($offset !== null && $intentos < 20);

    @file_put_contents($cache, json_encode($records, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $records;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting por IP (ventana deslizante simple, a archivo).
// ─────────────────────────────────────────────────────────────────────────────

/** IP del visitante. Detrás del proxy de Hostinger puede venir en X-Forwarded-For. */
function showroom_ip(): string
{
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if (is_string($xff) && $xff !== '') {
        // El primer valor es el cliente original.
        $primera = trim(explode(',', $xff)[0]);
        if (filter_var($primera, FILTER_VALIDATE_IP)) {
            return $primera;
        }
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return is_string($ip) && $ip !== '' ? $ip : 'desconocida';
}

/**
 * `true` si esta IP ya gastó su cupo. Es best-effort (un archivo por IP, sin
 * locking fino): no pretende ser un WAF, sino evitar que el endpoint de mail se use
 * como cañón de spam. La IP se guarda HASHEADA, así el archivo temporal no es un
 * registro de direcciones de visitantes.
 */
function showroom_rate_limited(string $balde, int $maximo, int $ventana): bool
{
    $archivo = showroom_dir_tmp() . '/rl-' . $balde . '-' . sha1(showroom_ip()) . '.json';
    $ahora = time();
    $sellos = [];
    if (is_readable($archivo)) {
        $crudo = @file_get_contents($archivo);
        $previos = $crudo === false ? null : json_decode($crudo, true);
        if (is_array($previos)) {
            foreach ($previos as $t) {
                if (is_int($t) && ($ahora - $t) < $ventana) {
                    $sellos[] = $t;
                }
            }
        }
    }
    if (count($sellos) >= $maximo) {
        return true;
    }
    $sellos[] = $ahora;
    @file_put_contents($archivo, json_encode($sellos), LOCK_EX);
    return false;
}

/** Body JSON del request, o null si no es JSON válido. */
function showroom_body_json(int $maxBytes = 20000): ?array
{
    $crudo = file_get_contents('php://input');
    if ($crudo === false || $crudo === '' || strlen($crudo) > $maxBytes) {
        return null;
    }
    $datos = json_decode($crudo, true);
    return is_array($datos) ? $datos : null;
}

/** Campo de texto recortado y con tope de largo. '' si no vino. */
function showroom_campo(array $body, string $clave, int $max = 500): string
{
    $v = $body[$clave] ?? '';
    if (!is_string($v)) {
        return '';
    }
    $v = trim($v);
    // Fuera los caracteres de control (incluye los saltos de línea que se usan para
    // inyectar cabeceras). Se conservan \n y \t, que son legítimos en un mensaje.
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
}
