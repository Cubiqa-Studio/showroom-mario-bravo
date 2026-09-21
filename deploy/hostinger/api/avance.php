<?php
declare(strict_types=1);

// Avance de obra EN VIVO desde Airtable. Mismo criterio que proyecto.php ante la
// falta de datos: `records: []` con 200, que en el sitio se traduce en el badge de
// avance oculto. Contrato: `{ "records": [...] }` con los registros CRUDOS de
// Airtable; el parseo lo hace el cliente con src/lib/airtable-parse.ts.
//
// ⚠ Es lo ÚLTIMO que queda en Airtable: las unidades y el brochure los sirve
// proyecto.php desde el back de Cubiqa, que todavía no tiene avance de obra.
//
// La tabla de avance es OPCIONAL: si no está cargada en el config, el modal
// "Avance de obra" queda vacío, que es el comportamiento que ya tenía.

require __DIR__ . '/_lib.php';

showroom_cors();
showroom_solo('GET', 'OPTIONS');

// Igual que proyecto.php: un `records: []` mudo no distingue "falta el config" de
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
