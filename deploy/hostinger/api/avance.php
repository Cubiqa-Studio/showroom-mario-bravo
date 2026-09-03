<?php
declare(strict_types=1);

// Avance de obra EN VIVO desde Airtable. Espejo de unidades.php: mismo contrato
// (`{ "records": [...] }` crudos) y mismo criterio ante falta de datos —
// `records: []` con 200, que en el sitio se traduce en el badge de avance oculto.
//
// La tabla de avance es OPCIONAL: si no está cargada en el config, el modal
// "Avance de obra" queda vacío, que es el comportamiento que ya tenía.

require __DIR__ . '/_lib.php';

showroom_cors();
showroom_solo('GET', 'OPTIONS');

// Igual que unidades.php: un `records: []` mudo no distingue "falta el config" de
// "la tabla de avance no está cargada" ni de "Airtable no respondió".
$problema = showroom_motivo_sin_datos(['airtable_token', 'airtable_base_id', 'airtable_avance_table']);
if ($problema) {
    error_log('[showroom] /api/avance: ' . $problema['motivo'] . ' — faltan: ' . implode(', ', $problema['faltan']));
    showroom_json(['records' => []] + $problema, 200);
}

$records = showroom_airtable_records(showroom_cfg('airtable_avance_table'));
if ($records === null) {
    error_log('[showroom] /api/avance: Airtable no respondió y no hay copia en cache.');
    showroom_json(['records' => [], 'motivo' => 'airtable_sin_respuesta'], 200);
}

showroom_json(['records' => $records], 200, 60);
