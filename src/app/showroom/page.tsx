import type { Metadata } from "next";
import { getStops, getLiveUnits, getFlyby, getSite } from "@/lib/data";
import { ShowroomClient } from "@/components/gallery/ShowroomClient";
import { ShowroomSeo } from "@/components/seo/ShowroomSeo";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Showroom 360° en Mario Bravo 955",
  description:
    "Recorré TIER Bravo en 360°: explorá los 63 departamentos de 1 a 4 ambientes de Mario Bravo 955 y mirá planta, superficie, vistas y disponibilidad de cada unidad.",
  path: "/showroom",
});

// El showroom (recorrido exterior) vive en /showroom — la raíz "/" es la intro.
// Tener URL propia es lo que hace que un F5 acá NO repita el video, y que el back
// del navegador vuelva a la intro sin cookies de por medio.
//
// EXPORT ESTÁTICO: la página se hornea en build y se sirve como HTML plano desde
// Apache — navegar "Descubrir" → /showroom es instantáneo, sin render por-request.
// No hay ISR (`revalidate` es un error de build con `output: "export"`): la
// geometría de los stops sale del stops.json commiteado, y el estado/precio de las
// unidades queda congelado al build y lo refresca el CLIENTE (ver `useLiveUnits`
// dentro de FlybyViewer) — el contorno se repinta con el dato real de Airtable sin
// rebuild, y el HTML horneado es el fallback si el proxy está caído.

export default async function Showroom() {
  const stops = await getStops();
  // Unidades con el estado/precio/etc. de Airtable mergeado sobre units.json, leído
  // EN EL BUILD. Sirve dos cosas: el contorno de cada unidad sale ya pintado con un
  // estado plausible en el primer frame (sin parpadeo) y el bloque SEO de abajo viaja
  // en el HTML. El dato EN VIVO lo refresca el cliente (ver ShowroomClient).
  const units = await getLiveUnits();
  const segments = getFlyby();

  // Lista para el bloque SEO (sr-only): un <a href> real a cada unidad, en el HTML
  // del servidor → descubrimiento crawleable de las 44 fichas desde el showroom.
  const unitList = Object.entries(units)
    .map(([id, u]) => ({ id, residence: u.residence, beds: u.beds }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  if (stops.length === 0) {
    return (
      <main className="grid min-h-[100dvh] place-items-center px-6">
        <p className="text-red-600">No se encontraron stops en stops.json.</p>
      </main>
    );
  }

  return (
    <main className="relative">
      {/* H1 + descripción + links a cada unidad (sr-only, sin impacto visual). */}
      <ShowroomSeo units={unitList} />

      {/* ShowroomClient refresca las unidades en vivo y monta el visor + la ficha
          como overlay (con el zoom-in/out cinematográfico). El visor NO se desmonta
          al abrir una ficha, así al volver queda donde estaba (cámara/scroll
          preservados) — antes eso lo daba la ruta interceptada @modal, que no existe
          con `output: "export"`. */}
      <ShowroomClient
        stops={stops}
        units={units}
        segments={segments}
        site={getSite()}
        branding={
            // Lockup en DOS líneas (pedido del cliente, 26-08): el logotipo TIER y
            // debajo "BRAVO". El logotipo es un archivo (trazos vectorizados, sin
            // tipografía embebida) y "BRAVO" va tipografiado en Jost —la sans del
            // sitio, la que más se le parece— con tracking suficiente para que las
            // dos líneas midan casi lo mismo.
            <span className="flex flex-col items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // Variante BLANCA: el wordmark va sobre el render del flyby (cielo,
                // árboles, fachada) y el oro de la paleta —calibrado contra blanco—
                // se pierde ahí. Ver scripts/make-brand-assets.mjs.
                src="/logo_blanco.png"
                alt="TIER"
                // El wordmark es una tira 5,2:1, así que el ALTO fija el ancho:
                // h-8 ≈ 167px · h-7 ≈ 147 · h-6 ≈ 126 · h-5 ≈ 105.
                // En teléfonos el lockup comparte renglón con la barra de acciones,
                // así que baja de escalón en 400 y en 560: a h-7 no entraban las dos
                // cosas en 412px y el logo terminaba en una banda propia sobre el render.
                className="h-5 w-auto drop-shadow-md min-[401px]:h-6 min-[560px]:h-7 sm:h-8"
              />
              {/* Alineado a la IZQUIERDA con el logotipo. El PNG está recortado exacto
                  (la tinta arranca en x=0), así que las cajas ya coinciden: el
                  `marginLeft` es una sangría ÓPTICA. La "T" apoya el ojo en su travesaño
                  y la "B" en un asta llena, así que sin ella BRAVO se lee corrido a la
                  izquierda. Va en `em` para que acompañe si cambia el tamaño; es el
                  único número a tocar si hay que ajustarlo. */}
              <span
                className="mt-[2px] font-sans text-[10px] font-light leading-none tracking-[0.28em] text-white drop-shadow-md min-[401px]:text-[11.5px] min-[560px]:mt-[3px] min-[560px]:text-[13px] sm:mt-[6px] sm:text-[17px]"
                style={{ marginLeft: "0.14em" }}
              >
                BRAVO
              </span>
            </span>
        }
      />
    </main>
  );
}
