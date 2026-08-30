import type { Metadata } from "next";
import { PortadaScreen } from "@/components/intro/PortadaScreen";
import { getShowroomPreloadSrcs } from "@/lib/data";

// Canonical del home. El título/descripción/OG los hereda del layout (son la copy
// principal del sitio). Ver src/lib/seo.ts.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Raíz "/" = la PORTADA: los tres desarrollos de TIER dividiendo la pantalla
// (Camila, 30-08; antes era el video de un solo proyecto). El showroom vive en
// /showroom (ver app/showroom/page.tsx). Separar las rutas hace que el back del
// navegador vuelva a la portada y que un F5 sobre el showroom no la repita — sin
// cookies. Página estática (los proyectos y el copy no dependen de datos).
export default function Home() {
  // La portada es la sala de espera ideal para bajar los assets del showroom: acá el
  // visitante elige proyecto unos segundos y no hay nada más pesado compitiendo por la
  // red. Cuando entra a Bravo los frames ya están en la cache del navegador y el
  // showroom arranca sin "Cargando recorrido". La lista se calcula en el server y viaja
  // como un array de rutas (~4 KB de HTML); es SINCRÓNICA, así que `/` sigue siendo
  // estática.
  return <PortadaScreen preload={getShowroomPreloadSrcs()} />;
}
