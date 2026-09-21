import { NextResponse, type NextRequest } from "next/server";
import { getPlate, getUnits, getPlateFloors } from "@/lib/data";
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
  //
  // ⚠ ESTÁTICA (units.json) A PROPÓSITO, no en vivo. Este handler es `force-static`:
  // lo que devuelva se hornea en out/api/plate/<piso> y queda CONGELADO hasta el
  // próximo build. Sirviendo el estado en vivo desde acá, una unidad que se vendiera
  // después del build se quedaba con su color del día del build para siempre — y
  // encima le ganaba al dato fresco que el cliente ya tenía en memoria (ver el orden
  // del merge en FloorPlate). Este endpoint aporta GEOMETRÍA y el relleno de las
  // unidades de otro piso; el estado lo pone el cliente.
  const all = getUnits();
  const units: Record<string, Unit> = {};
  if (plate) {
    for (const p of plate.polygons) {
      const u = all[p.unitId];
      if (u) units[p.unitId] = u;
    }
  }
  return NextResponse.json({ plate, units });
}
