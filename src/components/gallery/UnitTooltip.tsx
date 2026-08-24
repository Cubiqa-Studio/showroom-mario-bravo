"use client";

import type { Unit } from "@/lib/types";
import { UnitCard } from "../UnitCard";

/**
 * Hover de una unidad en el render exterior. Usa la tarjeta compacta compartida
 * (misma que "Planta del piso" y "Unidades Disponibles").
 */
export function UnitTooltip({ unit }: { unit: Unit }) {
  return <UnitCard unit={unit} />;
}
