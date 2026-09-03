import { NextResponse } from "next/server";
import { readStopsFile } from "@/lib/stops-store";

export const dynamic = "force-dynamic";

/**
 * Devuelve el stops.json COMPLETO y actual (todas las vistas) — Blob en prod,
 * archivo/semilla en local. Es la "fuente de verdad" para bajar, commitear al
 * repo y deployar a cualquier host (p. ej. Hostinger, sin editor). Pretty-printed
 * para que el archivo quede idéntico al estilo del repo. Lo protege el middleware.
 */
export async function GET() {
  const data = await readStopsFile();
  return new NextResponse(JSON.stringify(data, null, 2) + "\n", {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="stops.json"',
    },
  });
}
