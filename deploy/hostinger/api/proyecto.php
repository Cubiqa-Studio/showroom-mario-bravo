<?php
declare(strict_types=1);

// Unidades + brochure EN VIVO desde el back de Cubiqa. Equivale al route handler
// /api/proyecto que corre en `next dev`.
//
// CONTRATO: `{ "project": { "id", "name", "units": [...], "brochure": … } }` — el
// `data` del back TAL CUAL. El mapeo (enums en inglés → dominio del showroom, merge
// sobre units.json) lo hace el cliente con src/lib/cubiqa-parse.ts, que es la misma
// lógica que usa el build: una sola fuente de verdad.
//
// POR QUÉ HAY UN PROXY SI EL ENDPOINT DE CUBIQA ES PÚBLICO. No es por un secreto
// (no lleva token). Son tres razones, y las tres importan:
//
//   1. CORS. El back sólo acepta como Origin a admin.kuvus.app y dashboard.kuvus.app,
//      y esa lista vive en su código (config/production.json), no en una variable de
//      entorno: sumar el dominio del showroom es un cambio + redeploy de ellos, por
//      cada showroom y por cada preview. Peor: cuando el Origin no está en la lista,
//      su handler de errores devuelve 500 SIN cabeceras CORS, así que desde el
//      navegador un dominio mal configurado se ve igual que un back caído. Un
//      pedido server-to-server no manda `Origin` y el back lo deja pasar — es la
//      rama que él mismo habilita.
//   2. RECURSOS. El back no manda `Cache-Control` ni `ETag` y no tiene rate limit.
//      Un fetch por visitante = 3 consultas a su base por carga de página. Con la
//      cache de 60 s de acá abajo, son ≤1 por minuto para todo el tráfico del
//      sitio. Cubiqa pidió explícitamente cuidar el hosting compartido.
//   3. RESILIENCIA. Si el back no contesta, servimos la última copia buena en vez
//      de nada.
//
// Si el back no está configurado o está caído sin copia en cache, se devuelve
// `project: null`. Eso NO es un error para el sitio: el cliente se queda con lo que
// horneó el build (y en última instancia con units.json), así que la única
// consecuencia es que el dato no se actualiza. Por eso responde 200 y no 500: el
// front no tiene nada mejor que hacer con un 500, y un 500 en consola asusta sin
// motivo. El detalle real queda en el error_log del hosting.

require __DIR__ . '/_lib.php';

showroom_cors();
showroom_solo('GET', 'OPTIONS');

// Si falta configuración, decilo EN LA RESPUESTA. El sitio se comporta igual (cae a
// los datos horneados), pero abrir /api/proyecto pasa a explicar qué falta en vez de
// devolver un null mudo.
$problema = showroom_motivo_sin_datos(['cubiqa_api_base', 'cubiqa_project_id']);
if ($problema) {
    error_log('[showroom] /api/proyecto: ' . $problema['motivo'] . ' — faltan: ' . implode(', ', $problema['faltan']));
    showroom_json(['project' => null] + $problema, 200);
}

$proyecto = showroom_cubiqa_proyecto();

if ($proyecto === null) {
    error_log('[showroom] /api/proyecto: el back no respondió y no hay copia en cache.');
    showroom_json(['project' => null, 'motivo' => 'backend_sin_respuesta'], 200);
}

// `max-age=60` acompaña al TTL de la cache de archivo: el navegador no vuelve a
// preguntar dentro del minuto, y el minuto siguiente ya trae el dato nuevo.
showroom_json([
    'project' => $proyecto,
    'count'   => is_array($proyecto['units'] ?? null) ? count($proyecto['units']) : 0,
], 200, 60);
