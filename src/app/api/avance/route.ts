import { NextResponse } from "next/server";
import { getAvance } from "@/lib/data";

// Avance de obra (% general + fecha) en vivo desde Airtable. null si no hay datos
// o si la tabla no está configurada. Revalida cada 60 s.
export const revalidate = 60;

export async function GET() {
  try {
    const avance = await getAvance();
    return NextResponse.json({ avance });
  } catch (err) {
    console.error("[api/avance] error:", err);
    return NextResponse.json({ error: "No se pudo obtener el avance de obra." }, { status: 500 });
  }
}
