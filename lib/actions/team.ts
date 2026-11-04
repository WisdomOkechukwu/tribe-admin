"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toActionResult } from "@/lib/api/client";
import { authorize } from "@/lib/auth/current";
import { listTeam } from "@/lib/data/repo";
import * as writes from "@/lib/data/writes";
import { ALL_PERMISSIONS, AVATAR_COLORS, normalisePerms } from "@/lib/domain/permissions";

// Team changes go to the Go API (/admin-api/team-members), which enforces the
// guardrails too (you can't lock yourself out; someone must manage the team)
// and audits every change. The checks here give a clear message early.

export type TeamResult = { ok: boolean; message: string; password?: string; id?: string };

const fail = (e: unknown): TeamResult => {
  const r = toActionResult(e);
  return { ok: false, message: r.message };
};

const Perms = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length);
const Who = z.object({
  name: z.string().trim().min(2, "Enter their full name.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(120),
  color: z.enum(AVATAR_COLORS),
});

async function member(id: string) {
  const team = await listTeam();
  return { team, target: team.find((m) => m.id === id) };
}

const activeManagers = (team: Awaited<ReturnType<typeof listTeam>>, excludeId: string) =>
  team.filter((m) => m.id !== excludeId && m.status === "active" && m.permissions.includes("team.manage")).length;

export async function addTeammate(input: unknown): Promise<TeamResult> {
  try {
    await authorize("team.manage");
    const p = Who.extend({ permissions: Perms }).safeParse(input);
    if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Check the form." };
    if (p.data.permissions.length === 0) return { ok: false, message: "Give them at least one permission." };
    const { data } = await writes.createTeammate({ ...p.data, permissions: normalisePerms(p.data.permissions) });
    refresh();
    return { ok: true, message: `${data.name} added`, password: data.temporary_password, id: data.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeammate(id: string, input: unknown): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    const p = Who.partial().extend({ permissions: Perms.optional() }).safeParse(input);
    if (!p.success || typeof id !== "string") return { ok: false, message: p.success ? "Invalid teammate." : p.error.issues[0]?.message ?? "Check the form." };
    const { team, target } = await member(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    const next = p.data.permissions ? normalisePerms(p.data.permissions) : target.permissions;
    if (id === me.id && !next.includes("team.manage")) return { ok: false, message: "You can't remove your own team-management access." };
    if (target.permissions.includes("team.manage") && !next.includes("team.manage") && activeManagers(team, id) === 0) {
      return { ok: false, message: "Someone must always be able to manage the team." };
    }
    await writes.updateTeammate(id, { name: p.data.name, color: p.data.color, permissions: next, version: target.version });
    refresh();
    return { ok: true, message: `${p.data.name ?? target.name}'s access saved` };
  } catch (e) {
    return fail(e);
  }
}

export async function setTeammateStatus(id: string, status: "active" | "suspended"): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    if (id === me.id) return { ok: false, message: "You can't suspend yourself." };
    if (status !== "active" && status !== "suspended") return { ok: false, message: "Invalid status." };
    const { team, target } = await member(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    if (status === "suspended" && target.permissions.includes("team.manage") && activeManagers(team, id) === 0) {
      return { ok: false, message: "Someone must always be able to manage the team." };
    }
    await writes.updateTeammate(id, { status, version: target.version });
    refresh();
    return { ok: true, message: status === "suspended" ? `${target.name} suspended: signed out on their next click` : `${target.name} reactivated` };
  } catch (e) {
    return fail(e);
  }
}

export async function resetTeammatePassword(id: string): Promise<TeamResult> {
  try {
    await authorize("team.manage");
    const { target } = await member(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    const { data } = await writes.updateTeammate(id, { resetPassword: true, version: target.version });
    refresh();
    return { ok: true, message: `New password for ${target.name}`, password: data.temporary_password };
  } catch (e) {
    return fail(e);
  }
}

export async function removeTeammate(id: string): Promise<TeamResult> {
  try {
    const me = await authorize("team.manage");
    if (id === me.id) return { ok: false, message: "You can't remove yourself." };
    const { team, target } = await member(id);
    if (!target) return { ok: false, message: "Teammate not found." };
    if (target.permissions.includes("team.manage") && activeManagers(team, id) === 0) return { ok: false, message: "Someone must always be able to manage the team." };
    await writes.removeTeammate(id);
    refresh();
    return { ok: true, message: `${target.name} removed` };
  } catch (e) {
    return fail(e);
  }
}
