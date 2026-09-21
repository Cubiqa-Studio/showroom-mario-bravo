"use client";

import { useEffect, useState } from "react";
import type { Units } from "@/lib/types";
import type { CubiqaBrochure } from "@/lib/cubiqa-types";
import { BROCHURE_FALLBACK } from "@/lib/contact";
import { getProyecto, onProyecto, proyectoResuelto } from "@/lib/project-store";

// ─────────────────────────────────────────────────────────────────────────────
// Los hooks que leen la capa EN VIVO (back de Cubiqa). Todos se cuelgan del MISMO
// pedido: el fetch vive en `@/lib/project-store` y se hace UNA vez por carga de
// página, monten los hooks que monten. Ver la nota larga de ese archivo.
//
// Las firmas no cambiaron cuando la fuente pasó de Airtable a Cubiqa — por eso
// ShowroomClient, ResidenciaLandingLive, UnitFinderModal, MasterplanModal y
// SideMenu no se tocaron.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las unidades EN VIVO (estado/precio/ambientes/superficies/vistas ya mergeados
 * con units.json), o `null` mientras no llegaron — o si el pedido falló.
 *
 * Devolver `null` en vez de un fallback es lo que le permite a quien llama
 * distinguir "todavía no sé" de "ya sé": la ficha standalone usa eso para seguir
 * mostrando lo que horneó el servidor hasta tener el dato real, sin tener que
 * recibir el map entero por props (ver ResidenciaLandingLive).
 *
 * `enabled` permite abrirlo lazily (p. ej. `enabled` = modal abierto) para no
 * pegarle al endpoint hasta que haga falta.
 */
export function useLiveUnitsOrNull(enabled = true): Units | null {
  // Sembrado con el valor ya resuelto: un modal que se monta tarde muestra el
  // dato real desde el primer frame, sin parpadear con lo horneado.
  const [units, setUnits] = useState<Units | null>(() => proyectoResuelto()?.units ?? null);


  useEffect(() => {
    if (!enabled) return;
    let vivo = true;
    // `p.units` puede ser null (el back contestó pero sin unidades): en ese caso
    // no se pisa nada y queda lo horneado. Ver ProyectoResuelto.
    const aplicar = (p: { units: Units | null } | null) => {
      if (vivo && p?.units) setUnits(p.units);
    };
    const baja = onProyecto(aplicar);
    void getProyecto().then(aplicar);
    return () => {
      vivo = false;
      baja();
    };
  }, [enabled]);

  return units;
}

/**
 * Igual que `useLiveUnitsOrNull` pero con un piso: arranca en `fallback` y lo
 * reemplaza cuando llega el dato real. Si nunca llega, queda el fallback (no rompe).
 *
 * Es la forma que consumen el showroom (donde el fallback son las unidades horneadas
 * en el build) y los componentes que no las reciben por props — p. ej. el
 * MasterplanModal, que se monta tanto en el showroom como en la ficha.
 */
export function useLiveUnits(fallback: Units, enabled = true): Units {
  return useLiveUnitsOrNull(enabled) ?? fallback;
}

/**
 * El BROCHURE del proyecto, del mismo pedido que las unidades: `undefined` mientras
 * no se sabe, `null` si el cliente no subió ninguno.
 *
 * Quien lo usa arranca con el valor horneado en el build (ver `BROCHURE_FALLBACK`
 * en src/lib/contact.ts), así que el botón no parpadea ni aparece de golpe.
 */
export function useBrochure(enabled = true): CubiqaBrochure | null | undefined {
  const [brochure, setBrochure] = useState<CubiqaBrochure | null | undefined>(
    () => proyectoResuelto()?.brochure,
  );

  useEffect(() => {
    if (!enabled) return;
    let vivo = true;
    const baja = onProyecto((p) => {
      if (vivo && p) setBrochure(p.brochure);
    });
    void getProyecto().then((p) => {
      if (vivo && p) setBrochure(p.brochure);
    });
    return () => {
      vivo = false;
      baja();
    };
  }, [enabled]);

  return brochure;
}

/**
 * La URL a la que apuntan los dos botones de "Brochure", ya resuelta: la del panel
 * de Cubiqa si hay una, y si no el PDF commiteado. `null` = no hay brochure por
 * ningún lado y los botones se ocultan.
 *
 * El fallback NO es sólo para el "mientras carga": si Cubiqa devuelve `null`
 * porque el cliente todavía no subió el suyo, el sitio sigue ofreciendo el que ya
 * tenía. Estrenar la integración no puede hacerle perder un botón que hoy funciona.
 *
 * ⚠ EL `?v=` NO ES DECORACIÓN. El back guarda el PDF siempre con la misma clave
 * (`<projectId>/brochure/brochure.pdf`) y lo pisa al re-subir, así que la url del
 * CDN es IDÉNTICA entre versiones: lo único que cambia es `updatedAt`. Sin colgarlo
 * de la url, el cliente sube un brochure nuevo y el visitante —y el edge de Bunny,
 * que cachea 30 días— siguen bajando el viejo sin nada que los invalide. La cache de
 * 60 s del proxy no ayuda: cachea el JSON, no el PDF. Un query string no cambia el
 * nombre del objeto en el CDN ni necesita CORS.
 */
export function useBrochureHref(enabled = true): string | null {
  const brochure = useBrochure(enabled);
  if (!brochure) return BROCHURE_FALLBACK;
  const v = brochure.updatedAt;
  return v ? `${brochure.downloadUrl}?v=${encodeURIComponent(v)}` : brochure.downloadUrl;
}
