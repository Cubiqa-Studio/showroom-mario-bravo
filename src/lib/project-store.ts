"use client";

import unitsData from "@/data/units.json";
import type { Units } from "./types";
import type { CubiqaBrochure } from "./cubiqa-types";
import { API_PROYECTO } from "./api";
import { mergeLiveUnits, parseProyecto, unidadesHuerfanas } from "./cubiqa-parse";

// ─────────────────────────────────────────────────────────────────────────────
// UNA sola llamada al back por CARGA DE PÁGINA. Ni una más, ni una menos.
//
// Es un pedido explícito de Cubiqa: el back vive en un Hostinger compartido, y
// antes cada componente que necesitaba las unidades abría su propio fetch (el
// `useRef` de dedupe de `useLiveUnits` era POR INSTANCIA del hook, así que el
// showroom, el buscador y el plan maestro pedían tres veces lo mismo).
//
// El mecanismo es una PROMESA A NIVEL DE MÓDULO, y esa elección es la que da
// exactamente la vida útil que se pidió:
//
//   · un módulo JS se evalúa UNA vez por DOCUMENTO;
//   · una navegación del router (SPA) NO lo vuelve a evaluar → 0 pedidos al ir del
//     showroom a una ficha y volver;
//   · un F5 crea un documento nuevo → se vuelve a pedir, que es justo lo que
//     significa "recargar la página" para un visitante que quiere el precio de hoy.
//
// ⚠ `sessionStorage` NO sirve acá, aunque parezca lo mismo: sobrevive al reload, o
// sea que rompe el requisito por el otro lado (un F5 dejaría de traer dato fresco)
// y encima necesita try/catch por el modo privado. La variable de módulo se muere
// exactamente cuando tiene que morirse.
//
// Es el mismo patrón que ya usa `FloorPlate` para las plantas (`plantasResueltas` /
// `plantasEnVuelo`) — se copió la convención en vez de inventar otra.
//
// EL FALLO NO SE MEMOIZA: si el pedido se cae, se libera el flag para que un
// remontaje reintente. Es el mismo criterio que tenía el `pedido.current = false`
// del hook viejo, y lo que hace que una pérdida de conexión momentánea no deje al
// sitio con datos horneados hasta el próximo F5.
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata base del sitio (planos, tours, geometría, dorm/baño, exposición). El
 *  back sólo pisa estado/precio/ambientes/superficies/vistas encima. Ya venía en el
 *  bundle (lo importan el buscador y el plan maestro como fallback), así que no
 *  agrega peso. */
const BASE = unitsData as unknown as Units;

export interface ProyectoResuelto {
  /** units.json con los campos en vivo ya pisados, o `null` si el back no trajo
   *  NINGUNA unidad (proyecto recién creado, catálogo sin cargar, id equivocado).
   *
   *  Nullable a propósito: un `Units` vacío-pero-presente le ganaría a las unidades
   *  horneadas en el build (`useLiveUnits(fallback)` hace `?? fallback`, así que sólo
   *  un null deja pasar el fallback) y el sitio se repintaría a todo verde y
   *  "Consultar" unos cientos de ms después de cargar. */
  units: Units | null;
  /** El brochure del proyecto, o `null` si el cliente no subió ninguno. */
  brochure: CubiqaBrochure | null;
}

let enVuelo: Promise<ProyectoResuelto | null> | null = null;
/** `undefined` = todavía no se pidió · `null` = se pidió y no hubo dato. */
let resuelto: ProyectoResuelto | null | undefined;

/** Quienes esperan el dato (los hooks). Se les avisa una vez y se limpia. */
const suscriptores = new Set<(p: ProyectoResuelto | null) => void>();

function avisar(p: ProyectoResuelto | null): void {
  for (const fn of suscriptores) fn(p);
}

/**
 * El proyecto EN VIVO. La primera llamada dispara el pedido; las siguientes
 * reciben la MISMA promesa (o el valor ya resuelto) sin tocar la red.
 *
 * Devuelve `null` —y no un fallback— cuando no hay dato, para que quien llama
 * pueda distinguir "todavía no sé" de "ya sé": es lo que le permite a la ficha
 * standalone seguir mostrando lo que horneó el build hasta tener el dato real.
 */
export function getProyecto(): Promise<ProyectoResuelto | null> {
  if (resuelto !== undefined) return Promise.resolve(resuelto);
  if (enVuelo) return enVuelo;

  enVuelo = fetch(API_PROYECTO, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      // El endpoint devuelve el `data` del back tal cual, bajo `project`. El
      // mapeo y el merge se hacen acá, con el MISMO código que usa el build
      // (src/lib/cubiqa-parse.ts).
      const { units, brochure } = parseProyecto(body?.project);
      const hayUnidades = Object.keys(units).length > 0;

      // NADA: ni unidades ni brochure. Puede ser el back caído, el proxy sin
      // configurar o un 404. NO se memoiza —se libera el flag— para que el próximo
      // montaje reintente: el proxy siempre responde 200 (con `project: null`), así
      // que si esto se guardara, un hipo de tres segundos justo en la carga dejaría
      // al visitante con los datos horneados TODA la sesión, sin un solo reintento
      // hasta el F5. Antes lo salvaba el dedupe por instancia del hook (abrir el
      // buscador era una segunda chance); con el singleton hay que decirlo acá.
      if (!hayUnidades && !brochure) {
        enVuelo = null;
        avisar(null);
        return null;
      }

      if (hayUnidades) avisarHuerfanas(units);
      // Las dos mitades por SEPARADO: un proyecto con brochure cargado pero sin
      // unidades no puede pisar las unidades horneadas con units.json pelado.
      resuelto = { units: hayUnidades ? mergeLiveUnits(BASE, units) : null, brochure };
      avisar(resuelto);
      return resuelto;
    })
    .catch(() => {
      // Sin conexión / proxy caído → se queda sin resolver y manda lo horneado.
      // Se libera el flag para que un remontaje vuelva a intentar.
      enVuelo = null;
      avisar(null);
      return null;
    });

  return enVuelo;
}

/**
 * Aviso de DEV cuando el back manda unidades que units.json no conoce.
 *
 * Es el fallo más probable de toda la integración y el más difícil de ver: si el
 * catálogo se cargó con otra nomenclatura ("1 01", "Unidad 101", "10" sin el cero),
 * el merge no matchea NADA y el sitio se ve exactamente igual que hoy —todo
 * disponible, todo "Consultar"—, sin un solo error en consola. Una integración
 * muerta puede pasar un QA manual completo.
 *
 * El chequeo duro, el que corta el deploy, es `npm run check:cubiqa`.
 */
function avisarHuerfanas(live: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  const huerfanas = unidadesHuerfanas(BASE, live as never);
  if (!huerfanas.length) return;
  console.warn(
    `[cubiqa] ${huerfanas.length} unidad(es) del back sin equivalente en units.json: ` +
      `${huerfanas.slice(0, 10).join(", ")}${huerfanas.length > 10 ? "…" : ""}. ` +
      `El match es por el número de unidad, como TEXTO. Corré \`npm run check:cubiqa\`.`,
  );
}

/** Se suscribe a la resolución del pedido. Devuelve la función de baja. */
export function onProyecto(fn: (p: ProyectoResuelto | null) => void): () => void {
  suscriptores.add(fn);
  return () => {
    suscriptores.delete(fn);
  };
}

/** El valor YA resuelto, si lo hay. Sirve para sembrar el `useState` inicial: un
 *  modal que se monta tarde muestra el dato real de entrada, sin parpadeo. */
export function proyectoResuelto(): ProyectoResuelto | null {
  return resuelto ?? null;
}
