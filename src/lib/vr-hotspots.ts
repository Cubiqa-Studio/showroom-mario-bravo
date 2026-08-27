// ─────────────────────────────────────────────────────────────────────────────
// Hotspots 360° por stop (la "bolita" que se ve sobre el render del showroom).
//
// Las coordenadas van en el ESPACIO NATIVO del render del stop —igual que los
// polígonos—, así la bolita trackea la imagen al hacer object-cover en cualquier
// viewport. Desde el drop del 27-08 las CINCO vistas comparten espacio (**4999×2812**);
// antes la 0 iba a 5k y las 1-3 a 4000×2250. Igual, la fuente de verdad sigue siendo
// `imageWidth`/`imageHeight` de `stops.json`, no este comentario.
//
// Para reubicar una bolita: abrí `public/stops/stop-<n>.jpg`, mirá en qué píxel cae
// el punto y escribilo acá. Ojo: el visor va con "cover", así que en un viewport más
// ancho que el propio render se recorta alto arriba y abajo, CENTRADO (mitad y mitad)
// — un punto muy al ras de un borde puede quedar fuera de cuadro.
// ─────────────────────────────────────────────────────────────────────────────

export interface VrHotspotConfig {
  /** Posición del hotspot en píxeles nativos del render del stop. */
  x: number;
  y: number;
  /** Escala de la bolita (1 = tamaño base). Permite achicarla por vista. */
  scale?: number;
  /** URL del recorrido 360° (Kuula). Sin esto la bolita se ve pero no abre nada. */
  kuulaUrl?: string;
  /** Render que muestra el PREVIEW del hover. Sin esto usa el render del stop. */
  previewImage?: string;
  /** Etiqueta del preview: "hall" (default) o "amenities". */
  previewKind?: "hall" | "amenities";
}

// ⚠ TIER BRAVO NO TIENE (TODAVÍA) 360° DE ESPACIOS COMUNES.
// Lo único que entregó el cliente son los 5 recorridos de DEPARTAMENTO (A–E), que
// viven en el `tour360` de cada unidad en `units.json`. No hay tour del hall ni de
// los amenities, así que estas dos constantes quedan en `null` y todo lo que las
// consume se esconde solo:
//   · la bolita del exterior se sigue viendo (el cliente la pidió en el Miro) pero
//     no abre nada hasta que llegue el tour;
//   · los items "Hall" y "Amenities" del submenú Tours no se muestran;
//   · el modal de Amenities queda sólo con las specs, sin el 360 embebido.
// Cuando Camila mande las colecciones, pegá acá las URLs con el mismo formato que
// usan los tours de unidad (`?fs=1&vr=1&thumbs=0&info=0&logo=-1`) y vuelve todo
// solo. NO reusar las de otro proyecto: son otro edificio.
export const ENTRANCE_HALL_360: string | null = null;
export const AMENITIES_360: string | null = null;

/**
 * Hotspots por id de stop.
 *
 * El cliente marcó UN solo punto 360° (Miro "Division showroom", 25-08): la puerta
 * de entrada del edificio, entre el café y el local de indumentaria. Se ve desde
 * las dos vistas a nivel de calle, así que va en las dos —es el mismo punto, mirado
 * desde distinto ángulo—. Las otras tres no la ven y no llevan bolita: la 2 (View 02b)
 * es un primer plano de los balcones que deja la planta baja fuera de cuadro, y la 3
 * y la 4 son contrafrente.
 */
export const VR_HOTSPOTS: Record<number, VrHotspotConfig> = {
  // Stop 0 (landing, fachada de frente). ⚠ Espacio 4999×2812 — el render de 5k que
  // reemplazó al recorte extendido de 5000×2250 el 25-08. NO es el mismo encuadre: la
  // cámara quedó más lejos, así que las coordenadas viejas NO se convierten con una
  // regla de tres. Medido sobre `public/stops/stop-0.jpg` con grilla:
  //   café          x≈1450-1780
  //   VANO DEL HALL x≈1990-2260 · y≈2220 (dintel) → 2480 (piso), hoja en x≈2020-2140
  //   local         x≈2250-2900
  // 2040 la deja apenas a la izquierda de la hoja y 2400 abajo, a la altura del
  // picaporte. Más abajo se la come el recorte de una ventana maximizada, que en esta
  // vista se lleva los últimos ~220px nativos (ver README § El encuadre del render).
  0: {
    x: 2040,
    y: 2400,
    scale: 0.85,
    kuulaUrl: ENTRANCE_HALL_360 ?? undefined,
    previewImage: "/gallery/optimized/09-lobby.webp",
    previewKind: "hall",
  },
  // Stop 1 (esquina) — la MISMA puerta, vista de costado: el paño oscuro sobre el
  // muro de listones de madera. Acá queda a media altura del render, así que no la
  // toca ningún recorte.
  // Con el re-render del 27-08 esta vista pasó de 4000×2250 a 4999×2812 SIN cambiar
  // el encuadre (39,6 dB de PSNR entre los dos masters remuestreados), así que el
  // punto se convirtió por escala pura —1390×4999/4000, 1520×2812/2250— y se verificó
  // sobre el JPG nuevo: cae sobre el paño de madera, entre el café y el local.
  1: {
    x: 1737,
    y: 1900,
    scale: 0.8,
    kuulaUrl: ENTRANCE_HALL_360 ?? undefined,
    previewImage: "/gallery/optimized/09-lobby.webp",
    previewKind: "hall",
  },
};
