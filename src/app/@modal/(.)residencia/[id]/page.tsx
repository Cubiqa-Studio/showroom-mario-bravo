import { redirect } from "next/navigation";
import {
  floorUnitsFrom,
  getLiveUnits,
  getSite,
  otherAvailableUnitsFrom,
} from "@/lib/data";
import { DetailOverlay } from "@/components/residencia/DetailOverlay";

// Ruta INTERCEPTADA: cuando se navega `/` → `/residencia/:id` desde la app, se
// renderiza acá (slot @modal) como overlay SOBRE el home, que queda montado
// (estado de cámara preservado). En refresh/acceso directo no intercepta y cae
// a la ruta standalone `app/residencia/[id]`.
export default async function ResidenciaInterceptedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const units = await getLiveUnits();
  const unit = units[id];
  if (!unit) redirect("/");

  return (
    <DetailOverlay
      unit={unit}
      unitId={id}
      others={otherAvailableUnitsFrom(units, id)}
      site={getSite()}
      floorUnits={floorUnitsFrom(units, id)}
    />
  );
}
