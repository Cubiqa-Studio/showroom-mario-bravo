import { NextResponse } from "next/server";
import { configFaltante, urlProyectoPublico } from "@/lib/cubiqa";

// ─────────────────────────────────────────────────────────────────────────────
// SÓLO DEV (`route.dev.ts` — ver la nota de `pageExtensions` en next.config.ts).
//
// En producción este endpoint lo atiende el proxy PHP de deploy/hostinger. Acá vive
// el equivalente para `next dev`, para que trabajar en local no cambie en nada.
//
// CONTRATO: `{ project: { id, name, units: [...], brochure } | null }` — el `data`
// del back de Cubiqa TAL CUAL, sin mapear. El mismo que devuelve el PHP. El mapeo y
// el merge sobre units.json los hace el cliente (src/lib/cubiqa-parse.ts) → una sola
// fuente de verdad para la traducción de los enums, y el proxy no necesita saber
// nada del dominio.
//
// ⚠ Se devuelve el `data` CRUDO a propósito: si dev mandara el objeto ya mapeado y
// el PHP el crudo, habría dos contratos distintos entre local y producción y el bug
// aparecería recién en el deploy.
//
// Útil para VERIFICAR la conexión: abrí /api/proyecto y mirá que las unidades
// reflejen lo que está cargado en el panel de Cubiqa.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET() {
  const url = urlProyectoPublico();
  if (!url) {
    // Un `project: null` mudo no distingue "falta el env" de "el back no contestó".
    // Espeja el `motivo` que pone el PHP: abrir el endpoint explica qué falta.
    return NextResponse.json({
      project: null,
      motivo: "falta_config",
      faltan: configFaltante(),
      ayuda: "Cargá las dos variables en .env.local (ver .env.example).",
    });
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[api/proyecto] Cubiqa ${res.status}: ${body.slice(0, 200)}`);
      return NextResponse.json({
        project: null,
        // El back devuelve el MISMO 404 para "ese id no existe" y para "el proyecto
        // está desactivado": no se pueden distinguir desde acá.
        motivo:
          res.status === 404 ? "proyecto_inexistente_o_inactivo" : `backend_${res.status}`,
      });
    }
    const sobre = (await res.json()) as { data?: unknown };
    return NextResponse.json({ project: sobre?.data ?? null });
  } catch (err) {
    console.error("[api/proyecto] error:", err);
    return NextResponse.json({ project: null, motivo: "backend_sin_respuesta" });
  }
}
