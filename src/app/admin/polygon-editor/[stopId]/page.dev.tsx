import Link from "next/link";
import { getFloors, getStop, getStops, getUnits } from "@/lib/data";
import { PolygonEditor } from "@/components/editor/PolygonEditor";
import { surfaceFromStop } from "@/components/editor/surface";

export const dynamic = "force-dynamic";

export default async function PolygonEditorPage({
  params,
}: {
  params: Promise<{ stopId: string }>;
}) {
  const { stopId } = await params;
  const id = Number(stopId);
  const [stop, stops] = await Promise.all([getStop(id), getStops()]);
  const units = getUnits();

  // Ids de stops ordenados → para los chips y las flechas anterior/siguiente.
  const ids = stops.map((s) => s.id).sort((a, b) => a - b);
  const pos = ids.indexOf(id);
  const prevId = pos > 0 ? ids[pos - 1] : null;
  const nextId = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;
  // El editor de plantas arranca en el primer piso existente (PB = "0").
  const firstFloor = getFloors()[0] ?? "0";

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
          <h1 className="text-xl font-bold">Editor de polígonos — stop {stopId}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Clic para marcar vértices · arrastrá los puntos para ajustar · asigná el
            unitId · Cerrar polígono · Guardar.
          </p>
          <nav className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={prevId !== null ? `/admin/polygon-editor/${prevId}` : "#"}
              aria-disabled={prevId === null}
              className={[arrow, prevId === null ? arrowOff : ""].join(" ")}
            >
              ‹ Anterior
            </Link>
            {ids.map((sid) => (
              <Link
                key={sid}
                href={`/admin/polygon-editor/${sid}`}
                className={[
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  sid === id
                    ? "border-sky-400 bg-sky-500/20 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600",
                ].join(" ")}
              >
                Stop {sid}
              </Link>
            ))}
            <Link
              href={nextId !== null ? `/admin/polygon-editor/${nextId}` : "#"}
              aria-disabled={nextId === null}
              className={[arrow, nextId === null ? arrowOff : ""].join(" ")}
            >
              Siguiente ›
            </Link>
          </nav>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/polygon-editor/plano/${firstFloor}`}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:border-slate-600"
          >
            Editor de plantas →
          </Link>
          <Link
            href="/showroom"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:border-slate-600"
          >
            ← Volver a la galería
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        {stop ? (
          <PolygonEditor surface={surfaceFromStop(stop)} units={units} />
        ) : (
          <p className="text-red-400">No existe el stop {stopId} en stops.json.</p>
        )}
      </div>
    </main>
  );
}
