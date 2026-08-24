// Helpers de interacción de la landing. Funciones puras que tocan el DOM sólo
// dentro de handlers de eventos (se importan en componentes client).

/** Scrollea a la sección de contacto (funciona en overlay y standalone). */
export function scrollToContact() {
  document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Vuelve arriba. Scrollea el contenedor (overlay o ventana) al tope. */
export function scrollToTop() {
  document.querySelector(".res-landing")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Alterna pantalla completa del documento. No-op si el browser no lo soporta. */
export function toggleFullscreen() {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.();
  }
}
