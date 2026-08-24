import type { Metadata } from "next";
import { IntroScreen } from "@/components/intro/IntroScreen";

// Canonical del home. El título/descripción/OG los hereda del layout (son la copy
// principal del sitio). Ver src/lib/seo.ts.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Raíz "/" = la INTRO: lo primero que ve el visitante al entrar. El showroom vive
// en /showroom (ver app/showroom/page.tsx). Separar las rutas hace que el back
// del navegador vuelva a la intro y que un F5 sobre el showroom no la repita —
// sin cookies. Página estática (el video y el copy no dependen de datos).
export default function Home() {
  return <IntroScreen />;
}
