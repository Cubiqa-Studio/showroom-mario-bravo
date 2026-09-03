import { NextResponse } from "next/server";
import { fetchAirtableUnitRecords } from "@/lib/airtable";

// ─────────────────────────────────────────────────────────────────────────────
// SÓLO DEV (`route.dev.ts` — ver la nota de `pageExtensions` en next.config.ts).
//
// En producción este endpoint lo atiende el proxy PHP de deploy/hostinger, porque
// el token de Airtable no puede viajar en el bundle de un sitio estático. Acá vive
// el equivalente para `next dev`, para que trabajar en local no cambie en nada.
//
// CONTRATO: devuelve los registros CRUDOS de Airtable, `{ records: [...] }`. El
// mismo que devuelve el PHP. El parseo y el merge sobre units.json los hace el
// cliente (src/lib/airtable-parse.ts) → una sola fuente de verdad para los nombres
// de columna, y el proxy no necesita saber nada del dominio.
//
// Útil para VERIFICAR la conexión con Airtable: abrí /api/unidades y mirá que los
// `fields` reflejen lo que cargaste en la base.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await fetchAirtableUnitRecords();
    return NextResponse.json({ records });
  } catch (err) {
    console.error("[api/unidades] error:", err);
    return NextResponse.json({ error: "No se pudieron obtener las unidades." }, { status: 500 });
  }
}
