import { NextResponse, type NextRequest } from "next/server";
import type { UnitPolygon } from "@/lib/types";
import { readStopsFile, writeStopsFile } from "@/lib/stops-store";

// Lee/escribe en runtime (Blob de Netlify); nunca prerenderizar.
export const dynamic = "force-dynamic";

/**
 * Persiste los polígonos digitalizados de un stop. En producción escribe el Blob
 * de Netlify (edición online); en local sin contexto Netlify cae al archivo
 * stops.json (flujo de dev de siempre). El acceso lo protege el middleware
 * (Basic Auth con ADMIN_PASSWORD en prod; libre en dev).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ stopId: string }> },
) {
  const { stopId } = await ctx.params;
  const id = Number(stopId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "stopId inválido." }, { status: 400 });
  }

  let body: { polygons?: UnitPolygon[]; imageWidth?: number; imageHeight?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  if (!Array.isArray(body.polygons)) {
    return NextResponse.json({ error: "Falta el array 'polygons'." }, { status: 400 });
  }

  const data = await readStopsFile();
  const stop = data.stops.find((s) => s.id === id);
  if (!stop) {
    return NextResponse.json({ error: `El stop ${id} no existe.` }, { status: 404 });
  }

  stop.polygons = body.polygons;
  if (body.imageWidth) stop.imageWidth = body.imageWidth;
  if (body.imageHeight) stop.imageHeight = body.imageHeight;

  const stored = await writeStopsFile(data);
  return NextResponse.json({ ok: true, stored, stop });
}
