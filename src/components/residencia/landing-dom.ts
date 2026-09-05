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

// El fullscreen se mudó a `@/lib/fullscreen`, que además sabe si el navegador PUEDE
// (en iOS no puede) y cubre el prefijo `webkit` de iPadOS/Safari viejo. Acá había una
// segunda copia que sólo probaba la API sin prefijo y no avisaba cuando no existía.
