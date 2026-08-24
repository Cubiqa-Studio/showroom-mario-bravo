import { NextResponse } from "next/server";
import { readPlatesFile } from "@/lib/plates-store";

export const dynamic = "force-dynamic";

/**
 * Devuelve el plates.json COMPLETO y actual — Blob en prod, archivo/semilla en
 * local. Fuente de verdad para bajar, commitear y deployar. Lo protege el
 * middleware (Basic Auth con ADMIN_PASSWORD en prod).
 */
export async function GET() {
  const data = await readPlatesFile();
  return new NextResponse(JSON.stringify(data, null, 2) + "\n", {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="plates.json"',
    },
  });
}
