"use client";

import type { UnitStatus } from "@/lib/types";
import { useI18n } from "@/i18n/LanguageProvider";

/** Badge de estado con el markup de la referencia (.badge.badge-available/reserved). */
export function StatusPill({ status }: { status: UnitStatus }) {
  const { t } = useI18n();
  const cls = status === "available" ? "badge badge-available" : "badge badge-reserved";
  return (
    <span className={cls}>
      <span className="dot" />
      {t.status[status]}
    </span>
  );
}
