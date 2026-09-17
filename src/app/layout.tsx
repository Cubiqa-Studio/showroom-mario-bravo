import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { TransitionProvider } from "@/components/transition/TransitionProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { OrigenProvider } from "@/components/OrigenProvider";
import { CubiqaBadge } from "@/components/CubiqaBadge";
import { getUnitIds } from "@/lib/data";
import {
  SITE_URL,
  SITE_NAME,
  BRAND_SHORT,
  DEFAULT_DESCRIPTION,
  OG_IMAGE,
  OG_LOCALE,
  HTML_LANG,
  siteGraphLd,
  jsonLdScriptProps,
} from "@/lib/seo";

// Tipografía de MARCA: Montserrat, la del brochure de TIER Bravo (Camila, 10-09-2026;
// Juani confirmó "en toda la web"). Reemplaza a Playfair Display SC + Jost.
//
// Una sola familia para los dos ROLES de siempre: texto general (--font-sans/--sans)
// y títulos (--font-serif/--serif; "serif" quedó como nombre del rol, ya no es una
// serif). Es variable, así que trae todos los pesos. El peso de los títulos NO sale
// de acá: lo fija `--display-weight` en globals.css (Light, como en el brochure).
// ⚠ No sirve cargar una segunda instancia "sólo 300" para los títulos: next/font les
// pone a las dos el MISMO nombre de familia, el navegador las fusiona y cada título
// sale con el peso que pida su regla. Medido.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_SHORT} — Departamentos en Mario Bravo 955, Buenos Aires`,
    template: "%s — TIER Bravo",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Cubiqa Studio", url: "https://www.cubiqastudio.com/" }],
  creator: "Cubiqa Studio",
  publisher: "Cubiqa Studio",
  category: "real estate",
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    title: `${BRAND_SHORT} — Departamentos en Mario Bravo 955, Buenos Aires`,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_SHORT} — Departamentos en Mario Bravo 955, Buenos Aires`,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  // Barra del navegador en el negro de marca (= --tier-dark), que ahora es el lienzo.
  themeColor: "#0B0B0B",
  // Declara que la página YA es oscura (controles de formulario, scrollbars y el
  // auto-oscurecido de Chrome/Android se alinean solos). El tipo `Viewport` de Next
  // no admite el `only`, así que el opt-out duro va en el :root de globals.css
  // (`color-scheme: only dark`), que es la declaración que manda sobre el documento.
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={HTML_LANG}
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Player API de Kuula. `beforeInteractive` porque tiene que estar ANTES de que
            se monte cualquier iframe: engancha `frameloaded` una sola vez y, si llega
            tarde, ese evento se pierde y nunca hay frameId. Son 2,8 KB y sólo lo usa el
            hero en TÁCTIL (ver src/hooks/useZoomKuula.ts). */}
        <Script src="https://static.kuula.io/api.js" strategy="beforeInteractive" />
        {/* JSON-LD del sitio: Organization (Cubiqa) + WebSite + ApartmentComplex
            (el desarrollo). Los datos por-unidad van en cada /residencia/:id. */}
        <script {...jsonLdScriptProps(siteGraphLd(getUnitIds().length))} />
        <LanguageProvider>
          {/* Lee `?v=…` de la URL de entrada y se acuerda de quién trajo la visita
              (ver src/lib/origen.ts). Tiene que envolver TODA la app: el parámetro
              viene en la primera carga y la navegación interna se lo lleva. */}
          <OrigenProvider>
            {/* La ficha de unidad se abre SOBRE el showroom como overlay (ver
                ShowroomClient / UnitDetailHost). Antes esto era un slot paralelo
                `@modal` con una ruta interceptada, que `output: "export"` no
                soporta: la interceptación la decide el servidor y acá no hay. */}
            <TransitionProvider>{children}</TransitionProvider>
          </OrigenProvider>
        </LanguageProvider>
        {/* <footer> para que el badge no quede fuera de todo landmark. No lo mueve: el
            `fixed` vive en el propio componente. */}
        <footer>
          <CubiqaBadge />
        </footer>
      </body>
    </html>
  );
}
