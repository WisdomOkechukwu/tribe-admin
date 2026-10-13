"use client";

import { create } from "zustand";
import { PERMISSION_GROUPS, ROLE_PRESETS, detectRole, requiresView, type AvatarColor, type Permission, type RoleId } from "@/lib/domain/permissions";

export type EditorMember = { id: string; name: string; email: string; color: AvatarColor; permissions: string[] };
type Perms = Record<string, boolean>;

type EditorState = {
  open: boolean;
  mode: "add" | "edit";
  step: 0 | 1 | 2;
  id?: string;
  name: string;
  email: string;
  color: AvatarColor;
  perms: Perms;
  original: Perms;
  role: RoleId;
  result: { name: string; password?: string } | null;
  openAdd: () => void;
  openEdit: (m: EditorMember) => void;
  close: () => void;
  setStep: (s: 0 | 1 | 2) => void;
  set: (patch: Partial<Pick<EditorState, "name" | "email" | "color">>) => void;
  applyPreset: (r: Exclude<RoleId, "custom">) => void;
  toggle: (p: Permission, on: boolean) => void;
  toggleGroup: (groupId: string, on: boolean) => void;
  setResult: (r: EditorState["result"]) => void;
};

const toMap = (list: readonly string[]): Perms => Object.fromEntries(list.map((p) => [p, true]));
const list = (m: Perms) => Object.keys(m).filter((k) => m[k]) as Permission[];
const withRole = (perms: Perms) => ({ perms, role: detectRole(list(perms)) });

export const useTeamEditor = create<EditorState>()((set) => ({
  open: false, mode: "add", step: 0, name: "", email: "", color: "purple", perms: {}, original: {}, role: "custom", result: null,
  openAdd: () => {
    const preset = ROLE_PRESETS.find((r) => r.id === "support")!;
    set({ open: true, mode: "add", step: 0, id: undefined, name: "", email: "", color: "orange", perms: toMap(preset.perms), original: {}, role: "support", result: null });
  },
  openEdit: (m) => set({ open: true, mode: "edit", step: 1, id: m.id, name: m.name, email: m.email, color: m.color, perms: toMap(m.permissions), original: toMap(m.permissions), role: detectRole(m.permissions as Permission[]), result: null }),
  close: () => set({ open: false }),
  setStep: (step) => set({ step }),
  set: (patch) => set(patch),
  applyPreset: (r) => set({ perms: toMap(ROLE_PRESETS.find((x) => x.id === r)!.perms), role: r }),
  // Dependencies: turning an action on also turns on its view; turning a view off turns its actions off.
  toggle: (p, on) =>
    set((s) => {
      const next = { ...s.perms, [p]: on };
      const view = requiresView(p);
      if (on && view) next[view] = true;
      if (!on && !view) {
        const g = PERMISSION_GROUPS.find((x) => x.items[0].key === p);
        g?.items.forEach((i) => (next[i.key] = false));
      }
      return withRole(next);
    }),
  toggleGroup: (groupId, on) =>
    set((s) => {
      const g = PERMISSION_GROUPS.find((x) => x.id === groupId)!;
      const next = { ...s.perms };
      g.items.forEach((i) => (next[i.key] = on));
      return withRole(next);
    }),
  setResult: (result) => set({ result }),
}));

export const permList = list;
