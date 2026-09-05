import { getUnits } from "@/lib/data";
import { ShowroomSeo } from "@/components/seo/ShowroomSeo";
import { showroomGraphLd, jsonLdScriptProps } from "@/lib/seo";

// El contenido indexable del showroom vive ACÁ y no en page.tsx porque `loading.tsx`
// envuelve a la página en un <Suspense> y el layout queda por fuera. Mientras el <main>
// estuvo en la página, el HTML horneado salía con el spinner en el cuerpo y el <h1>, el
// párrafo "El proyecto" y los 63 <a href="/residencia/…"> metidos en un `<div hidden>`
// que sólo mueve a su lugar un script de React: un crawler sin JS no veía nada de eso.
export default function ShowroomLayout({ children }: { children: React.ReactNode }) {
  // Sale de units.json (sincrónico) y no de Airtable: número, residencia y dormitorios
  // no cambian en vivo, así que el bloque crawleable no depende de la red en el build.
  const unitList = Object.entries(getUnits())
    .map(([id, u]) => ({ id, residence: u.residence, beds: u.beds }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return (
    <main className="relative">
      {/* Migas Inicio › Showroom: el único tipo de datos estructurados de este sitio
          que Google sigue mostrando como rich result. */}
      <script {...jsonLdScriptProps(showroomGraphLd())} />
      {/* H1 + descripción + links a cada unidad (sr-only, sin impacto visual). */}
      <ShowroomSeo units={unitList} />
      {children}
    </main>
  );
}
