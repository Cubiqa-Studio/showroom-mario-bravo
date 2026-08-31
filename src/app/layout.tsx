import type { Metadata, Viewport } from "next";
import { Jost, Playfair_Display_SC } from "next/font/google";
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

// Tipografías de MARCA — definidas por el cliente (Miro, 2026-06-10):
//   · Playfair Display SC → títulos / display
//   · Jost → tipografía general (cuerpo y subtítulos)
// Se exponen como variables CSS en <html> y se consumen globalmente
// (globals.css → --font-serif/--font-sans) y en la landing de detalle
// (residencia.css → --serif/--sans).
const playfairSC = Playfair_Display_SC({
  variable: "--font-playfair-sc",
  weight: ["400", "700"], // Playfair Display SC provee 400/700/900 — alcanza con 400 y 700
  subsets: ["latin"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"], // fuente variable → todo el eje de pesos disponible
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
  keywords: [
    "TIER Bravo",
    "Mario Bravo 955",
    "departamentos en Buenos Aires",
    "departamentos CABA",
    "monoambientes Buenos Aires",
    "TIER desarrollos",
  ],
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
  modal,
}: Readonly<{
  children: React.ReactNode;
  // Slot paralelo `@modal`: el detalle de unidad interceptado SOBRE el home.
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang={HTML_LANG}
      className={`${playfairSC.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* JSON-LD del sitio: Organization (Cubiqa) + WebSite + ApartmentComplex
            (el desarrollo). Los datos por-unidad van en cada /residencia/:id. */}
        <script {...jsonLdScriptProps(siteGraphLd(getUnitIds().length))} />
        <LanguageProvider>
          {/* Lee `?v=…` de la URL de entrada y se acuerda de quién trajo la visita
              (ver src/lib/origen.ts). Tiene que envolver TODA la app: el parámetro
              viene en la primera carga y la navegación interna se lo lleva. */}
          <OrigenProvider>
            <TransitionProvider>
              {children}
              {modal}
            </TransitionProvider>
          </OrigenProvider>
        </LanguageProvider>
        <CubiqaBadge />
      </body>
    </html>
  );
}
