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

$tabla = showroom_cfg('airtable_avance_table');
if ($tabla === '') {
    showroom_json(['records' => []], 200, 60);
}

$records = showroom_airtable_records($tabla);
if ($records === null) {
    error_log('[showroom] /api/avance: sin datos de Airtable.');
    showroom_json(['records' => []], 200);
}

showroom_json(['records' => $records], 200, 60);
