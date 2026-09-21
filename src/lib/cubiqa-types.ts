// ─────────────────────────────────────────────────────────────────────────────
// El CONTRATO de `GET /api/projects/:id/public` del back de Cubiqa
// (client-projects-controller-ms), tal como viaja por el cable.
//
// Son los tipos CRUDOS: nombres en inglés, enums en inglés, precios como número.
// La traducción al dominio del showroom vive en `./cubiqa-parse`. Separarlos no es
// ceremonia: el parseo lo corren DOS lugares distintos (el build en Node y el
// navegador en runtime) y los dos tienen que leer el JSON exactamente igual.
//
// ⚠ Ese endpoint NO declara response schema en fastify (`projectSchema.ts` sólo
// declara `params`), así que el back serializa el objeto tal cual sale de la query:
//   · no hay stripping — si Cubiqa le agrega un campo al DTO, aparece solo acá;
//   · `createdAt`/`updatedAt` están tipados `Date` allá pero llegan como STRING ISO,
//     porque los serializa `JSON.stringify`. Por eso acá son `string`.
// Corolario: nada de lo que venga por la red se castea; todo se valida en el parser.
//
// Los enums y sus etiquetas en español son copia TEXTUAL de
// `src/config/unit-localization.ts` de los dos paneles de Cubiqa (admin y
// dashboard), que las tienen idénticas entre sí. Ahí están las etiquetas que ve el
// cliente cuando carga la unidad, así que son las canónicas: si el showroom
// tradujera por su cuenta, el mismo dato se llamaría distinto en los dos lados.
// ─────────────────────────────────────────────────────────────────────────────

/** `UnitState` del back. El showroom tiene los tres (ver `UnitStatus`). */
export type CubiqaUnitState = "Available" | "Reserved" | "Sold";

/**
 * `UnitTypology` del back. ⚠ NO es la tipología del showroom (la letra A–E que
 * agrupa plano + tour 360°): sus paneles la muestran como "MONOAMBIENTE" /
 * "3 AMBIENTES" / "SEMIPISO", o sea que repite el conteo de ambientes que ya viene
 * en `bedrooms`. El parser la descarta — ver la nota en `Unit.tipologia`.
 */
export type CubiqaUnitTypology =
  | "1" | "2" | "3" | "4" | "5" | "6" | "7"
  | "half-floor"
  | "full-floor";

/** `UnitView` del back: a qué da la unidad. */
export type CubiqaUnitView =
  | "front" | "rear"
  | "north" | "northwest" | "northeast"
  | "south" | "southeast" | "southwest"
  | "east" | "west";

/** Una unidad como la manda el back. Todos los campos son obligatorios allá
 *  (columnas NOT NULL); igual se los trata como desconocidos al parsear. */
export interface CubiqaUnit {
  id: string;
  projectId: string;
  /** El número de unidad como TEXTO ("101", "010"). Es la clave de match contra
   *  las keys de units.json. */
  name: string;
  floor: string;
  typology: CubiqaUnitTypology;
  bedrooms: number;
  coveredArea: number;
  semiCoveredArea: number;
  totalArea: number;
  usdPrice: number;
  state: CubiqaUnitState;
  view: CubiqaUnitView;
  createdAt: string;
  updatedAt: string;
}

/** El brochure del proyecto. `null` cuando el cliente todavía no subió ninguno. */
export interface CubiqaBrochure {
  id: string;
  type: "PDF";
  /** Nombre ORIGINAL con el que se subió ("TIER_Bravo_Brochure.pdf"). En el storage
   *  el archivo siempre se llama `brochure.pdf`; éste es el nombre "de mostrar".
   *  ⚠ Es texto libre cargado por un admin: nunca se interpola sin sanitizar. */
  filename: string;
  pageCount: number;
  /** Bytes. */
  size: number;
  thumbnailUrl: string;
  /** URL pública del PDF en el CDN de Bunny (sin auth). */
  downloadUrl: string;
  updatedAt: string;
}

/** El `data` de la respuesta. El sobre (`{statusCode, success, data}`) lo desarma
 *  el proxy, así que a `parseProyecto` le llega ya esto. */
export interface CubiqaPublicProject {
  id: string;
  name: string;
  units: CubiqaUnit[];
  brochure: CubiqaBrochure | null;
}

// Las etiquetas en español de `view` y la lista de rumbos NO están acá sino en
// `./cubiqa-parse`, junto al resto del mapeo. Es a propósito: este archivo sólo
// declara TIPOS (se borra entero al compilar) y eso es lo que le permite a
// `cubiqa-parse` no tener ni un solo import de runtime — que es lo que hace que
// `scripts/check-cubiqa.mjs` pueda importarlo con el TypeScript pelado de Node.
