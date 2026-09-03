import { NextResponse, type NextRequest } from "next/server";
import { getPlate, getLiveUnits, getPlateFloors } from "@/lib/data";
import type { Unit } from "@/lib/types";

// ESTÁTICO en el export. El Blob de Netlify no existe en Hostinger, así que la
// geometría de las plantas sale del plates.json commiteado: es 100% conocida en
// build y se hornea como un archivo por piso dentro de out/api/plate/. En
// `next dev` el handler sigue corriendo en vivo (y sigue leyendo el Blob si hay
// contexto de Netlify), así que el editor de polígonos trabaja igual que antes.
export const dynamic = "force-static";

export async function generateStaticParams() {
  return (await getPlateFloors()).map((floor) => ({ floor }));
}

/**
 * Endpoint PÚBLICO para la landing: devuelve la planta trazada de un piso, o null
 * si todavía no tiene polígonos. La landing lo pide LAZY al abrir la pestaña
 * "Planta del piso", así la navegación al detalle NUNCA se bloquea esperando los
 * planos (clave para que el zoom sea instantáneo) y no se bajan los diez planos de
 * entrada. En el export cada piso queda como un archivo en out/api/plate/, así que
 * el pedido lo sirve Apache de disco.
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
