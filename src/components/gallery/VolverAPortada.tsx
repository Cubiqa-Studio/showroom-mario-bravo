"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";
import { ChevronLeftIcon } from "./icons";

/**
 * Flecha "volver a la portada de TIER" (`/`). TIER Bravo es uno de tres desarrollos:
 * desde el showroom tiene que haber una salida de vuelta al índice.
 *
 * Se monta en DOS lugares, y no por capricho:
 *  · de 560px para arriba, al lado del logotipo (arriba a la izquierda), que es donde
 *    la espera cualquiera y donde sobra lugar;
 *  · en teléfono, dentro de la pastilla de "Disponibilidad" (la segunda fila). La
 *    primera fila NO tiene lugar: medido, quedan 8px libres a 320 y también a 412,
 *    donde el rótulo "Consultar" ensancha la pastilla de acciones. Meterla ahí
 *    rompía el renglón, que es justo lo que pidió evitar Joaquim (31-08).
 */
export function VolverAPortada({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link
      href="/"
      aria-label={t.portada.volver}
      title={t.portada.volver}
      className={`grid shrink-0 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-ink ${className}`}
    >
      <ChevronLeftIcon width={20} height={20} />
    </Link>
  );
}
