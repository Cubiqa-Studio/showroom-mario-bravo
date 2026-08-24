import { NextResponse } from "next/server";
import { getLiveUnits } from "@/lib/data";

// Unidades con los campos en vivo de Airtable ya mergeados sobre units.json.
// Útil para VERIFICAR la conexión con Airtable (abrí /api/unidades y mirá que el
// `estado`/`precio` reflejen lo que cargaste). Revalida cada 60 s.
export const revalidate = 60;

export async function GET() {
  try {
    const units = await getLiveUnits();
    return NextResponse.json({ count: Object.keys(units).length, units });
  } catch (err) {
    console.error("[api/unidades] error:", err);
    return NextResponse.json({ error: "No se pudieron obtener las unidades." }, { status: 500 });
  }
}
