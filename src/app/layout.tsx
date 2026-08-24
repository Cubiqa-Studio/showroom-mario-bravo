import type { Metadata, Viewport } from "next";
import { Jost, Playfair_Display_SC } from "next/font/google";
import "./globals.css";
import { TransitionProvider } from "@/components/transition/TransitionProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
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
    default: `${BRAND_SHORT} — Departamentos en Buenos Aires`,
    template: "%s — Mario Bravo 955",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Cubiqa Studio", url: "https://www.cubiqastudio.com/" }],
  creator: "Cubiqa Studio",
  publisher: "Cubiqa Studio",
  category: "real estate",
  keywords: [
    "departamentos en Buenos Aires",
    "Mario Bravo 955",
    "departamentos CABA",
    "monoambientes Buenos Aires",
    "emprendimiento Mario Bravo",
    "invertir en Buenos Aires",
  ],
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    title: `${BRAND_SHORT} — Departamentos en Buenos Aires`,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_SHORT} — Departamentos en Buenos Aires`,
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
  themeColor: "#A68132",
  // "only light" (no "light" a secas): es el ÚNICO valor que el auto-oscurecido
  // de Chrome/Android ("Oscurecer sitios web") respeta como opt-out — con "light"
  // igual invertía la página en los teléfonos del cliente. Espejado en globals.css.
  colorScheme: "only light",
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
          <TransitionProvider>
            {children}
            {modal}
          </TransitionProvider>
        </LanguageProvider>
        <CubiqaBadge />
      </body>
    </html>
  );
}
