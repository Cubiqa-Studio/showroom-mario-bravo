import Link from "next/link";
import { getFloors, getPlateForEdit, getUnits } from "@/lib/data";
import { PolygonEditor } from "@/components/editor/PolygonEditor";
import { surfaceFromPlate } from "@/components/editor/surface";

export const dynamic = "force-dynamic";

/**
 * Editor de polígonos de la PLANTA DE UN PISO. Mismo digitalizador que los stops
 * (vía la abstracción `EditorSurface`): se traza sobre la imagen del plano del
 * piso y se asignan unitIds. Persiste en plates.json (Blob/semilla). Cuando una
 * plate tiene polígonos, la landing muestra la planta trazada en vez del esquemático.
 */
export default async function PlateEditorPage({
  params,
}: {
  params: Promise<{ floor: string }>;
}) {
  const { floor } = await params;
  const plate = await getPlateForEdit(floor);
  const units = getUnits();
  const floors = getFloors();

  // Pisos ordenados → flechas anterior/siguiente, igual que el editor de stops.
  const pos = floors.indexOf(floor);
  const prevFloor = pos > 0 ? floors[pos - 1] : null;
  const nextFloor = pos >= 0 && pos < floors.length - 1 ? floors[pos + 1] : null;
  const arrow =
    "rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm font-medium transition hover:border-slate-600";
  const arrowOff = "pointer-events-none border-slate-800 bg-slate-900 text-slate-600";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <header className="mx-auto mb-6 flex max-w-6xl flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Admin · Cubiqa
          </p>
          <h1 className="text-xl font-bold">Editor de plantas — piso {floor}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Trazá la planta del piso sobre el plano: clic para vértices · arrastrá para
            ajustar · asigná el unitId · Cerrar polígono · Guardar. Reemplazá la imagen
            placeholder por el plano real del piso en <code>plates.json</code>.
          </p>
          <nav className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={prevFloor !== null ? `/admin/polygon-editor/plano/${prevFloor}` : "#"}
              aria-disabled={prevFloor === null}
              className={[arrow, prevFloor === null ? arrowOff : ""].join(" ")}
            >
              ‹ Anterior
            </Link>
            {floors.map((f) => (
              <Link
                key={f}
                href={`/admin/polygon-editor/plano/${f}`}
                className={[
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  f === floor
                    ? "border-sky-400 bg-sky-500/20 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600",
                ].join(" ")}
              >
                {f === "0" ? "PB" : `Piso ${f}`}
              </Link>
            ))}
            <Link
              href={nextFloor !== null ? `/admin/polygon-editor/plano/${nextFloor}` : "#"}
              aria-disabled={nextFloor === null}
              className={[arrow, nextFloor === null ? arrowOff : ""].join(" ")}
            >
              Siguiente ›
            </Link>
          </nav>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/polygon-editor/0"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:border-slate-600"
          >
            ← Editor de stops
          </Link>
          <Link
            href="/showroom"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:border-slate-600"
          >
            Volver a la galería
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        <PolygonEditor surface={surfaceFromPlate(plate)} units={units} />
      </div>
    </main>
  );
}
