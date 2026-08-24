import seed from "@/data/stops.json";
import type { Stop, StopsFile } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Almacén persistente de la GEOMETRÍA (stops.json) para edición en producción.
//
// En Netlify lee/escribe un Blob ("showroom/stops"); el JSON commiteado queda
// como SEMILLA/fallback, así nada se rompe si el Blob todavía no existe o no hay
// contexto de Netlify (p.ej. `next dev` local → usa el archivo de siempre).
// units.json y flyby.json siguen horneados (el editor sólo toca polígonos).
// ─────────────────────────────────────────────────────────────────────────────

const STORE = "showroom";
const KEY = "stops";
const seedFile = seed as unknown as StopsFile;

/**
 * Fusiona la SEMILLA (estructura canónica del deploy, incluye stops recién
 * agregados) con el BLOB (geometría editada online). El editor SÓLO toca polígonos,
 * así que el Blob aporta ÚNICAMENTE eso: los `polygons` de cada stop. El resto de
 * campos (image, video, imageWidth/Height, frame) viene SIEMPRE de la semilla del
 * deploy. La semilla también aporta los stops que el Blob todavía no tiene.
 *
 * ⚠️ Antes el Blob pisaba el stop ENTERO (`byId.set(s.id, s)`). Eso borraba en
 * producción cualquier campo nuevo agregado por deploy DESPUÉS de sembrar el Blob:
 * cuando se sumó `video` (cinemagraphs), un Blob viejo sin ese campo lo eliminaba →
 * `currentStop.video` quedaba undefined → el visor pintaba el `<img>` estático en
 * vez del `<video>`. Tomando sólo `polygons` del Blob, los campos nuevos sobreviven
 * y las geometrías digitalizadas se preservan igual.
 */
function mergeStops(blob: StopsFile): StopsFile {
  const byId = new Map<number, Stop>();
  for (const s of seedFile.stops) byId.set(s.id, s);
  for (const s of blob.stops) {
    const base = byId.get(s.id);
    byId.set(s.id, base ? { ...base, polygons: s.polygons ?? base.polygons } : s);
  }
  const seedIds = new Set(seedFile.stops.map((s) => s.id));
  // Orden estable: primero el orden de la semilla (con la versión del Blob donde
  // exista), luego cualquier stop que sólo viva en el Blob.
  return {
    stops: [
      ...seedFile.stops.map((s) => byId.get(s.id)!),
      ...blob.stops.filter((s) => !seedIds.has(s.id)),
    ],
  };
}

/** Lee el stops fusionando Blob + semilla; sin contexto Netlify, la semilla sola. */
export async function readStopsFile(): Promise<StopsFile> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const data = (await getStore(STORE).get(KEY, { type: "json" })) as StopsFile | null;
    if (data?.stops?.length) return mergeStops(data);
  } catch {
    // Sin contexto de Netlify (next dev local, build, etc.) → caemos a la semilla.
  }
  return seedFile;
}

/** Persiste el stops. En Netlify → Blob; local sin Netlify → archivo (flujo dev). */
export async function writeStopsFile(data: StopsFile): Promise<"blob" | "fs"> {
  try {
    const { getStore } = await import("@netlify/blobs");
    await getStore(STORE).setJSON(KEY, data);
    return "blob";
  } catch {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    await fs.writeFile(
      path.join(process.cwd(), "src", "data", "stops.json"),
      JSON.stringify(data, null, 2) + "\n",
      "utf-8",
    );
    return "fs";
  }
}
