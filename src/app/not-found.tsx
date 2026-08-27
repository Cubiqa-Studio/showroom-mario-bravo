"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";
import { SITE } from "@/data/site";

/**
 * Página 404 global (App Router: `app/not-found.tsx`). Se muestra para cualquier
 * URL que no matchee una ruta. Diseño premium: fondo con el aéreo del proyecto
 * (SITE.aerialImage) atenuado, y una tarjeta clara centrada (los logos son oscuros →
 * necesitan fondo claro) con el logo del proyecto, un "404" en serif dorado, el
 * mensaje bilingüe (ES/EN vía i18n), accesos al inicio y al showroom, y el crédito
 * de CUBIQA. Vive dentro del layout raíz → hereda LanguageProvider.
 */
export default function NotFound() {
  const { t } = useI18n();

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-tier-dark px-5 py-8 sm:py-14">
      {/* Fondo FIJO al viewport (aéreo del proyecto, atenuado). Fijo = no crece con el
          contenido ni fuerza scroll; `overflow-hidden` clipa el halo de scale-105. En
          mobile ACOSTADO el contenido puede superar el alto → la página scrollea y la
          tarjeta no se corta (antes, con overflow-hidden en el main, se cortaba). */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <img
          src={SITE.aerialImage}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2.5px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
      </div>

      {/* Tarjeta: frosted glass (translúcida + blur) para camuflarse con el aéreo.
          Va en el negro de marca para que el texto claro y el logo se lean sobre el
          aéreo. Más ancha (max-w-3xl) para que no quede tan alta, y blur más fuerte. */}
      <div className="relative z-10 w-full max-w-3xl rounded-3xl bg-tier-dark/45 px-8 py-10 text-center shadow-2xl ring-1 ring-white/15 backdrop-blur-3xl sm:px-14 sm:py-12">
        <img
          src="/logo.png"
          alt="TIER Bravo"
          className="mx-auto h-12 w-auto sm:h-14"
        />

        <p className="mt-9 font-serif text-7xl leading-none tracking-wide text-gold sm:text-8xl">
          404
        </p>

        <h1 className="mt-4 font-serif text-2xl tracking-wide text-ink sm:text-[1.75rem]">
          {t.notFound.title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
          {t.notFound.body}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="w-full rounded-full bg-gold px-7 py-3 text-[16.5px] font-semibold uppercase tracking-[0.18em] text-cream shadow-md transition hover:brightness-110 active:scale-95 sm:w-auto"
          >
            {t.notFound.home}
          </Link>
          <Link
            href="/showroom"
            className="w-full rounded-full bg-white/10 px-7 py-3 text-[16.5px] font-semibold uppercase tracking-[0.18em] text-ink ring-1 ring-white/20 transition hover:bg-white/20 active:scale-95 sm:w-auto"
          >
            {t.notFound.showroom}
          </Link>
        </div>

        {/* Crédito CUBIQA */}
        <div className="mt-11 flex flex-col items-center gap-2.5 border-t border-line pt-6">
          <span className="text-[14px] font-medium uppercase tracking-[0.24em] text-ink/55">
            {t.notFound.credit}
          </span>
          <a
            href="https://www.cubiqastudio.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CUBIQA Studio"
            title="CUBIQA Studio"
          >
            <img
              src="/logotipo_cubiqa.png"
              alt="CUBIQA"
              className="h-4 w-auto opacity-75 transition hover:opacity-100"
            />
          </a>
        </div>
      </div>
    </main>
  );
}
