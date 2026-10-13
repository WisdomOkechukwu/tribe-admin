"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { NAV } from "@/components/shell/nav";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { addTeammate, updateTeammate } from "@/lib/actions/team";
import { AVATAR_COLORS, PERMISSION_GROUPS, ROLE_PRESETS, roleLabel, type AvatarColor, type Permission, type PermGroup, type Risk } from "@/lib/domain/permissions";
import { permList, useTeamEditor } from "@/stores/team-editor-store";
import { AVATAR_BG, RISK, RiskBadge, TeamAvatar } from "./shared";
import { toast } from "@/stores/toast-store";

export function AddTeammateButton() {
  const openAdd = useTeamEditor((s) => s.openAdd);
  return (
    <Button variant="primary" onClick={openAdd}>
      <Icon name="plus" size={15} /> Add teammate
    </Button>
  );
}

export function EditAccessButton({ member }: { member: { id: string; name: string; email: string; color: AvatarColor; permissions: string[] } }) {
  const openEdit = useTeamEditor((s) => s.openEdit);
  return (
    <Button size="sm" variant="ink" onClick={() => openEdit(member)}>
      <Icon name="key" size={13} /> Edit access
    </Button>
  );
}

const STEPS = ["Who", "Access", "Review"] as const;

export function TeamEditor({ meId }: { meId: string }) {
  const s = useTeamEditor();
  const [pending, start] = useTransition();
  const perms = permList(s.perms);
  const selfEdit = s.mode === "edit" && s.id === meId;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim());
  const whoOk = s.name.trim().length >= 2 && emailOk;

  const submit = () =>
    start(async () => {
      const payload = { name: s.name, email: s.email, color: s.color, permissions: perms };
      const r = s.mode === "add" ? await addTeammate(payload) : await updateTeammate(s.id!, payload);
      if (!r.ok) return void toast.error(r.message);
      toast.success(r.message);
      if (s.mode === "add") s.setResult({ name: s.name, password: r.password });
      else s.close();
    });

  return (
    <Modal
      open={s.open}
      onClose={s.close}
      wide
      title={s.result ? "You're all set" : s.mode === "add" ? "Add teammate" : `Edit access · ${s.name}`}
      subtitle={s.result ? "Share the temporary password privately. It's only shown once." : "Pick a role to start, then fine-tune exactly what they can see and do."}
      footer={
        s.result ? (
          <>
            <span />
            <Button variant="primary" onClick={s.close}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={s.step === 0 || (s.mode === "edit" && s.step === 1) ? s.close : () => s.setStep((s.step - 1) as 0 | 1)}>
              {s.step === 0 || (s.mode === "edit" && s.step === 1) ? "Cancel" : "← Back"}
            </Button>
            {s.step < 2 ? (
              <Button variant="primary" onClick={() => s.setStep((s.step + 1) as 1 | 2)} disabled={s.step === 0 ? !whoOk : perms.length === 0}>
                Next: {STEPS[s.step + 1]} →
              </Button>
            ) : (
              <Button variant="orange" onClick={submit} disabled={pending || perms.length === 0}>
                {pending ? "Saving…" : s.mode === "add" ? "Add teammate ✦" : "Save access"}
              </Button>
            )}
          </>
        )
      }
    >
      {s.result ? (
        <PasswordReveal name={s.result.name} password={s.result.password} email={s.email} />
      ) : (
        <div className="p-5 sm:p-6">
          <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
            {STEPS.map((label, i) => {
              const reachable = i === 0 ? s.mode === "add" : i === 1 ? whoOk : whoOk && perms.length > 0;
              return (
                <li key={label}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => s.setStep(i as 0 | 1 | 2)}
                    aria-current={s.step === i ? "step" : undefined}
                    className={cx("inline-flex h-9 items-center gap-2 rounded-full border-2 border-edge px-3.5 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-40", s.step === i ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "pop cursor-pointer bg-surface")}
                  >
                    <span className={cx("grid size-5 place-items-center rounded-full text-[11px]", s.step === i ? "bg-orange-500 text-ink-900 dark:bg-ink-900 dark:text-white" : "bg-sunken")}>{i + 1}</span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
          {s.step === 0 && <StepWho emailOk={emailOk} />}
          {s.step === 1 && <StepAccess selfEdit={selfEdit} />}
          {s.step === 2 && <StepReview />}
        </div>
      )}
    </Modal>
  );
}

function StepWho({ emailOk }: { emailOk: boolean }) {
  const name = useTeamEditor((s) => s.name);
  const email = useTeamEditor((s) => s.email);
  const color = useTeamEditor((s) => s.color);
  const set = useTeamEditor((s) => s.set);
  const mode = useTeamEditor((s) => s.mode);
  const input = "h-12 w-full rounded-chip border-2 border-edge bg-surface px-4 text-[14px] outline-none focus:border-purple-500 focus:shadow-hard-sm focus-visible:outline-none";
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider">Full name</span>
          <input className={input} value={name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Amara Eze" autoFocus maxLength={60} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider">Work email</span>
          <input className={cx(input, email && !emailOk && "border-error-500")} type="email" value={email} onChange={(e) => set({ email: e.target.value })} placeholder="amara@tribe.africa" disabled={mode === "edit"} maxLength={120} />
          {email && !emailOk && <span className="mt-1 block text-[12px] text-error-600">That doesn&apos;t look like an email.</span>}
        </label>
        <div>
          <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider" id="color-label">Avatar colour</span>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-labelledby="color-label">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => set({ color: c })}
                className={cx("size-10 cursor-pointer rounded-full border-2 border-edge transition-transform", AVATAR_BG[c], color === c ? "scale-110 shadow-hard-sm ring-4 ring-orange-300" : "hover:scale-105")}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="card flex flex-col items-center justify-center gap-3 bg-sunken p-6 text-center">
        <TeamAvatar name={name || "New Teammate"} color={color} size={72} />
        <div>
          <div className="display text-[22px] font-extrabold uppercase">{name || "New teammate"}</div>
          <div className="text-[12.5px] text-muted">{email || "name@tribe.africa"}</div>
        </div>
        <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold uppercase text-ink-900">preview</span>
      </div>
    </div>
  );
}

function StepAccess({ selfEdit }: { selfEdit: boolean }) {
  const role = useTeamEditor((s) => s.role);
  const applyPreset = useTeamEditor((s) => s.applyPreset);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider">Start from a role</span>
            <span className="text-[12px] text-muted">Currently: <b className="text-fg">{roleLabel(role)}</b>{role === "custom" && " (tweaked)"}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Role preset">
            {ROLE_PRESETS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={role === r.id}
                onClick={() => applyPreset(r.id)}
                className={cx("pop relative cursor-pointer rounded-chip p-3 text-left", role === r.id ? "bg-orange-100 dark:bg-orange-900/50" : "bg-surface")}
              >
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full border-2 border-edge" style={{ background: r.color }} aria-hidden />
                  <span className="font-extrabold">{r.label}</span>
                  <span className="ml-auto rounded-full bg-sunken px-1.5 text-[10.5px] font-bold">{r.perms.length}</span>
                </span>
                <span className="mt-1 block text-[11.5px] leading-snug text-muted">{r.blurb}</span>
                {role === r.id && <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border-2 border-edge bg-orange-500 text-ink-900"><Icon name="check" size={11} /></span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider">Fine-tune · {PERMISSION_GROUPS.length} areas</span>
            <span className="flex gap-1.5">
              <RiskBadge risk="view" /><RiskBadge risk="action" /><RiskBadge risk="sensitive" />
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {PERMISSION_GROUPS.map((g) => <GroupCard key={g.id} group={g} selfEdit={selfEdit} />)}
          </div>
        </div>
      </div>
      <LivePreview />
    </div>
  );
}

function GroupCard({ group, selfEdit }: { group: PermGroup; selfEdit: boolean }) {
  const states = useTeamEditor((s) => group.items.map((i) => !!s.perms[i.key]).join(""));
  const toggleGroup = useTeamEditor((s) => s.toggleGroup);
  const on = states.split("").filter((c) => c === "t").length;
  const all = on === group.items.length;
  const none = on === 0;
  return (
    <section className={cx("rounded-chip border-2 transition-colors", none ? "border-line bg-sunken/60" : "border-edge bg-surface")}>
      <header className="flex items-center gap-2.5 border-b-2 border-line px-3 py-2.5">
        <span className={cx("grid size-8 place-items-center rounded-full border-2 border-edge", none ? "bg-surface text-muted" : "bg-purple-500 text-white")}><Icon name={group.icon} size={15} /></span>
        <span className="flex-1">
          <span className="block font-extrabold">{group.label}</span>
          <span className="block text-[11px] text-muted">{none ? "No access" : all ? "Full access" : `${on} of ${group.items.length}`}</span>
        </span>
        <div className="inline-flex rounded-full border-2 border-edge p-0.5 text-[11px] font-bold" role="group" aria-label={`${group.label} quick set`}>
          <button type="button" onClick={() => toggleGroup(group.id, false)} aria-pressed={none} className={cx("cursor-pointer rounded-full px-2 py-0.5", none && "bg-ink-900 text-white dark:bg-white dark:text-ink-900")} disabled={selfEdit && group.id === "team"}>None</button>
          <button type="button" onClick={() => toggleGroup(group.id, true)} aria-pressed={all} className={cx("cursor-pointer rounded-full px-2 py-0.5", all && "bg-orange-500 text-ink-900")}>All</button>
        </div>
      </header>
      <ul className="divide-y-2 divide-line">
        {group.items.map((item, i) => <PermRow key={item.key} perm={item.key as Permission} label={item.label} hint={item.hint} risk={item.risk} isView={i === 0} viewKey={group.items[0].key} locked={selfEdit && item.key === "team.manage"} />)}
      </ul>
    </section>
  );
}

function PermRow({ perm, label, hint, risk, isView, viewKey, locked }: { perm: Permission; label: string; hint: string; risk: Risk; isView: boolean; viewKey: string; locked: boolean }) {
  const on = useTeamEditor((s) => !!s.perms[perm]);
  const viewOn = useTeamEditor((s) => !!s.perms[viewKey]);
  const toggle = useTeamEditor((s) => s.toggle);
  const needsView = !isView && !viewOn;
  return (
    <li className={cx("flex items-center gap-3 px-3 py-2.5", needsView && "opacity-55")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-semibold">{label}</span>
          <RiskBadge risk={risk} />
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{locked ? "You can't remove this from yourself." : needsView ? "Turn on view access first (we'll do it for you)." : hint}</p>
      </div>
      <Toggle on={on} onChange={(v) => toggle(perm, v)} label={label} disabled={locked} />
    </li>
  );
}

function LivePreview() {
  const perms = useTeamEditor((s) => s.perms);
  const name = useTeamEditor((s) => s.name);
  const color = useTeamEditor((s) => s.color);
  const granted = permList(perms);
  const all = PERMISSION_GROUPS.flatMap((g) => g.items as readonly { key: string; risk: Risk }[]);
  const count = (r: Risk) => all.filter((i) => i.risk === r && perms[i.key]).length;
  const views = count("view"), actions = count("action"), sensitive = count("sensitive");
  const score = actions * 2 + sensitive * 3;
  const level = score >= 22 ? { t: "High power", c: "bg-error-500" } : score >= 9 ? { t: "Medium", c: "bg-orange-500" } : { t: "Low risk", c: "bg-success-500" };
  return (
    <aside className="xl:sticky xl:top-0 xl:self-start">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b-2 border-line bg-sunken p-3">
          <TeamAvatar name={name || "New Teammate"} color={color} size={34} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold">{name || "New teammate"} will see</div>
            <div className="text-[11px] text-muted">Live preview of their sidebar</div>
          </div>
        </div>
        <ul className="space-y-0.5 bg-purple-900 p-2">
          {NAV.map((n) => {
            const ok = !!perms[n.perm];
            return (
              <li key={n.href} className={cx("flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold", ok ? "text-white" : "text-purple-100/35 line-through")}>
                <Icon name={n.icon} size={14} />
                <span className="flex-1">{n.label}</span>
                {ok ? <Icon name="check" size={12} className="text-success-300" /> : <Icon name="lock" size={12} />}
              </li>
            );
          })}
        </ul>
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[{ n: views, l: "View" }, { n: actions, l: "Actions" }, { n: sensitive, l: "Sensitive" }].map((x) => (
              <div key={x.l} className="rounded-chip bg-sunken py-2">
                <div className="display num text-[22px] font-extrabold">{x.n}</div>
                <div className="text-[10.5px] font-bold uppercase text-muted">{x.l}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider"><span>Power level</span><span>{level.t}</span></div>
            <div className="h-3 overflow-hidden rounded-full border-2 border-edge bg-sunken">
              <div className={cx("h-full transition-[width] duration-300", level.c)} style={{ width: `${Math.min(100, Math.max(4, (score / 40) * 100))}%` }} />
            </div>
          </div>
          <p className="text-[11px] text-muted">{granted.length} of {all.length} permissions granted.</p>
        </div>
      </div>
    </aside>
  );
}

function StepReview() {
  const s = useTeamEditor();
  const granted = permList(s.perms);
  const added = granted.filter((p) => !s.original[p]);
  const removed = Object.keys(s.original).filter((p) => s.original[p] && !s.perms[p]);
  const label = (key: string) => PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, g: g.label }))).find((i) => i.key === key);
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="card flex flex-col items-center gap-2 bg-sunken p-5 text-center">
        <TeamAvatar name={s.name} color={s.color} size={64} />
        <div className="display text-[22px] font-extrabold uppercase">{s.name}</div>
        <div className="text-[12px] text-muted">{s.email}</div>
        <span className="mt-1 rounded-full border-2 border-edge bg-orange-500 px-3 py-0.5 text-[12px] font-extrabold text-ink-900">{roleLabel(s.role)}</span>
      </div>
      <div className="space-y-4">
        {s.mode === "edit" && (added.length > 0 || removed.length > 0) && (
          <div className="card p-4">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider">Changes</div>
            <ul className="flex flex-wrap gap-1.5">
              {added.map((p) => <li key={p} className="rounded-full bg-success-100 px-2.5 py-0.5 text-[12px] font-semibold text-success-900">+ {label(p)?.label}</li>)}
              {removed.map((p) => <li key={p} className="rounded-full bg-error-50 px-2.5 py-0.5 text-[12px] font-semibold text-error-600 line-through">− {label(p)?.label}</li>)}
            </ul>
          </div>
        )}
        {PERMISSION_GROUPS.map((g) => {
          const items = g.items.filter((i) => s.perms[i.key]);
          return (
            <div key={g.id} className="flex flex-wrap items-center gap-1.5">
              <span className={cx("inline-flex w-36 items-center gap-1.5 text-[12.5px] font-bold", !items.length && "text-muted line-through")}><Icon name={items.length ? g.icon : "lock"} size={14} /> {g.label}</span>
              {items.length ? items.map((i) => <span key={i.key} className="inline-flex items-center gap-1 rounded-full border-2 border-line px-2 py-0.5 text-[11.5px] font-semibold"><Icon name={RISK[i.risk].icon} size={11} /> {i.label}</span>) : <span className="text-[12px] text-muted">No access</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PasswordReveal({ name, password, email }: { name: string; password?: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  if (!password) return null;
  return (
    <div className="p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full border-2 border-edge bg-success-500 text-white shadow-hard"><Icon name="check" size={28} /></div>
      <p className="display text-[28px] font-extrabold uppercase">{name} can sign in</p>
      {email && <p className="mt-1 text-[13px] text-muted">at <b className="text-fg">/login</b> with <b className="text-fg">{email}</b> and this temporary password:</p>}
      <div className="mx-auto mt-5 flex max-w-md items-center gap-2 rounded-chip border-2 border-edge bg-warning-300 p-2 pl-4 text-ink-900 shadow-hard-sm">
        <code className="flex-1 truncate text-left font-mono text-[18px] font-bold tracking-wide">{password}</code>
        <Button
          size="sm"
          variant="ink"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-3 text-[12px] text-muted">Shown once. Send it over a private channel, never email + password together.</p>
    </div>
  );
}
