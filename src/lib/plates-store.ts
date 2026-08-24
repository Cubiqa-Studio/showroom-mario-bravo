import seed from "@/data/plates.json";
import type { PlatesFile } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Almacén persistente de la GEOMETRÍA de PLANTAS DE PISO (plates.json), espejo de
// `stops-store`. En Netlify lee/escribe un Blob ("showroom/plates"); el JSON
// commiteado queda como SEMILLA/fallback (next dev local, build, etc.).
// Una "plate" es estructuralmente como un Stop: imagen del plano + polígonos.
// ─────────────────────────────────────────────────────────────────────────────

const STORE = "showroom";
const KEY = "plates";
const seedFile = seed as unknown as PlatesFile;

/** Lee las plates desde el Blob; si no existe o no hay contexto Netlify, la semilla. */
export async function readPlatesFile(): Promise<PlatesFile> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const data = (await getStore(STORE).get(KEY, { type: "json" })) as PlatesFile | null;
    if (data?.plates?.length) return data;
  } catch {
    // Sin contexto de Netlify → caemos a la semilla.
  }
  return seedFile;
}

/** Persiste las plates. En Netlify → Blob; local sin Netlify → archivo (flujo dev). */
export async function writePlatesFile(data: PlatesFile): Promise<"blob" | "fs"> {
  try {
    const { getStore } = await import("@netlify/blobs");
    await getStore(STORE).setJSON(KEY, data);
    return "blob";
  } catch {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    await fs.writeFile(
      path.join(process.cwd(), "src", "data", "plates.json"),
      JSON.stringify(data, null, 2) + "\n",
      "utf-8",
    );
    return "fs";
  }
}
