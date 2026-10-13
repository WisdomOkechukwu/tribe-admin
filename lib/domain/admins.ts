import type { AvatarColor, RoleId } from "./permissions";

// Seed directory of staff accounts (no secrets). The live, editable team lives
// in lib/auth/users.ts; this list only seeds it and names historic audit rows.
export type AdminProfile = { id: string; name: string; email: string; role: RoleId };

export const ADMINS: (AdminProfile & { color: AvatarColor; status?: "active" | "suspended" })[] = [
  { id: "adm_super", name: "Chidinma Obi", email: "super@tribe.africa", role: "super_admin", color: "purple" },
  { id: "adm_ops", name: "Tunde Bakare", email: "ops@tribe.africa", role: "ops", color: "orange" },
  { id: "adm_support", name: "Zainab Musa", email: "support@tribe.africa", role: "support", color: "blue" },
  { id: "adm_compliance", name: "Ifeoma Nwankwo", email: "compliance@tribe.africa", role: "compliance", color: "success" },
  { id: "adm_finance", name: "Daniel Mensah", email: "finance@tribe.africa", role: "finance", color: "warning" },
  { id: "adm_viewer", name: "Kola Adebayo", email: "viewer@tribe.africa", role: "viewer", color: "ink", status: "suspended" },
];
