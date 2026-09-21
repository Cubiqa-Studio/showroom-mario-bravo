"use client";

import type { UnitStatus } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";

/** Badge de estado con el markup de la referencia: `.badge.badge-<estado>`.
 *
 *  La clase se deriva del estado en vez de elegirse con un ternario: antes eran dos
 *  ramas ("available" o el resto), así que al sumar "sold" una unidad vendida se
 *  habría pintado de ámbar —el color de Reservada— mientras el texto decía
 *  "Vendida". El CSS de cada `.badge-*` vive en residencia.css. */
export function StatusPill({ status }: { status: UnitStatus }) {
  const { t } = useI18n();
  const cls = `badge badge-${status}`;
  return (
    <span className={cls}>
      <span className="dot" />
      {t.status[status]}
    </span>
  );
}
