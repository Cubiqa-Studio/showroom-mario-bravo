import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  floorUnitsFrom,
  getLiveUnit,
  getLiveUnits,
  getSite,
  getUnitIds,
  otherAvailableUnitsFrom,
  vistasDeUnidad,
} from "@/lib/data";
import { ResidenciaLandingLive } from "@/components/residencia/ResidenciaLandingLive";
import { pageMetadata, residenceGraphLd, jsonLdScriptProps } from "@/lib/seo";

// Landing STANDALONE de una unidad (acceso directo por link, Google, refresh, SEO).
// Cuando se llega navegando desde el showroom, la ficha se muestra como OVERLAY
// encima y esta página no se renderiza (ver UnitDetailHost); acá no hay showroom
// detrás ni zoom.
//
// EXPORT ESTÁTICO: las 61 fichas se pre-generan en build (generateStaticParams) y
// se suben como HTML. No hay ISR — `revalidate` y `dynamicParams: true` son errores
// de build con `output: "export"` (no hay servidor que regenere ni que resuelva un
// id nuevo on-demand).
//
// Consecuencia: el HTML lleva el estado/precio congelados al MOMENTO DEL BUILD.
// La data en vivo la refresca el CLIENTE (ver `useLiveUnits` en ResidenciaLanding),
// así el visitante ve el dato real de Airtable sin rebuild. El HTML horneado es el
// fallback y lo que leen los crawlers.
//
// Un id que no exista no tiene HTML → Apache sirve el 404.html (ver .htaccess),
// que es la señal correcta para crawlers. Antes eso lo resolvía `dynamicParams`.
export const dynamicParams = false;

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
  const monoambiente = unit.ambientes === 1 || unit.beds === 0;
  const cuerpo = monoambiente
    ? "monoambiente"
    : `${unit.ambientes} ambientes, ${unit.beds} dorm.`;
  const baths = `${unit.baths} ${unit.baths === 1 ? "baño" : "baños"}`;
  const m2 = unit.areas?.total ? `${unit.areas.total} m²` : null;
  // La 706 (pasante) no tiene exposición definida: sin dato, se omite.
  const orientacion =
    unit.exposure === "frente"
      ? " al frente"
      : unit.exposure === "contrafrente"
        ? " al contrafrente"
        : "";
  // El PISO y no el estado: la description se hornea en el build, así que "Disponible"
  // podía quedar meses en el snippet con la unidad ya reservada. El piso no se vence.
  const floor = id.length > 2 ? id.slice(0, -2) : id;
  const piso = floor === "0" ? "Planta baja" : `Piso ${floor}`;
  // Sólo promete el 360° en las unidades que lo tienen (50 de 63).
  const cierre = unit.tour360
    ? "Mirá el plano y el recorrido 360°."
    : "Mirá el plano y consultá con un asesor.";
  const ficha = [cuerpo, baths, m2].filter(Boolean).join(", ");
  // Miro 2026-07-15: sin precio en la description (los precios se sacaron del sitio).
  return pageMetadata({
    title: `Departamento ${unit.residence} · ${unit.ambientes} amb. en Mario Bravo 955`,
    description: `Departamento ${unit.residence} en Mario Bravo 955, Buenos Aires: ${ficha}${orientacion}. ${piso}. ${cierre}`,
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
    <main className="min-h-[100dvh] bg-tier-dark">
      {/* JSON-LD por unidad: Apartment (Offer sólo con disponibilidad, sin precio) y
          BreadcrumbList (Inicio › Showroom › Departamento). */}
      <script {...jsonLdScriptProps(residenceGraphLd(id, unit))} />
      {/* Lo de acá abajo es lo HORNEADO en el build (y lo que leen los crawlers);
          ResidenciaLandingLive lo re-deriva del dato en vivo cuando llega. */}
      <ResidenciaLandingLive
        unit={unit}
        unitId={id}
        others={otherAvailableUnitsFrom(units, id)}
        site={getSite()}
        floorUnits={floorUnitsFrom(units, id)}
        vistas={await vistasDeUnidad(id)}
      />
    </main>
  );
}
