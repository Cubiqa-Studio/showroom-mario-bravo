import { NextResponse, type NextRequest } from "next/server";
import { getPlate, getLiveUnits } from "@/lib/data";
import type { Unit } from "@/lib/types";

// Lee el Blob/semilla en runtime; nunca prerenderizar.
export const dynamic = "force-dynamic";

/**
 * Endpoint PÚBLICO (no /api/admin → sin Basic Auth) para la landing: devuelve la
 * planta trazada de un piso, o null si todavía no tiene polígonos. La landing lo
 * pide LAZY al abrir la pestaña "Planta del piso", así la navegación al detalle
 * NUNCA se bloquea leyendo el Blob de Netlify (clave para que el zoom sea instantáneo).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ floor: string }> }) {
  const { floor } = await ctx.params;
  const plate = await getPlate(floor);
  // Adjuntamos la metadata de CADA unidad de los polígonos del plano. Clave para los
  // entrepisos: en el piso 3 hay polígonos de unidades del piso 2 (dúplex), que NO
  // están en los floorUnits del piso actual → sin esto saldrían grises/sin tooltip.
  // EN VIVO (Airtable): el color/estado/precio del plano refleja Airtable, no units.json.
  const all = await getLiveUnits();
  const units: Record<string, Unit> = {};
  if (plate) {
    for (const p of plate.polygons) {
      const u = all[p.unitId];
      if (u) units[p.unitId] = u;
    }
  }
  return NextResponse.json({ plate, units });
}
