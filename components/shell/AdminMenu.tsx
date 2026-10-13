import { getAdmin } from "@/lib/auth/current";
import { logout } from "@/lib/actions/auth";
import { roleLabel } from "@/lib/domain/permissions";
import { Icon } from "./icons";

export async function AdminMenu() {
  const admin = await getAdmin();
  const initials = admin.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-[12.5px] font-medium">{admin.name}</div>
        <div className="text-[11px] text-muted">{roleLabel(admin.role)}</div>
      </div>
      <span className="grid size-9 place-items-center rounded-full border-2 border-edge bg-orange-500 text-[12px] font-bold text-ink-900" aria-hidden>{initials}</span>
      <form action={logout}>
        <button type="submit" className="pop grid size-9 cursor-pointer place-items-center rounded-full bg-surface" aria-label="Sign out" title="Sign out">
          <Icon name="logout" />
        </button>
      </form>
    </div>
  );
}

export function AdminMenuSkeleton() {
  return <div className="flex items-center gap-2"><div className="shimmer hidden h-8 w-24 rounded-chip sm:block" /><div className="shimmer size-9 rounded-full" /></div>;
}
