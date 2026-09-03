<?php
declare(strict_types=1);

// Unidades EN VIVO desde Airtable, con el token guardado del lado del servidor.
// Equivale al route handler /api/unidades que corre en `next dev`.
//
// CONTRATO: `{ "records": [ { "id": …, "fields": { … } } ] }` — los registros
// CRUDOS de Airtable. El parseo (nombres de columna, merge sobre units.json) lo
// hace el cliente con src/lib/airtable-parse.ts, que es la misma lógica que usa el
// build: una sola fuente de verdad.
//
// Si Airtable no está configurado o está caído sin copia en cache, se devuelve
// `records: []`. Eso NO es un error para el sitio: el cliente se queda con lo que
// horneó el build (y en última instancia con units.json), así que la única
// consecuencia es que el dato no se actualiza. Por eso responde 200 y no 500: el
// front no tiene nada mejor que hacer con un 500, y un 500 en consola asusta sin
// motivo. El detalle real queda en el error_log del hosting.

require __DIR__ . '/_lib.php';

showroom_cors();
showroom_solo('GET', 'OPTIONS');

// Si falta configuración, decilo EN LA RESPUESTA. El sitio se comporta igual (cae a
// los datos horneados), pero abrir /api/unidades pasa a explicar qué falta en vez de
// devolver una lista vacía muda.
$problema = showroom_motivo_sin_datos(['airtable_token', 'airtable_base_id', 'airtable_units_table']);
if ($problema) {
    error_log('[showroom] /api/unidades: ' . $problema['motivo'] . ' — faltan: ' . implode(', ', $problema['faltan']));
    showroom_json(['records' => []] + $problema, 200);
}

$records = showroom_airtable_records(showroom_cfg('airtable_units_table'));

if ($records === null) {
    error_log('[showroom] /api/unidades: Airtable no respondió y no hay copia en cache.');
    showroom_json(['records' => [], 'motivo' => 'airtable_sin_respuesta'], 200);
}

// `max-age=60` acompaña al TTL de la cache de archivo: el navegador no vuelve a
// preguntar dentro del minuto, y el minuto siguiente ya trae el dato nuevo.
showroom_json(['records' => $records, 'count' => count($records)], 200, 60);
