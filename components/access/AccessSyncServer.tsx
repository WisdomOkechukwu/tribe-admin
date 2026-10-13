import { getAccess } from "@/lib/auth/current";
import { AccessSyncClient } from "./AccessSync";

/** Streams the admin's current permissions into the client store (UI hints only). */
export async function AccessSync() {
  const a = await getAccess();
  return <AccessSyncClient perms={a.perms} />;
}
