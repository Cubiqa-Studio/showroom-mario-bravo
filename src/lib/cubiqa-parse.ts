import type { Unit, Units } from "./types";
import type {
  CubiqaBrochure,
  CubiqaPublicProject,
  CubiqaUnit,
  CubiqaUnitView,
} from "./cubiqa-types";

// ─────────────────────────────────────────────────────────────────────────────
// Traducción `GET /projects/:id/public` → tipos del showroom. TODO PURO: sin
// fetch, sin config, sin `server-only`. Corre igual en el build y en el navegador.
//
// Está separado del fetch (`./cubiqa`) porque con el export estático la data en
// vivo se pide DOS veces desde lugares distintos, y las dos tienen que interpretar
// la respuesta exactamente igual:
//
//   · EN EL BUILD (Node): `cubiqa.ts` le pega al back y hornea el resultado en el
//     HTML, para que la primera pintura del showroom y el JSON-LD de cada ficha
//     salgan con datos reales.
//   · EN EL NAVEGADOR (runtime): el sitio le pide lo mismo al proxy del propio
//     dominio y lo parsea acá (ver `./project-store`).
//
// Duplicar esto en el proxy (PHP) sería tener dos implementaciones del mismo
// mapeo; por eso el proxy es TONTO: pasa el `data` del back tal cual y no sabe
// nada del dominio. Igual que hacía el de Airtable.
//
// ── QUÉ MANDA CUBIQA Y QUÉ HACE EL SHOWROOM CON ESO ──────────────────────────
//
//   name            → la KEY de units.json (match por texto)
//   state           → status        Available/Reserved/Sold → available/reserved/sold
//   usdPrice        → price         120500 → "USD 120.500"   (0 = sin precio)
//   bedrooms        → ambientes     (sí, ambientes: ver abajo)
//   coveredArea     → areas.interior
//   semiCoveredArea → areas.exterior
//   totalArea       → areas.total
//   view (rumbos)   → vistas        "northwest" → "Noroeste"
//   typology        ✗ se descarta   (duplica ambientes; la tipología del showroom
//                                    es la letra A–E de units.json)
//   view front/rear ✗ se descarta   (eso es `exposure`, relevada del plano)
//   floor           ✗ se descarta   (se deriva del id de la unidad)
//   id/projectId/fechas ✗
//
// Sin contrapartida en Cubiqa, y por lo tanto SÓLO en units.json: `beds`, `baths`,
// `toilette`, `duplex`, `terraza`, `exposure`, `tour360`, `floorPlan` y
// `areas.comun`.
//
// ── POR QUÉ `bedrooms` ES "AMBIENTES" Y NO "DORMITORIOS" ─────────────────────
// Suena al revés, pero es lo que el campo significa aguas arriba:
//   · los DOS paneles de Cubiqa rotulan esa columna "Ambientes" en español
//     (`unit-localization.ts`, admin y dashboard, idénticos);
//   · es `Float`/`DOUBLE` en la base — un dormitorio no es 1,5, un ambiente sí
//     ("1½ ambientes", convención AR);
//   · el ejemplo del propio back combina `typology: "1"` (= MONOAMBIENTE) con
//     `bedrooms: 1`, que en dormitorios sería 0;
//   · la palabra "dormitorio" no aparece en ninguno de los tres repos de Cubiqa.
// El showroom tiene los dos campos por separado (`beds` y `ambientes`) y
// confundirlos sale mal en silencio: el `<title>` de las 63 fichas dice "N amb.".
// `beds` se queda con el valor de units.json, que está relevado de los planos.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ ESTE ARCHIVO NO PUEDE TENER IMPORTS DE RUNTIME. Los tres de arriba son
// `import type`, o sea que desaparecen al compilar.
//
// No es purismo: lo importan TRES cosas distintas y una de ellas es
// `scripts/check-cubiqa.mjs`, que lo carga con el TypeScript pelado de Node
// (`--experimental-strip-types`). Ese modo sólo borra los tipos: no resuelve
// imports sin extensión ni alias `@/`, así que un solo `import { algo } from
// "./otro"` rompe el verificador — y el verificador es justamente lo que evita que
// una integración muerta llegue a producción.
//
// Por eso las dos tablas de abajo viven acá y no en `./cubiqa-types`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `UnitView` → la etiqueta que ve el cliente en el panel de Cubiqa.
 *
 * Copia TEXTUAL de `src/config/unit-localization.ts` de sus dos paneles (admin y
 * dashboard, idénticos entre sí). Son las canónicas: si el showroom tradujera por
 * su cuenta, el mismo dato se llamaría distinto en los dos lados.
 *
 * ⚠ La asimetría `southeast: "Sureste"` / `southwest: "Sudoeste"` está copiada tal
 * cual. No es un typo nuestro y no se "corrige".
 */
const VIEW_LABEL_ES: Record<CubiqaUnitView, string> = {
  front: "Frente",
  rear: "Contrafrente",
  north: "Norte",
  northwest: "Noroeste",
  northeast: "Noreste",
  south: "Sur",
  southeast: "Sureste",
  southwest: "Sudoeste",
  east: "Este",
  west: "Oeste",
};

/**
 * Los RUMBOS: los 8 valores de `view` que sí entran al showroom, como `vistas`.
 *
 * `front` y `rear` quedan afuera a propósito: eso es `exposure`, que está relevada
 * del plano para 62 de las 63 unidades y que el back no puede expresar bien (la 706
 * es pasante y no tiene exposición, pero `view` obliga a elegir una). Ver la nota
 * en `Unit.exposure`.
 */
const RUMBOS: readonly CubiqaUnitView[] = [
  "north", "northwest", "northeast",
  "south", "southeast", "southwest",
  "east", "west",
];

/** Los campos que Cubiqa controla EN VIVO para una unidad (match por `name`). */
export interface LiveUnitFields {
  status?: Unit["status"];
  price?: string;
  ambientes?: number;
  /** Superficie cubierta en m² (→ areas.interior). */
  superficieCubierta?: number;
  /** Semicubierta / descubierta en m² (→ areas.exterior). */
  superficieExterior?: number;
  /** Superficie total en m² (→ areas.total). */
  superficieTotal?: number;
  /** Rumbo al que da la unidad, ya traducido ("Noroeste"). */
  vistas?: string;
}

/** Lo que el showroom usa del proyecto: las unidades ya mapeadas + el brochure. */
export interface ProyectoEnVivo {
  units: Record<string, LiveUnitFields>;
  brochure: CubiqaBrochure | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚠⚠ LA TRAMPA DE LOS CEROS — leé esto antes de tocar los guards de abajo.
//
// En Airtable una celda vacía no existía: `fields["Precio USD"]` daba `undefined`,
// el parser no ponía el campo y el merge dejaba intacto el valor de units.json.
// Era imposible pisar un dato bueno con "nada".
//
// En Cubiqa NO hay celda vacía. Las diez columnas son NOT NULL con `minimum: 0`,
// así que una unidad a medio cargar no manda "nada": manda CERO. Y el merge salta
// un campo sólo si es `!= null` — y `0 != null` es `true`.
//
// O sea: un proyecto cargado con ceros de relleno pisaría las superficies
// verificadas de las 63 unidades con `0`, de una sola vez y en los dos lugares (el
// HTML horneado de las 63 fichas, el `floorSize` de cada JSON-LD, los `<title>`, y
// además el repintado en vivo). "0 m²" no se lee como un dato malo, se lee como un
// bug de CSS, así que puede pasar un QA entero sin que nadie lo cace.
//
// Por eso: para precio, total y cubierta, CERO SIGNIFICA "no cargado" y se
// descarta. Es una decisión, no una omisión.
//
// La semicubierta es el caso distinto: ahí `0` es un dato REAL y frecuente (una
// unidad sin balcón ni patio), y la ficha ya sabe ocultar la fila cuando vale 0.
// Se acepta ese cero, pero sólo si la fila da señales de estar cargada de verdad
// (tiene precio, total o cubierta). Así una unidad en blanco no "gana" un 0 que en
// units.json no estaba.
// ─────────────────────────────────────────────────────────────────────────────

/** Número real y POSITIVO, o `undefined`. El `0` se descarta (ver arriba). */
function positivo(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** `true` si la fila tiene al menos un número cargado — o sea, no está en blanco. */
function filaCargada(u: CubiqaUnit): boolean {
  return (
    positivo(u.usdPrice) !== undefined ||
    positivo(u.totalArea) !== undefined ||
    positivo(u.coveredArea) !== undefined
  );
}

/**
 * `UnitState` → `UnitStatus`, por igualdad EXACTA.
 *
 * Nada de `startsWith` ni de castear: si Cubiqa suma un cuarto estado, esto
 * devuelve `undefined` y la unidad se queda con el estado horneado, en vez de
 * meter un valor desconocido en `STATUS_STYLES` y tirar la pantalla entera (ver el
 * comentario de `estilo()` en ./status).
 */
function mapEstado(v: unknown): Unit["status"] | undefined {
  if (v === "Available") return "available";
  if (v === "Reserved") return "reserved";
  if (v === "Sold") return "sold";
  return undefined;
}

/**
 * `view` → `vistas`, SÓLO si es un rumbo.
 *
 * `front`/`rear` no entran: eso es `exposure`, y el showroom la tiene relevada del
 * plano. Mientras el cliente cargue todo como "Frente", `vistas` queda vacía y el
 * filtro "Vistas" del buscador se sigue ocultando solo, que es exactamente lo que
 * hace hoy.
 */
function mapVista(v: unknown): string | undefined {
  return RUMBOS.includes(v as never) ? VIEW_LABEL_ES[v as keyof typeof VIEW_LABEL_ES] : undefined;
}

/**
 * Precio legible: 226939 → "USD 226.939".
 *
 * El formato es el mismo que tenía la capa de Airtable, a propósito: `formatPrice`
 * (residencia.ts) y `parsePrice` (seo.ts) leen ESTE string, así que cambiarlo acá
 * les cambia el comportamiento a los dos. La moneda va horneada porque la columna
 * es "USD" allá y sin el prefijo la UI mostraría "$226.939" sin decir de qué peso
 * o dólar habla.
 */
function money(v: unknown): string | undefined {
  const n = positivo(v);
  return n === undefined ? undefined : `USD ${n.toLocaleString("es-AR")}`;
}

/** Texto recortado, o `undefined` si viene vacío. */
function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

/**
 * El `data` de la respuesta → `{ units, brochure }`.
 *
 * Tolerante a que no venga nada (proxy caído, proyecto sin cargar, forma
 * inesperada): devuelve el objeto vacío y el merge deja units.json intacto.
 */
export function parseProyecto(data: unknown): ProyectoEnVivo {
  const p = (data ?? {}) as Partial<CubiqaPublicProject>;
  const units: Record<string, LiveUnitFields> = {};

  for (const u of Array.isArray(p.units) ? p.units : []) {
    // `name` es la clave de match contra units.json ("101", "010"). Es TEXTO: los
    // ceros a la izquierda son significativos en otros showrooms, así que no se
    // convierte a número ni se normaliza más allá del trim.
    const name = str((u as CubiqaUnit)?.name);
    if (!name) continue;
    const row = u as CubiqaUnit;
    const cargada = filaCargada(row);
    units[name] = {
      status: mapEstado(row.state),
      price: money(row.usdPrice),
      ambientes: positivo(row.bedrooms),
      superficieCubierta: positivo(row.coveredArea),
      superficieTotal: positivo(row.totalArea),
      // El único campo donde un 0 explícito es un dato: "sin descubierta".
      superficieExterior:
        cargada && row.semiCoveredArea === 0 ? 0 : positivo(row.semiCoveredArea),
      vistas: mapVista(row.view),
    };
  }

  return { units, brochure: parseBrochure(p.brochure) };
}

/** El brochure, o `null`. Valida lo mínimo para no ofrecer un botón que baja nada. */
function parseBrochure(b: unknown): CubiqaBrochure | null {
  if (!b || typeof b !== "object") return null;
  const raw = b as Partial<CubiqaBrochure>;
  const downloadUrl = str(raw.downloadUrl);
  if (!downloadUrl) return null;
  return {
    id: str(raw.id) ?? "",
    type: "PDF",
    filename: str(raw.filename) ?? "brochure.pdf",
    pageCount: typeof raw.pageCount === "number" ? raw.pageCount : 0,
    size: typeof raw.size === "number" ? raw.size : 0,
    thumbnailUrl: str(raw.thumbnailUrl) ?? "",
    downloadUrl,
    updatedAt: str(raw.updatedAt) ?? "",
  };
}

/**
 * Pisa los campos en vivo sobre la metadata base de units.json.
 *
 * ⚠ Los `??` y los `!= null` de acá abajo SON el mecanismo de fallback, no azúcar:
 * un campo que el parser no puso (porque vino cero, vacío o desconocido) deja
 * intacto el de units.json. Si el back está caído o el proyecto está en blanco, el
 * sitio se ve exactamente como se ve hoy. Cambiar un `??` por un `=` rompe eso.
 *
 * Itera sobre `base`, no sobre lo que llegó: una unidad que Cubiqa manda y que no
 * existe en units.json se ignora (no hay polígono ni plano que mostrar). Eso tapa
 * el fallo más probable de la integración —que los `name` no coincidan con las
 * keys— así que `npm run check:cubiqa` lo grita antes de deployar.
 */
export function mergeLiveUnits(base: Units, live: Record<string, LiveUnitFields>): Units {
  const out: Units = {};
  for (const [id, u] of Object.entries(base)) {
    const f = live[id];
    if (!f) {
      out[id] = u;
      continue;
    }
    const areas = { ...(u.areas ?? {}) };
    if (f.superficieTotal != null) areas.total = f.superficieTotal;
    if (f.superficieCubierta != null) areas.interior = f.superficieCubierta;
    if (f.superficieExterior != null) areas.exterior = f.superficieExterior;
    // `areas.comun` NO se toca: Cubiqa no tiene ese campo. Queda el de units.json.
    out[id] = {
      ...u,
      status: f.status ?? u.status,
      price: f.price ?? u.price,
      ambientes: f.ambientes ?? u.ambientes,
      vistas: f.vistas ?? u.vistas,
      areas,
    };
  }
  return out;
}

/**
 * Las unidades que Cubiqa manda y que units.json no conoce. Es el síntoma de que
 * el catálogo se cargó con otra nomenclatura ("1 01", "Unidad 101", "10" sin el
 * cero) — y como el merge falla ABIERTO (el sitio se ve normal, sólo que sin dato
 * en vivo), sin esto una integración muerta pasa un QA manual completo.
 *
 * Lo usan el aviso de dev y `scripts/check-cubiqa.mjs`.
 */
export function unidadesHuerfanas(base: Units, live: Record<string, LiveUnitFields>): string[] {
  return Object.keys(live).filter((name) => !(name in base));
}
