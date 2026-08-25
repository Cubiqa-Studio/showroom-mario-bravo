import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  floorUnitsFrom,
  getLiveUnit,
  getLiveUnits,
  getSite,
  getUnitIds,
  otherAvailableUnitsFrom,
} from "@/lib/data";
import { ResidenciaLanding } from "@/components/residencia/ResidenciaLanding";
import { pageMetadata, residenceGraphLd, jsonLdScriptProps } from "@/lib/seo";

// Landing STANDALONE de una unidad (acceso directo, refresh, SEO). Cuando se
// llega navegando desde el home, la ruta interceptada (@modal) la muestra como
// overlay con la transición; acá no hay home detrás ni zoom.
//
// ISR: se pre-genera en build (generateStaticParams) y se revalida cada 60 s para
// reflejar el estado/precio en vivo de Airtable sin perder el beneficio estático.
export const revalidate = 60;
// Un id fuera de los pre-generados se renderiza on-demand (y cae al redirect si no
// existe), en vez de 404. Explícito para no depender del default.
export const dynamicParams = true;

export function generateStaticParams() {
  return getUnitIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const unit = await getLiveUnit(id);
  if (!unit) return { title: "Departamento", robots: { index: false } };
  const m2 = unit.areas?.total ? `, ${unit.areas.total} m²` : "";
  const dorm = unit.beds >= 1 ? `${unit.beds} dorm.` : "monoambiente";
  const baths = `${unit.baths} ${unit.baths === 1 ? "baño" : "baños"}`;
  const estado = unit.status === "available" ? "Disponible" : "Reservada";
  // Miro 2026-07-15: sin precio en la description (los precios se sacaron del sitio).
  return pageMetadata({
    title: `Departamento ${unit.residence} en Mario Bravo 955`,
    description: `Departamento ${unit.residence} en TIER Bravo, Mario Bravo 955 (Buenos Aires): ${dorm}, ${baths}${m2}. ${estado}. Consultá plano, superficies y vistas.`,
    path: `/residencia/${id}`,
  });
}

export default async function ResidenciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const units = await getLiveUnits();
  const unit = units[id];
  if (!unit) notFound(); // id inexistente → 404 real (señal correcta para crawlers)

  return (
    <main className="min-h-[100dvh] bg-white">
      {/* JSON-LD por unidad: Apartment (Offer sólo con disponibilidad, sin precio) y
          BreadcrumbList (Inicio › Showroom › Departamento). */}
      <script {...jsonLdScriptProps(residenceGraphLd(id, unit))} />
      <ResidenciaLanding
        unit={unit}
        unitId={id}
        others={otherAvailableUnitsFrom(units, id)}
        site={getSite()}
        floorUnits={floorUnitsFrom(units, id)}
      />
    </main>
  );
}
