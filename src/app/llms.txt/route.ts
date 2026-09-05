import { getUnits } from "@/lib/data";
import { SITE, CUBIQA_URL } from "@/data/site";
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/seo";

// llms.txt (convención de llmstxt.org): índice del sitio en texto plano, para que un
// motor de respuesta con IA entienda de qué va esto sin ejecutar JS.
//
// Es un Route Handler y no un archivo en public/ para que el dominio y el inventario
// salgan de la misma fuente que el sitemap y el canonical. `force-static` lo hornea
// como out/llms.txt.
//
// Expectativa realista: los crawlers de IA casi no lo piden y Google dijo que no lo
// soporta. Es barato; no es una mejora medible.
export const dynamic = "force-static";

function lineaUnidad(id: string, u: ReturnType<typeof getUnits>[string]): string {
  const monoambiente = u.ambientes === 1 || u.beds === 0;
  const partes = [
    monoambiente
      ? "monoambiente"
      : `${u.ambientes} ambientes, ${u.beds} ${u.beds === 1 ? "dormitorio" : "dormitorios"}`,
    `${u.baths} ${u.baths === 1 ? "baño" : "baños"}`,
    u.areas?.total ? `${u.areas.total} m² totales` : null,
    u.tipologia ? `tipología ${u.tipologia}` : null,
    u.exposure === "frente" ? "al frente" : u.exposure === "contrafrente" ? "al contrafrente" : null,
    u.status === "available" ? "disponible" : "reservada",
  ].filter(Boolean);
  return `- [Departamento ${u.residence}](${SITE_URL}/residencia/${id}): ${partes.join(", ")}.`;
}

export function GET() {
  const units = getUnits();
  const ids = Object.keys(units).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const cuerpo = [
    `# ${SITE_NAME}`,
    "",
    `> ${DEFAULT_DESCRIPTION}`,
    "",
    `${SITE_NAME} es un edificio de departamentos en ${SITE.addressBase}, Argentina.`,
    `El sitio es un showroom digital: se recorre la fachada en 360°, se elige una unidad`,
    `sobre el render y se abre su ficha con plano, superficies, orientación y disponibilidad.`,
    `Son ${ids.length} unidades. La disponibilidad se actualiza en vivo; los precios no se`,
    `publican en el sitio (se consultan al equipo de ventas).`,
    "",
    "## Páginas principales",
    "",
    `- [Portada](${SITE_URL}/): los desarrollos de TIER; desde acá se entra al showroom de ${SITE_NAME}.`,
    `- [Showroom 360°](${SITE_URL}/showroom): recorrido exterior del edificio con las unidades marcadas sobre el render, y el listado completo de departamentos.`,
    "",
    "## Unidades",
    "",
    ...ids.map((id) => lineaUnidad(id, units[id])),
    "",
    "## Quién lo hace",
    "",
    `- [${SITE.developer}](${CUBIQA_URL}): estudio que produce el showroom digital.`,
    "",
  ].join("\n");

  return new Response(cuerpo, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
