import { NextResponse, type NextRequest } from "next/server";
import type { FloorPlate, UnitPolygon } from "@/lib/types";
import { readPlatesFile, writePlatesFile } from "@/lib/plates-store";

// Lee/escribe en runtime (Blob de Netlify); nunca prerenderizar.
export const dynamic = "force-dynamic";

/**
 * Persiste los polígonos digitalizados de la planta de un piso. Si el piso aún no
 * existe en plates.json lo crea (con la imagen placeholder). En prod escribe el
 * Blob de Netlify; en local cae al archivo plates.json. Protegido por el middleware.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ floor: string }> }) {
  const { floor } = await ctx.params;
  if (!floor) {
    return NextResponse.json({ error: "floor inválido." }, { status: 400 });
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

  const data = await readPlatesFile();
  let plate = data.plates.find((p) => p.floor === floor);
  if (!plate) {
    plate = { floor, image: "/plans/placeholder.svg", polygons: [] } as FloorPlate;
    data.plates.push(plate);
    data.plates.sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
  }

  plate.polygons = body.polygons;
  if (body.imageWidth) plate.imageWidth = body.imageWidth;
  if (body.imageHeight) plate.imageHeight = body.imageHeight;

  const stored = await writePlatesFile(data);
  return NextResponse.json({ ok: true, stored, plate });
}
