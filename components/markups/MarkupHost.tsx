import { getAccess } from "@/lib/auth/current";
import { listFees, listMargins } from "@/lib/data/repo";
import { MarkupModal } from "./MarkupModal";

/** Server host: streams the current margins, fees and permission into the client modal. */
export async function MarkupHost() {
  const a = await getAccess();
  if (!a.has("markups.view")) return null;
  const [margins, fees] = await Promise.all([listMargins(), listFees()]);
  return <MarkupModal margins={margins} fees={fees} canEdit={a.has("markups.edit")} />;
}
