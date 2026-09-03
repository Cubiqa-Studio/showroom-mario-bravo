import { NextResponse } from "next/server";
import { fetchAirtableAvanceRecords } from "@/lib/airtable";

// SÓLO DEV (ver la nota de `pageExtensions` en next.config.ts). En producción lo
// atiende el proxy PHP de deploy/hostinger. Mismo contrato que el PHP: registros
// CRUDOS de Airtable; el cliente los parsea con src/lib/airtable-parse.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await fetchAirtableAvanceRecords();
    return NextResponse.json({ records });
  } catch (err) {
    console.error("[api/avance] error:", err);
    return NextResponse.json({ error: "No se pudo obtener el avance de obra." }, { status: 500 });
  }
}
