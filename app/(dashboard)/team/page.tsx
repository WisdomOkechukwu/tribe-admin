import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { Icon } from "@/components/shell/icons";
import { MemberActions } from "@/components/team/MemberActions";
import { RISK, TeamAvatar } from "@/components/team/shared";
import { AddTeammateButton, EditAccessButton, TeamEditor } from "@/components/team/TeamEditor";
import { StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { PageHeader, Stat } from "@/components/ui/Panel";
import { BrandLoader, CardsSkeleton, PanelSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { listTeam } from "@/lib/data/repo";
import { PERMISSION_GROUPS, ROLE_PRESETS, roleLabel } from "@/lib/domain/permissions";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { oneOf, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Team & access" };

export default function TeamPage({ searchParams }: PageProps<"/team">) {
  return (
    <>
      <PageHeader
        eyebrow="who can do what"
        title="Team & access"
        subtitle="Add teammates and choose exactly what they can see and do. Changes apply on their next click; no sign-out needed."
        actions={
          <Suspense fallback={null}>
            <ManageOnly />
          </Suspense>
        }
      />
      <Suspense fallback={<div className="space-y-6"><CardsSkeleton /><BrandLoader text="Loading the team…" /><div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <PanelSkeleton key={i} title={false} />)}</div></div>}>
        <Gate perm="team.view">
          <Team searchParams={searchParams} />
        </Gate>
      </Suspense>
    </>
  );
}

async function ManageOnly() {
  const a = await getAccess();
  return a.has("team.manage") ? <AddTeammateButton /> : <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-line px-3 py-1.5 text-[12px] text-muted"><Icon name="lock" size={13} /> View only</span>;
}

const ROLE_COLOR = Object.fromEntries(ROLE_PRESETS.map((r) => [r.id, r.color]));

async function Team({ searchParams }: Pick<PageProps<"/team">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const view = oneOf(sp, "view", ["matrix"]) ?? "people";
  const [team, access] = await Promise.all([listTeam(), getAccess()]);
  const canManage = access.has("team.manage");
  const active = team.filter((m) => m.status === "active");
  const allItems = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g })));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat color="purple" label="Active" value={active.length} />
        <Stat color="yellow" label="Suspended" value={team.length - active.length} />
        <Stat color="orange" label="Can manage team" value={active.filter((m) => m.permissions.includes("team.manage")).length} />
        <Stat color="ink" label="Custom roles" value={team.filter((m) => m.role === "custom").length} />
      </div>

      <LinkTabs
        label="View"
        items={[
          { href: "/team", label: "People", count: team.length, active: view === "people" },
          { href: "/team?view=matrix", label: "Access matrix", active: view === "matrix" },
        ]}
      />

      {view === "people" ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {team.map((m) => {
            const isMe = m.id === access.admin.id;
            return (
              <li key={m.id} className={cx("card flex flex-col overflow-hidden", m.status === "suspended" && "opacity-70")}>
                <div className="flex items-start gap-3 p-4">
                  <TeamAvatar name={m.name} color={m.color} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-extrabold">{m.name}</span>
                      {isMe && <span className="rounded-full bg-orange-500 px-2 text-[10.5px] font-bold uppercase text-ink-900">you</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">{m.email}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-edge px-2.5 py-0.5 text-[11.5px] font-extrabold">
                        <span className="size-2.5 rounded-full" style={{ background: ROLE_COLOR[m.role] ?? "var(--color-orange-500)" }} aria-hidden />
                        {roleLabel(m.role)}
                      </span>
                      <StatusPill status={m.status === "active" ? "active" : "frozen"} label={m.status === "active" ? "Active" : "Suspended"} />
                    </div>
                  </div>
                </div>
                {/* Access strip: one chip per area: lit if they can see it. */}
                <div className="border-y-2 border-line bg-sunken px-4 py-3">
                  <div className="mb-2 flex justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted">
                    <span>Access</span>
                    <span>{m.permissions.length}/{allItems.length}</span>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {PERMISSION_GROUPS.map((g) => {
                      const n = g.items.filter((i) => m.permissions.includes(i.key)).length;
                      return (
                        <li
                          key={g.id}
                          title={`${g.label}: ${n ? `${n}/${g.items.length}` : "no access"}`}
                          className={cx("grid size-8 place-items-center rounded-full border-2", n === 0 ? "border-dashed border-line text-muted/50" : n === g.items.length ? "border-edge bg-purple-500 text-white" : "border-edge bg-purple-100 text-purple-900 dark:bg-purple-800 dark:text-purple-50")}
                        >
                          <Icon name={n ? g.icon : "lock"} size={13} />
                          <span className="sr-only">{g.label}: {n ? `${n} of ${g.items.length}` : "no access"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 p-4">
                  <span className="text-[11.5px] text-muted">{m.lastLoginAt ? `Last in ${fmtDateTime(m.lastLoginAt)}` : `Added ${fmtDate(m.createdAt)}`}</span>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditAccessButton member={{ id: m.id, name: m.name, email: m.email, color: m.color, permissions: m.permissions }} />
                      <MemberActions id={m.id} name={m.name} email={m.email} status={m.status} isMe={isMe} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[900px] text-left text-[12.5px]">
              <thead className="sticky top-0 z-[1] bg-surface">
                <tr className="border-b-2 border-line">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">Permission</th>
                  {team.map((m) => (
                    <th key={m.id} className="px-2 py-3 text-center">
                      <span className="inline-flex flex-col items-center gap-1" title={`${m.name} · ${roleLabel(m.role)}`}>
                        <TeamAvatar name={m.name} color={m.color} size={30} />
                        <span className={cx("max-w-20 truncate text-[10.5px] font-bold", m.status === "suspended" && "line-through opacity-60")}>{m.name.split(" ")[0]}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {PERMISSION_GROUPS.map((g) => (
                <tbody key={g.id}>
                  <tr className="bg-sunken">
                    <th colSpan={team.length + 1} className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1.5"><Icon name={g.icon} size={13} /> {g.label}</span>
                    </th>
                  </tr>
                  {g.items.map((i) => (
                    <tr key={i.key} className="border-b border-line hover:bg-purple-50/50 dark:hover:bg-purple-900/20">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <Icon name={RISK[i.risk].icon} size={12} className="text-muted" />
                          <span className="font-semibold">{i.label}</span>
                        </span>
                      </td>
                      {team.map((m) => {
                        const ok = m.permissions.includes(i.key);
                        return (
                          <td key={m.id} className="px-2 py-2 text-center">
                            {ok ? (
                              <span className={cx("inline-grid size-6 place-items-center rounded-full border-2 border-edge", i.risk === "sensitive" ? "bg-error-500 text-white" : i.risk === "action" ? "bg-orange-500 text-ink-900" : "bg-success-500 text-white")} title={`${m.name}: ${i.label}`}>
                                <Icon name="check" size={11} />
                              </span>
                            ) : (
                              <span className="inline-block size-1.5 rounded-full bg-line" aria-label="no" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t-2 border-line bg-sunken px-4 py-3 text-[11.5px]">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-edge bg-success-500" /> View</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-edge bg-orange-500" /> Action</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-edge bg-error-500" /> Sensitive</span>
          </div>
        </div>
      )}

      {canManage && <TeamEditor meId={access.admin.id} />}
    </div>
  );
}
