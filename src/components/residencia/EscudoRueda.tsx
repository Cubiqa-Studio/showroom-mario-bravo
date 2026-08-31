"use client";

// Comparte el CSS de la barrita (`.kz*`) en residencia.css.
import "./residencia.css";
import { useEffect, useRef, useState } from "react";

/**
 * Escudo transparente sobre un 360° de Kuula, **sólo para escritorio**.
 *
 * ## El problema
 *
 * El zoom del player es todo o nada: con `zoom=1` anda la barrita (`ZoomKuula`) pero
 * el tour se queda con la RUEDA del mouse, y con el cursor sobre un hero de 100vh la
 * ficha deja de scrollear. Medido contra el Kuula real (31-08): la rueda se la lleva
 * desde el primer giro, sin click previo (el `focus` que reporta el player no cambia
 * nada), y no hay parámetro que separe una cosa de la otra — `zoom=2`, `zoom=-1`,
 * `wheel=0`, `scroll=0` y `zoomui=0` se portan todos igual que `zoom=1`.
 *
 * | `zoom=1`, rueda sobre el 360 | scroll de la página | zoom del tour |
 * |---|---|---|
 * | sin escudo | 0 px | 0 → 0,997 |
 * | con escudo | **600 px** | **0** |
 *
 * ## La solución, sin cobrarle un click a nadie
 *
 * El escudo **no es un candado que haya que abrir**: se corre solo apenas el mouse se
 * mueve sobre el 360°, así que arrastrar para mirar y tocar los hotspots de Kuula sigue
 * siendo directo, como siempre. Y se vuelve a poner cuando:
 *
 *  · el puntero se va del 360° (`mouseleave`), o
 *  · el zoom se movió sin que lo pidiera la barra — o sea, alguien usó la rueda. Eso lo
 *    ataja `useKuulaZoom` (candado), que devuelve el zoom a donde estaba y avisa por
 *    `intrusos`. Medido: la rueda alcanza a mover 0,054 y vuelve en ~150 ms.
 *
 * O sea: quieto, la rueda es de la página; con el mouse moviéndose, el tour es tuyo; y
 * si intentás zoomear con la rueda, el zoom no se mueve y el escudo vuelve — la próxima
 * vuelta de rueda ya scrollea. El zoom se hace SÓLO con la barrita (pedido del cliente,
 * 31-08: "que solo se pueda hacer zoomIn / zoomOut con la barra, NO CON EL SCROLL").
 *
 * En táctil no se monta: ahí no hay rueda que robar (el scroll se hace arrastrando el
 * bottom sheet) y el 360° tiene que seguir siendo directo.
 */

/** Después de atajar la rueda, ignorar el movimiento del mouse un rato: al scrollear,
 *  el navegador dispara `mousemove` porque cambia lo que hay debajo del cursor, y sin
 *  esto el escudo se correría de nuevo en mitad del scroll. */
const ENFRIADO_MS = 600;

export function EscudoRueda({
  activo,
  intrusos,
}: {
  /** Escritorio + embed con `zoom=1`. En táctil siempre `false`. */
  activo: boolean;
  /** Contador de `useKuulaZoom`: sube cada vez que se atajó un zoom de la rueda. */
  intrusos: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [armado, setArmado] = useState(true);
  const enfriadoHasta = useRef(0);
  // Última posición REAL del mouse: los `mousemove` que dispara el scroll llegan con
  // las mismas coordenadas y no tienen que contar como "el usuario movió el mouse".
  const donde = useRef<{ x: number; y: number } | null>(null);

  // Se atajó la rueda → volver a tapar, para que la próxima vuelta scrollee la página.
  useEffect(() => {
    if (!activo || intrusos === 0) return;
    enfriadoHasta.current = performance.now() + ENFRIADO_MS;
    donde.current = null;
    setArmado(true);
  }, [activo, intrusos]);

  // Al salir del 360° se re-arma en el acto. Va sobre el CONTENEDOR (no sobre el
  // escudo) porque corrido tiene `pointer-events: none` y no recibiría nada.
  useEffect(() => {
    const cont = ref.current?.parentElement;
    if (!activo || !cont) return;
    const onSalir = () => {
      donde.current = null;
      setArmado(true);
    };
    cont.addEventListener("mouseleave", onSalir);
    return () => cont.removeEventListener("mouseleave", onSalir);
  }, [activo]);

  if (!activo) return null;

  return (
    <div
      ref={ref}
      className={`kz-escudo${armado ? " armado" : ""}`}
      onMouseMove={(e) => {
        if (performance.now() < enfriadoHasta.current) return;
        const previo = donde.current;
        donde.current = { x: e.clientX, y: e.clientY };
        // El primer mousemove sólo toma referencia; recién el segundo (movimiento de
        // verdad) corre el escudo. Así un scroll no lo destapa.
        if (!previo || (previo.x === e.clientX && previo.y === e.clientY)) return;
        setArmado(false);
      }}
      // Red de seguridad: un puntero que aparece apretando (lápiz, click sin mover).
      onPointerDown={() => setArmado(false)}
      aria-hidden
    />
  );
}
