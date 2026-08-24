import { redirect } from "next/navigation";

/** /admin/polygon-editor → default to the first stop so the bare URL works. */
export default function PolygonEditorIndex() {
  redirect("/admin/polygon-editor/0");
}
