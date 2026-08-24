"use client";

import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Bloque SEO/accesible (sr-only) del showroom. El /showroom es un canvas
 * interactivo (SVG/video) sin texto ni encabezados: esto le agrega, EN EL HTML
 * inicial (SSR) y sin tocar el diseño:
 *   · un único <h1> y un párrafo describiendo el desarrollo (contenido crawleable);
 *   · un <nav> con un <a href> real a CADA unidad → los crawlers descubren las 44
 *     fichas /residencia/:id desde el funnel público (los polígonos navegan por JS,
 *     que no es crawleable). Redundante con el sitemap, a propósito.
 * Es un client component para usar el i18n (ES/EN); igual se renderiza en el SSR.
 */
export function ShowroomSeo({
  units,
}: {
  units: { id: string; residence: string; beds: number }[];
}) {
  const { t } = useI18n();
  return (
    <section className="sr-only">
      <h1>{t.seo.showroomH1}</h1>
      <p>{t.seo.showroomBody}</p>
      {/* "El proyecto": párrafo auto-contenido (ubicación, tipologías, amenities,
          entrega) — el bloque citable del sitio para buscadores y AI search. */}
      <h2>{t.seo.projectTitle}</h2>
      <p>{t.seo.projectBody}</p>
      {/* Link real a la portada: sin él, "/" no recibe ningún link interno.
          <a> plano a propósito (como los de unidades): crawleable y sin prefetch. */}
      <p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">{t.seo.homeLink}</a>
      </p>
      {/* <a> planos (NO next/link): crawleables e igual de válidos para SR, sin el
          prefetch de 44 links que castigaría la performance del showroom en mobile.
          La navegación real del usuario va por los polígonos (con la transición). */}
      <nav aria-label={t.seo.unitsNavLabel}>
        <ul>
          {units.map((u) => (
            <li key={u.id}>
              <a href={`/residencia/${u.id}`}>{t.seo.unitLink(u.residence, u.beds)}</a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
