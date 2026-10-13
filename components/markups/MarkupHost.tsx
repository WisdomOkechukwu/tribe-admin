import { getAccess } from "@/lib/auth/current";
import { listMarkups } from "@/lib/data/repo";
import { MarkupModal } from "./MarkupModal";

/** Server host: streams the current rules + permission into the client modal. */
export async function MarkupHost() {
  const a = await getAccess();
  if (!a.has("markups.view")) return null;
  const rules = await listMarkups();
  return <MarkupModal rules={rules} canEdit={a.has("markups.edit")} />;
}
