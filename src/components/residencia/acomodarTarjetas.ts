/**
 * Dónde poner las tarjetas de los desarrollos para que NO se pisen.
 *
 * El mapa de Ubicación deja las tres tarjetas (fachada + nombre + dirección) abiertas
 * todo el tiempo — es pedido del cliente, no un hover. El problema es que los tres
 * desarrollos están cerca en el mundo real y la cámara arranca inclinada: a `pitch`
 * alto la perspectiva COMPRIME el eje norte-sur, así que los tres pines caían en un
 * cuadradito de ~110×130px y tres tarjetas de 168×161 no entran ahí de ninguna manera.
 *
 * Se probó antes resolverlo con anclas fijas ("ésta cuelga, aquélla crece hacia
 * arriba") y encuadres a medida. No alcanza, y no por falta de tino: el ancla se
 * elige UNA vez y la cámara cambia todo el tiempo — la animación de entrada, las
 * tres pills (Explorar / Zoom / Centrar), el zoom con la rueda, el paneo con el dedo.
 * Cualquier ancla fija es correcta para UNA cámara y está mal para las demás; de
 * hecho "Centrar" volvía a apilarlas prolijamente una arriba de la otra.
 *
 * Así que la posición se DECIDE en cada cuadro, mirando dónde cayeron los pines:
 * cada tarjeta puede ir en ocho lugares alrededor de su pin y se elige la
 * combinación que menos se pisa. Es un problema de ubicación de etiquetas de toda la
 * vida, y con dos o tres tarjetas se puede resolver a lo bruto (probar TODAS las
 * combinaciones) sin que se note: son 512 evaluaciones de aritmética de rectángulos.
 *
 * El módulo es a propósito PURO —entran números, salen números— así que se puede
 * razonar y probar sin mapa, sin DOM y sin navegador.
 */

/** Un rectángulo en píxeles del contenedor del mapa (origen arriba-izquierda). */
export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Una tarjeta a ubicar: dónde cayó su pin en pantalla y cuánto mide la tarjeta. */
export interface TarjetaAUbicar {
  /** Posición del pin en píxeles del contenedor (lo que devuelve `map.project`). */
  pin: { x: number; y: number };
  /** Medidas de la tarjeta ya renderizada. Cambian por breakpoint y por idioma. */
  w: number;
  h: number;
  /**
   * Hacia dónde conviene que se recueste esta tarjeta (vector unitario en pantalla).
   * Quien llama pasa la dirección que va del CENTRO DEL GRUPO de puntos hacia este
   * punto: o sea, "hacia afuera".
   *
   * Es lo que hace que el reparto se lea solo. Los tres desarrollos forman un grupito;
   * si cada tarjeta se recuesta hacia afuera, la del oeste queda a la izquierda de su
   * punto, la del este a la derecha y la del norte para arriba — que es exactamente lo
   * que pidió Joaquim (03-09: "tier avenue lo podés poner a la izquierda del dot para
   * que no se pisen"), pero sin atar la regla a un proyecto en particular: sale de
   * dónde caen los puntos, así que sigue valiendo si mañana se suma un cuarto o si el
   * visitante rota el mapa.
   *
   * Es una PREFERENCIA, no una orden: pesa mucho menos que un solapamiento, así que
   * una tarjeta se va para el otro lado si es la única manera de no pisar a otra.
   */
  hacia?: { x: number; y: number };
}

/**
 * Aire entre el CENTRO del pin y el borde de la tarjeta.
 *
 * Se mide desde el centro porque es ahí donde maplibre clava el offset, así que el
 * número tiene que pagar primero el radio del propio punto y recién después el aire
 * que se ve. El punto de este edificio es el más grande —18px de diámetro, o sea 9 de
 * radio— y el de los hermanos mide 11. Con 22 quedan ~13px de aire libre bajo el
 * grande y ~16 bajo los chicos: alcanza para que el punto se lea COMPLETO y separado,
 * que era el reclamo (Joaquim, 03-09: "las 3 imágenes tapan su dot").
 *
 * No se le da más: la tarjeta tiene que seguir leyéndose como la etiqueta DE ese
 * punto. Cuanto más lejos, más se parece a una tarjeta suelta flotando en el mapa.
 */
const AIRE = 22;

/**
 * Los ocho lugares donde puede ir una tarjeta respecto de su pin, EN ORDEN DE
 * PREFERENCIA: primero abajo (que es donde el ojo la busca y donde el mapa suele
 * tener lugar), después las diagonales de abajo, después los costados, y arriba al
 * final — arriba es el lado caro, porque es donde vive la tarjeta de la dirección y
 * donde el pin más al norte queda pegado al borde.
 *
 * Cada entrada devuelve el desplazamiento respecto del pin hasta el borde
 * SUPERIOR-CENTRO de la tarjeta. Ese punto y no otro porque los popups quedan todos
 * anclados en `"top"` y maplibre los dibuja con `translate(-50%, 0)`: la posición
 * final es exactamente `pin + desplazamiento`, con la tarjeta colgando desde ahí. El
 * ancla de maplibre se fija al construir el popup y no se puede cambiar después; el
 * desplazamiento sí, y por eso toda la decisión vive acá. Quien lo aplica lo escribe
 * como `transform` en la tarjeta de adentro, así el cambio de lado se puede animar
 * sin que la tarjeta se despegue de su punto al mover el mapa (ver LocationMap).
 */
const LUGARES: ((w: number, h: number) => { dx: number; dy: number })[] = [
  /* abajo            */ () => ({ dx: 0, dy: AIRE }),
  /* abajo-derecha    */ (w) => ({ dx: w / 2 + AIRE, dy: AIRE }),
  /* abajo-izquierda  */ (w) => ({ dx: -(w / 2 + AIRE), dy: AIRE }),
  /* derecha          */ (w, h) => ({ dx: w / 2 + AIRE, dy: -h / 2 }),
  /* izquierda        */ (w, h) => ({ dx: -(w / 2 + AIRE), dy: -h / 2 }),
  /* arriba-derecha   */ (w, h) => ({ dx: w / 2 + AIRE, dy: -(h + AIRE) }),
  /* arriba-izquierda */ (w, h) => ({ dx: -(w / 2 + AIRE), dy: -(h + AIRE) }),
  /* arriba           */ (_w, h) => ({ dx: 0, dy: -(h + AIRE) }),
];

export const CANTIDAD_DE_LUGARES = LUGARES.length;

/** El offset (respecto del pin) del lugar `i` para una tarjeta de `w`×`h`. */
export function offsetDelLugar(i: number, w: number, h: number): { dx: number; dy: number } {
  return LUGARES[i](w, h);
}

/** La caja que ocuparía la tarjeta `t` puesta en el lugar `i`. */
function cajaEnLugar(t: TarjetaAUbicar, i: number): Caja {
  const { dx, dy } = LUGARES[i](t.w, t.h);
  return { x: t.pin.x + dx - t.w / 2, y: t.pin.y + dy, w: t.w, h: t.h };
}

/** Área en la que se superponen dos cajas (0 si no se tocan). */
function solape(a: Caja, b: Caja): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Área de la tarjeta que se sale del cuadro del mapa (o sea: que queda cortada). */
function areaFuera(c: Caja, mapa: Caja): number {
  return c.w * c.h - solape(c, mapa);
}

// Cuánto pesa cada pecado. Las áreas se miden en px², así que cualquier
// superposición real vale miles: las constantes chicas de abajo (preferencia,
// histéresis) sólo desempatan entre opciones que YA no se pisan, nunca compran un
// solapamiento.
const PESO_ENTRE_TARJETAS = 4;
const PESO_CONTRA_OBSTACULO = 3;
const PESO_FUERA_DEL_MAPA = 5;
const PESO_PREFERENCIA = 40;
/**
 * Cuánto pesa recostarse hacia afuera del grupo (ver `hacia`). 130 ≈ tres escalones
 * de `PESO_PREFERENCIA`: alcanza para que una tarjeta prefiera el costado de afuera
 * antes que colgar hacia abajo, y sigue siendo calderilla al lado de cualquier
 * solapamiento real, que se mide en miles de px².
 */
const PESO_HACIA_AFUERA = 130;
/**
 * Premio por QUEDARSE donde ya estaba. Sin esto, durante la animación de entrada
 * (tres segundos en los que los pines se mueven) las tarjetas saltan de un lado al
 * otro del pin en cuanto dos opciones empatan, y el mapa parpadea.
 *
 * Se aplica SÓLO a una posición que además no se pisa con nada: la estabilidad no
 * puede ser motivo para dejar dos tarjetas encimadas, que es justo el bug que este
 * módulo viene a arreglar.
 */
const PREMIO_POR_QUEDARSE = 900;

/**
 * Elige en qué lugar va cada tarjeta. Devuelve un índice de `LUGARES` por tarjeta,
 * en el mismo orden en que entraron.
 *
 * @param tarjetas    Pin y medidas de cada una.
 * @param obstaculos  Cajas fijas del mapa que tampoco hay que tapar (la tarjeta de
 *                    la dirección, las pills, el control de zoom).
 * @param mapa        El cuadro del mapa; lo que se sale de acá queda cortado.
 * @param actuales    Dónde está cada tarjeta ahora, para preferir no moverla.
 */
export function acomodarTarjetas(
  tarjetas: TarjetaAUbicar[],
  obstaculos: Caja[],
  mapa: Caja,
  actuales: number[] = [],
): number[] {
  if (tarjetas.length === 0) return [];

  // Las cajas de los 8 lugares de cada tarjeta, calculadas una sola vez: la búsqueda
  // las mira muchas veces (512 combinaciones para tres tarjetas) y son fijas.
  const cajas = tarjetas.map((t) => LUGARES.map((_, i) => cajaEnLugar(t, i)));

  // Lo que le cuesta a UNA tarjeta estar en un lugar, sin mirar a las otras.
  const costoPropio = tarjetas.map((t, ti) =>
    LUGARES.map((_, li) => {
      const c = cajas[ti][li];
      // Los PECADOS (pisar algo, salirse del mapa) se suman aparte de los GUSTOS
      // (colgar hacia abajo, recostarse hacia afuera): el premio por quedarse quieta
      // se cobra sólo cuando no hay ningún pecado, y con todo mezclado en un número
      // no se puede distinguir un lugar limpio de uno que sólo tiene mal gusto.
      let pecados = areaFuera(c, mapa) * PESO_FUERA_DEL_MAPA;
      for (const o of obstaculos) pecados += solape(c, o) * PESO_CONTRA_OBSTACULO;
      let costo = pecados + li * PESO_PREFERENCIA;
      if (t.hacia) {
        // Cuánto apunta este lugar hacia AFUERA del grupo. Se compara contra el centro
        // de la tarjeta (no contra su borde de arriba, que es donde cae el offset):
        // el borde superior de "izquierda" y el de "derecha" están a la misma altura,
        // así que mirando ahí los dos costados empatarían.
        const cx = c.x + c.w / 2 - t.pin.x;
        const cy = c.y + c.h / 2 - t.pin.y;
        const largo = Math.hypot(cx, cy) || 1;
        const alineacion = (cx / largo) * t.hacia.x + (cy / largo) * t.hacia.y; // −1…1
        // 0 si el lugar apunta justo hacia afuera, el peso entero si apunta al grupo.
        costo += ((1 - alineacion) / 2) * PESO_HACIA_AFUERA;
      }
      // El premio por quedarse se cobra sólo si el lugar está limpio (ver arriba).
      if (actuales[ti] === li && pecados === 0) costo -= PREMIO_POR_QUEDARSE;
      return costo;
    }),
  );

  const entreTarjetas = (elegidos: number[]) => {
    let costo = 0;
    for (let a = 0; a < elegidos.length; a++)
      for (let b = a + 1; b < elegidos.length; b++)
        costo += solape(cajas[a][elegidos[a]], cajas[b][elegidos[b]]) * PESO_ENTRE_TARJETAS;
    return costo;
  };

  // Con pocas tarjetas se prueban TODAS las combinaciones, que es lo único que
  // garantiza el óptimo: acomodar de a una y quedarse con lo primero que no choca
  // puede dejar a la última sin lugar habiendo una salida para todas. El corte está
  // en 5000 evaluaciones (tres tarjetas = 512, cuatro = 4096) — arriba de eso se
  // acomoda de a una, en orden, mirando lo ya colocado. Hoy son tres; el corte está
  // para que sumar un cuarto desarrollo no meta un freeze en el scroll.
  const total = CANTIDAD_DE_LUGARES ** tarjetas.length;
  if (total > 5000) {
    const elegidos: number[] = [];
    for (let ti = 0; ti < tarjetas.length; ti++) {
      let mejor = 0;
      let mejorCosto = Infinity;
      for (let li = 0; li < CANTIDAD_DE_LUGARES; li++) {
        let costo = costoPropio[ti][li];
        for (let prev = 0; prev < ti; prev++)
          costo += solape(cajas[ti][li], cajas[prev][elegidos[prev]]) * PESO_ENTRE_TARJETAS;
        if (costo < mejorCosto) {
          mejorCosto = costo;
          mejor = li;
        }
      }
      elegidos.push(mejor);
    }
    return elegidos;
  }

  let mejorCombo: number[] = tarjetas.map((_, i) => actuales[i] ?? 0);
  let mejorCosto = Infinity;
  const combo = new Array<number>(tarjetas.length).fill(0);
  for (let n = 0; n < total; n++) {
    // `n` en base 8: cada dígito es el lugar de una tarjeta.
    let resto = n;
    let costo = 0;
    for (let ti = 0; ti < tarjetas.length; ti++) {
      const li = resto % CANTIDAD_DE_LUGARES;
      resto = (resto - li) / CANTIDAD_DE_LUGARES;
      combo[ti] = li;
      costo += costoPropio[ti][li];
    }
    if (costo >= mejorCosto) continue; // ya perdió sin contar los choques entre sí
    costo += entreTarjetas(combo);
    if (costo < mejorCosto) {
      mejorCosto = costo;
      mejorCombo = combo.slice();
    }
  }
  return mejorCombo;
}
