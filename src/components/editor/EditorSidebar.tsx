"use client";

import { useState } from "react";
import type { Units } from "@/lib/types";
import type { PolygonEditorApi } from "@/hooks/usePolygonEditor";
import { statusColor, statusLabel } from "@/lib/status";
import type { EditorSurface } from "./surface";

interface EditorSidebarProps {
  surface: EditorSurface;
  units: Units;
  ed: PolygonEditorApi;
}

export function EditorSidebar({ surface, units, ed }: EditorSidebarProps) {
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Unidades válidas (keys de units.json) ordenadas asc; cuáles ya tienen polígono;
  // y la metadata de la que está seleccionada en el input (si existe).
  const knownUnitIds = Object.keys(units).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  const placedIds = new Set(ed.saved.map((p) => p.unitId));
  // Cuántas unidades VÁLIDAS ya tienen polígono (ignora placeholders sin metadata).
  const placedKnown = knownUnitIds.filter((id) => placedIds.has(id)).length;
  const idTyped = ed.unitId.trim();
  const selected = idTyped ? units[idTyped] : undefined;

  const onFinish = () => setMsg(ed.finish() ?? "Polígono agregado ✓");

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(surface.saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygons: ed.saved,
          imageWidth: surface.imageWidth,
          imageHeight: surface.imageHeight,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
      setMsg(`Guardado en ${surface.fileName} ✓`);
    } catch (e) {
      setMsg(`Error al guardar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const onExport = async () => {
    const json = JSON.stringify({ polygons: ed.saved }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setMsg("JSON copiado al portapapeles ✓");
    } catch {
      setMsg("No se pudo copiar — el JSON está en la consola.");
      console.log(json);
    }
  };

  /**
   * Baja el stops.json COMPLETO y actual (todas las vistas) desde el store, para
   * pegarlo en src/data/stops.json del repo y deployar a cualquier host. Guardá
   * el stop actual antes, así el export incluye tus últimos cambios.
   */
  const onExportAll = async () => {
    setMsg(null);
    try {
      const res = await fetch(surface.exportAllUrl);
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
      }
      const text = await res.text();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = surface.fileName;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`${surface.fileName} exportado ✓ — reemplazalo en src/data/ y commiteá.`);
    } catch (e) {
      setMsg(`Error al exportar: ${(e as Error).message}`);
    }
  };

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-slate-200">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Polígono actual
        </h2>
        <label className="mt-2 block text-xs text-slate-400" htmlFor="unitId">
          unitId
        </label>
        <input
          id="unitId"
          list="known-units"
          value={ed.unitId}
          onChange={(e) => ed.setUnitId(e.target.value)}
          placeholder="ej. 702"
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white outline-none focus:border-sky-400"
        />
        <datalist id="known-units">
          {knownUnitIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>

        {/* Preview de la metadata de la unidad elegida, o aviso si el ID no existe. */}
        {idTyped &&
          (selected ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-300">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: statusColor(selected.status) }}
              />
              {selected.beds} amb · {selected.baths} baño(s) · {selected.sqft} sqft ·{" "}
              {statusLabel(selected.status)} · {selected.price}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-amber-400">
              ⚠ &laquo;{idTyped}&raquo; no existe en units.json — el polígono no tendrá
              datos. Elegí una unidad de la lista de abajo.
            </p>
          ))}

        {/* Selector de unidades: TODAS las de units.json, ordenadas. Punto de color =
            estado. ✓ + atenuada = ya tiene polígono en este stop. Clic en una libre la
            asigna al polígono actual. La metadata NO se edita acá: sale de units.json. */}
        <p className="mt-3 text-xs text-slate-400">
          Asigná una unidad{" "}
          <span className="text-slate-500">
            ({placedKnown}/{knownUnitIds.length} con polígono)
          </span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {knownUnitIds.map((id) => {
            const isPlaced = placedIds.has(id);
            const isSel = idTyped === id;
            const u = units[id];
            return (
              <button
                key={id}
                type="button"
                disabled={isPlaced}
                onClick={() => ed.setUnitId(id)}
                title={
                  isPlaced
                    ? `${id} · ya tiene polígono (editalo en la lista de abajo)`
                    : `${id} · ${statusLabel(u.status)} · ${u.price} — clic para asignar`
                }
                className={[
                  "flex items-center gap-1 rounded-md border px-1.5 py-1 font-mono text-xs transition",
                  isPlaced
                    ? "cursor-default border-slate-700 bg-slate-900/40 text-slate-500"
                    : isSel
                      ? "border-sky-400 bg-sky-500/20 text-white"
                      : "border-slate-600 bg-slate-900 text-slate-200 hover:border-sky-500 hover:text-white",
                ].join(" ")}
              >
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: statusColor(u.status) }}
                />
                {id}
                {isPlaced && <span className="text-emerald-400">✓</span>}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-slate-400">
          {ed.current.length} vértice(s) — clic para agregar, arrastrá para mover.
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={ed.undoVertex}
            disabled={!ed.current.length}
            className="rounded-md bg-slate-700 px-2 py-1.5 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
          >
            ↩ Deshacer
          </button>
          <button
            type="button"
            onClick={ed.clearCurrent}
            disabled={!ed.current.length && !ed.unitId}
            className="rounded-md bg-slate-700 px-2 py-1.5 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
          >
            ✕ Limpiar
          </button>
        </div>
        <button
          type="button"
          onClick={onFinish}
          disabled={ed.current.length < 3}
          className="mt-2 w-full rounded-md bg-sky-600 px-2 py-2 text-sm font-semibold hover:bg-sky-500 disabled:opacity-40"
        >
          Cerrar polígono
        </button>
      </section>

      <section className="border-t border-slate-700 pt-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Polígonos · {surface.label} ({ed.saved.length})
        </h2>
        <ul className="mt-2 space-y-1">
          {ed.saved.map((poly) => (
            <li
              key={poly.unitId}
              className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1.5 text-sm"
            >
              <span className="font-mono">
                {poly.unitId}
                {!units[poly.unitId] && (
                  <span className="ml-1 text-amber-400" title="Sin metadata en units.json">
                    ⚠
                  </span>
                )}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => ed.editPolygon(poly.unitId)}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs hover:bg-slate-600"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => ed.deletePolygon(poly.unitId)}
                  className="rounded bg-red-900/70 px-2 py-0.5 text-xs hover:bg-red-800"
                >
                  Borrar
                </button>
              </span>
            </li>
          ))}
          {!ed.saved.length && (
            <li className="text-xs text-slate-500">Todavía no hay polígonos.</li>
          )}
        </ul>
      </section>

      <section className="border-t border-slate-700 pt-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-md bg-emerald-600 px-2 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Guardando…" : `💾 Guardar en ${surface.fileName}`}
        </button>
        <button
          type="button"
          onClick={onExport}
          className="mt-2 w-full rounded-md bg-slate-700 px-2 py-1.5 text-xs font-medium hover:bg-slate-600"
        >
          Copiar JSON (esta vista)
        </button>
        <button
          type="button"
          onClick={onExportAll}
          className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-700"
        >
          ⬇ Exportar {surface.fileName} (todo)
        </button>
        {msg && <p className="mt-2 text-xs text-slate-300">{msg}</p>}
      </section>
    </aside>
  );
}
