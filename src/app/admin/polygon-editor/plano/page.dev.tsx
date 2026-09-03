import { redirect } from "next/navigation";
import { getFloors } from "@/lib/data";

/** /admin/polygon-editor/plano → primer piso, para que la URL pelada funcione. */
export default function PlateEditorIndex() {
  redirect(`/admin/polygon-editor/plano/${getFloors()[0] ?? "5"}`);
}
