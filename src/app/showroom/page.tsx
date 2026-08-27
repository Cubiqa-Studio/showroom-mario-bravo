import type { Metadata } from "next";
import { getStops, getLiveUnits, getFlyby } from "@/lib/data";
import { FlybyViewer } from "@/components/gallery/FlybyViewer";
import { ZoomLayer } from "@/components/transition/ZoomLayer";
import { ShowroomSeo } from "@/components/seo/ShowroomSeo";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Showroom 360° en Mario Bravo 955",
  description:
    "Recorré TIER Bravo en 360°: explorá los 61 departamentos de 1 a 4 ambientes de Mario Bravo 955 y mirá planta, superficie, vistas y disponibilidad de cada unidad.",
  path: "/showroom",
});

// El showroom (recorrido exterior) vive en /showroom — la raíz "/" es la intro.
// Tener URL propia es lo que hace que un F5 acá NO repita el video, y que el back
// del navegador vuelva a la intro sin cookies de por medio.
//
// ISR en vez de force-dynamic: la página se sirve CACHEADA desde el CDN (navegar
// "Descubrir" → /showroom es ~instantáneo, sin el render por-request que dejaba el
// spinner 6-7s en mobile) y se revalida en segundo plano cada 60 s. La geometría
// del Blob y Airtable se leen en la regeneración → los cambios del editor aparecen
// dentro de ~60 s (antes: al recargar), sin rebuild; Airtable YA tenía su cache de
// 60 s, y el stops.json commiteado es el fallback (la geometría nunca queda rota).
export const revalidate = 60;

export default async function Showroom() {
  const stops = await getStops();
  // Unidades con el estado/precio/etc. EN VIVO desde Airtable (mergeado sobre
  // units.json). El contorno de cada unidad sale ya pintado por su estado real en
  // el primer render del servidor (sin parpadeo), porque la página es dynamic.
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

      {/* ZoomLayer hace el zoom-in/out cinematográfico del showroom cuando se abre
          un detalle (/residencia/*) interceptado encima. NO desmonta el visor, así
          al volver queda donde estaba (cámara/scroll preservados). */}
      <ZoomLayer>
        <FlybyViewer
          stops={stops}
          units={units}
          segments={segments}
          branding={
            // Lockup en DOS líneas (pedido del cliente, 26-08): el logotipo TIER y
            // debajo "BRAVO". El logotipo es un archivo (trazos vectorizados, sin
            // tipografía embebida) y "BRAVO" va tipografiado en Jost —la sans del
            // sitio, la que más se le parece— con tracking suficiente para que las
            // dos líneas midan casi lo mismo.
            <span className="flex flex-col items-stretch">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // Variante BLANCA: el wordmark va sobre el render del flyby (cielo,
                // árboles, fachada) y el oro de la paleta —calibrado contra blanco—
                // se pierde ahí. Ver scripts/make-brand-assets.mjs.
                src="/logo_blanco.png"
                alt="TIER"
                // El wordmark es una tira 5,2:1: 32px de alto ya son ~167px de ancho.
                // En mobile, h-7 para que entre prolijo (incluso a ~360px).
                className="h-7 w-auto drop-shadow-md sm:h-8"
              />
              {/* `marginRight` negativo = el tracking agrega un espacio DESPUÉS de la
                  última letra; sin compensarlo, el centrado queda corrido a la izquierda. */}
              <span
                className="mt-[3px] text-center font-sans text-[9px] font-light leading-none tracking-[0.44em] text-white drop-shadow-md sm:mt-1 sm:text-[11px]"
                style={{ marginRight: "-0.44em" }}
              >
                BRAVO
              </span>
            </span>
          }
        />
      </ZoomLayer>
    </main>
  );
}
