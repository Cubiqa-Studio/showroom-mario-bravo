/**
 * Bloqueo del scroll del <body> con CONTADOR compartido.
 *
 * Antes cada modal hacía el mismo baile a mano: guardaba `document.body.style.overflow`
 * al abrir y lo restauraba al cerrar. Con UNO solo funciona; anidados, no. En la
 * landing pasa siempre: el DetailOverlay ya dejó el body en "hidden" cuando encima se
 * abre la galería, así que la galería guarda "hidden" como valor previo. Al salir al
 * exterior React limpia los efectos de arriba hacia abajo → el overlay restaura ""
 * (bien) y DESPUÉS la galería restaura su "hidden" (mal): el showroom quedaba sin
 * scroll hasta refrescar.
 *
 * Con un contador el valor original se guarda UNA vez (el primer lock) y se restaura
 * UNA vez (el último unlock), sin importar el orden en que se suelten. Cada `lock()`
 * devuelve su propio `unlock`, idempotente: llamarlo dos veces no descuenta de más.
 */
let locks = 0;
let previousOverflow = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = previousOverflow;
  };
}
