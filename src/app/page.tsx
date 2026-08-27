import type { Metadata } from "next";
import { IntroScreen } from "@/components/intro/IntroScreen";
import { getShowroomPreloadSrcs } from "@/lib/data";

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
  // La intro es la sala de espera ideal para bajar los assets del showroom: acá el
  // visitante lee el copy unos segundos y no hay nada más compitiendo por la red (el
  // video todavía no está: `INTRO_VIDEO_READY`). Cuando aprieta "Descubrir" los frames
  // ya están en la cache del navegador y el showroom arranca sin "Cargando recorrido".
  // La lista se calcula en el server y viaja como un array de rutas (~4 KB de HTML);
  // es SINCRÓNICA, así que `/` sigue siendo estática.
  return <IntroScreen preload={getShowroomPreloadSrcs()} />;
}
