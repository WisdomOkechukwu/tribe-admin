import { countPendingVerifications } from "@/lib/data/repo";
import { KycPendingSyncClient } from "./KycPendingSyncClient";

/**
 * Streams the number of verification requests awaiting review into the sidebar badge. It runs
 * with the layout, so it refreshes whenever the page refreshes (a decision calls refresh()).
 */
export async function KycPendingSync() {
  const pending = await countPendingVerifications().catch(() => 0);
  return <KycPendingSyncClient pending={pending} />;
}
