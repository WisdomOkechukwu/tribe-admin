import type { ReactNode } from "react";
import { Icon } from "@/components/shell/icons";
import { getAccess } from "@/lib/auth/current";
import { permMeta, type Permission } from "@/lib/domain/permissions";

/** Server gate: renders children only if the signed-in admin has `perm`. */
export async function Gate({ perm, children, compact }: { perm: Permission; children: ReactNode; compact?: boolean }) {
  const a = await getAccess();
  return a.has(perm) ? <>{children}</> : <NoAccess perm={perm} compact={compact} />;
}

export function NoAccess({ perm, compact }: { perm: Permission; compact?: boolean }) {
  const { group, item } = permMeta(perm);
  return (
    <div className={compact ? "rounded-card border-2 border-dashed border-line p-5 text-center" : "card mx-auto max-w-lg p-8 text-center"} role="status">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border-2 border-edge bg-warning-300 text-ink-900 shadow-hard-sm">
        <Icon name="lock" size={24} />
      </div>
      <p className="display text-[26px] font-extrabold uppercase">No access to {group.label}</p>
      <p className="mt-2 text-[13px] text-muted">
        This needs <b className="text-fg">“{item.label}”</b>. Ask a team manager to grant it on the Team page.
      </p>
    </div>
  );
}
