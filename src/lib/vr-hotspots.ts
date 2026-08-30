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

// Recorridos 360° de espacios COMUNES.
//
// Los de DEPARTAMENTO (A–E) viven en el `tour360` de cada unidad en `units.json`.
// Acá van los dos del edificio, y cada uno se consume solo donde corresponde: si
// alguno queda en `null`, todo lo que lo usa se esconde (los items del submenú
// Tours, el embed del modal de Amenities y el click de la bolita del exterior).
//
// AMENITIES — entregado por el cliente el 30-08 (verificado: el título de la
// colección es "MARIO BRAVO - AMENITIES"). El link que pasaron apunta a un post
// dentro de la colección (`/post/LM3wD/collection/7TyxW`); acá va la URL de
// COLECCIÓN con los mismos parámetros que los tours de unidad, para que el visor
// arranque en el primer panorama y con el chrome de Kuula ya resuelto.
//
// HALL — todavía no llegó. Queda en `null` a propósito: NO reusar el de otro
// proyecto ni apuntarlo al de amenities.
export const ENTRANCE_HALL_360: string | null = null;
export const AMENITIES_360: string | null =
  "https://kuula.co/share/collection/7TyxW?fs=1&vr=1&zoom=0&thumbs=0&info=0&logo=-1";

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
  // 27-08: estaba en x=2040, que cae sobre la MACETA y el paño de listones a la
  // izquierda del vano, no sobre la puerta. La puerta de verdad son las dos hojas de
  // vidrio con los tiradores verticales: medido sobre `public/stops/stop-0.jpg` con
  // grilla, van de x≈2200 a x≈2260, así que el centro es 2230.
  // La `y` no se movió: 2400 es la altura de los tiradores. Más abajo se la come el
  // recorte de una ventana maximizada, que en esta vista se lleva los últimos ~220px
  // nativos (ver README § El encuadre del render).
  0: {
    x: 2230,
    y: 2400,
    scale: 0.85,
    // Abre el recorrido de AMENITIES (pedido de Joaquim, 30-08: el link que mandó
    // el cliente va en la bolita de las vistas 01 y 02). El preview sigue siendo el
    // lobby —es la puerta que marca la bolita— con la etiqueta "Amenities", que es
    // lo que efectivamente se abre al tocarla.
    kuulaUrl: AMENITIES_360 ?? undefined,
    previewImage: "/gallery/optimized/09-lobby.webp",
    previewKind: "amenities",
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
    kuulaUrl: AMENITIES_360 ?? undefined,
    previewImage: "/gallery/optimized/09-lobby.webp",
    previewKind: "amenities",
  },
};
