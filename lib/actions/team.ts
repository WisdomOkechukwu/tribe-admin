"use server";

import { refresh, updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/lib/auth/current";
import * as users from "@/lib/auth/users";
import { TAGS } from "@/lib/data/repo";
import { logAudit } from "@/lib/data/writes";
import { ALL_PERMISSIONS, AVATAR_COLORS, normalisePerms, roleLabel } from "@/lib/domain/permissions";

export type TeamResult = { ok: boolean; message: string; password?: string; id?: string };

const fail = (e: unknown): TeamResult => {
  unstable_rethrow(e);
  return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
};

const Perms = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length);
const Who = z.object({
  name: z.string().trim().min(2, "Enter their full name.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(120),
  color: z.enum(AVATAR_COLORS),
});


export async function addTeammate(input: unknown): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    const p = Who.extend({ permissions: Perms }).safeParse(input);
    if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Check the form." };
    if (p.data.permissions.length === 0) return { ok: false, message: "Give them at least one permission." };
    const { user, password } = users.createUser(p.data, me.id);
    logAudit(me, "team.add", user.id, `Added ${user.name} (${user.email}) as ${roleLabel(user.role)} · ${user.permissions.length} permissions`, undefined, user.permissions.join(", "));
    updateTag(TAGS.audit);
    refresh();
    return { ok: true, message: `${user.name} added`, password, id: user.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeammate(id: string, input: unknown): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    const p = Who.partial().extend({ permissions: Perms.optional() }).safeParse(input);
    if (!p.success || typeof id !== "string") return { ok: false, message: p.success ? "Invalid teammate." : p.error.issues[0]?.message ?? "Check the form." };
    const target = users.getUser(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    const next = p.data.permissions ? normalisePerms(p.data.permissions) : target.permissions;
    if (id === me.id && !next.includes("team.manage")) return { ok: false, message: "You can't remove your own team-management access." };
    if (target.permissions.includes("team.manage") && !next.includes("team.manage") && users.activeManagers(id) === 0) {
      return { ok: false, message: "Someone must always be able to manage the team." };
    }
    const before = target.permissions.slice();
    const u = users.updateUser(id, { name: p.data.name, color: p.data.color, permissions: next });
    const added = next.filter((x) => !before.includes(x));
    const removed = before.filter((x) => !next.includes(x));
    const diff = [added.length && `+${added.length}`, removed.length && `−${removed.length}`].filter(Boolean).join(" ") || "details";
    logAudit(me, "team.update", u.id, `Updated ${u.name}: now ${roleLabel(u.role)} (${diff})`, before.join(", "), next.join(", "));
    updateTag(TAGS.audit);
    refresh();
    return { ok: true, message: `${u.name}'s access saved` };
  } catch (e) {
    return fail(e);
  }
}

export async function setTeammateStatus(id: string, status: "active" | "suspended"): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    if (id === me.id) return { ok: false, message: "You can't suspend yourself." };
    if (status !== "active" && status !== "suspended") return { ok: false, message: "Invalid status." };
    const target = users.getUser(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    if (status === "suspended" && target.permissions.includes("team.manage") && users.activeManagers(id) === 0) {
      return { ok: false, message: "Someone must always be able to manage the team." };
    }
    const before = target.status;
    users.setStatus(id, status);
    logAudit(me, status === "suspended" ? "team.suspend" : "team.reactivate", id, `${status === "suspended" ? "Suspended" : "Reactivated"} ${target.name}`, before, status);
    updateTag(TAGS.audit);
    refresh();
    return { ok: true, message: status === "suspended" ? `${target.name} suspended: signed out on their next click` : `${target.name} reactivated` };
  } catch (e) {
    return fail(e);
  }
}

export async function resetTeammatePassword(id: string): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    const { user, password } = users.resetPassword(id);
    logAudit(me, "team.reset", id, `Reset password for ${user.name}`);
    updateTag(TAGS.audit);
    refresh();
    return { ok: true, message: `New password for ${user.name}`, password };
  } catch (e) {
    return fail(e);
  }
}

export async function removeTeammate(id: string): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    if (id === me.id) return { ok: false, message: "You can't remove yourself." };
    const target = users.getUser(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    if (target.permissions.includes("team.manage") && users.activeManagers(id) === 0) return { ok: false, message: "Someone must always be able to manage the team." };
    users.removeUser(id);
    logAudit(me, "team.remove", id, `Removed ${target.name} (${target.email})`);
    updateTag(TAGS.audit);
    refresh();
    return { ok: true, message: `${target.name} removed` };
  } catch (e) {
    return fail(e);
  }
}
