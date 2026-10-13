import type { IconName } from "@/components/shell/icons";

// ─────────────────────────────────────────────────────────────────────────────
// Every thing an admin can see or do in the console. Pages gate on the *.view
// key, data reads mask/strip on the "sensitive" keys, server actions require
// the "action" keys. Keep this list the single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export type Risk = "view" | "action" | "sensitive";
export type PermItem = { key: string; label: string; hint: string; risk: Risk };
export type PermGroup = { id: string; label: string; icon: IconName; route?: string; items: PermItem[] };

export const PERMISSION_GROUPS = [
  {
    id: "overview", label: "Overview", icon: "overview", route: "/",
    items: [{ key: "overview.view", label: "See the overview", hint: "KPIs, charts, liquidity alerts and recent failures", risk: "view" }],
  },
  {
    id: "customers", label: "Customers", icon: "customers", route: "/customers",
    items: [
      { key: "customers.view", label: "See customers", hint: "Customer list, find by email/tag and profiles", risk: "view" },
      { key: "customers.pii", label: "Unmasked personal data", hint: "Full email, phone, address and date of birth (masked otherwise)", risk: "sensitive" },
      { key: "customers.labels", label: "Edit labels", hint: "Add or remove internal labels like VIP or watchlist", risk: "action" },
      { key: "customers.freeze", label: "Freeze & unfreeze accounts", hint: "Stop a customer from moving money", risk: "action" },
    ],
  },
  {
    id: "kyc", label: "Verifications", icon: "kyc", route: "/verifications",
    items: [
      { key: "kyc.view", label: "See KYC checks", hint: "Review queue and each customer's verification tab", risk: "view" },
      { key: "kyc.media", label: "View KYC images", hint: "Selfies, liveness frames, ID documents, proof of address", risk: "sensitive" },
      { key: "kyc.decide", label: "Approve & reject checks", hint: "Decisions upgrade or block a customer's tier", risk: "action" },
    ],
  },
  {
    id: "transactions", label: "Transactions", icon: "tx", route: "/transactions",
    items: [{ key: "transactions.view", label: "See transactions & legs", hint: "Lists, quick view, legs, customer & system balances", risk: "view" }],
  },
  {
    id: "currencies", label: "Currencies", icon: "coins", route: "/currencies",
    items: [{ key: "currencies.view", label: "See currencies", hint: "Rates, holders, liquidity cover", risk: "view" }],
  },
  {
    id: "inventory", label: "Inventory", icon: "inventory", route: "/inventory",
    items: [
      { key: "inventory.view", label: "See inventory & ledger", hint: "Provider pools, balances and every movement", risk: "view" },
      { key: "inventory.topup", label: "Record top-ups", hint: "Add liquidity to a provider pool", risk: "action" },
    ],
  },
  {
    id: "markups", label: "Markups", icon: "markup",
    items: [
      { key: "markups.view", label: "See markups", hint: "Rate %, fee % and flat fee per transaction type", risk: "view" },
      { key: "markups.edit", label: "Change markups", hint: "Edit and activate/deactivate pricing: affects revenue", risk: "action" },
    ],
  },
  {
    id: "support", label: "Support", icon: "support", route: "/support",
    items: [
      { key: "support.view", label: "See the inbox", hint: "Tickets, in-app chats and live alerts", risk: "view" },
      { key: "support.reply", label: "Reply to customers", hint: "Send messages in tickets and chats", risk: "action" },
      { key: "support.resolve", label: "Resolve & reopen", hint: "Change conversation status", risk: "action" },
      { key: "support.simulate", label: "Use the simulator", hint: "Fire demo tickets and replies", risk: "action" },
    ],
  },
  {
    id: "api", label: "API trail", icon: "trail", route: "/api-trail",
    items: [
      { key: "api.view", label: "See the API trail", hint: "Request log: method, path, status, latency, device", risk: "view" },
      { key: "api.bodies", label: "See request & response bodies", hint: "Redacted payloads (still sensitive)", risk: "sensitive" },
    ],
  },
  {
    id: "audit", label: "Audit log", icon: "audit", route: "/audit",
    items: [{ key: "audit.view", label: "See the audit log", hint: "Every admin action with before/after", risk: "view" }],
  },
  {
    id: "team", label: "Team", icon: "team", route: "/team",
    items: [
      { key: "team.view", label: "See the team", hint: "Teammates, roles and who can do what", risk: "view" },
      { key: "team.manage", label: "Manage teammates", hint: "Add people, change permissions, suspend, reset passwords", risk: "action" },
    ],
  },
] as const satisfies readonly PermGroup[];

export type Permission = (typeof PERMISSION_GROUPS)[number]["items"][number]["key"];
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)) as Permission[];
export const isPermission = (k: string): k is Permission => (ALL_PERMISSIONS as string[]).includes(k);

/** Every non-view permission needs its section's view permission. */
export const requiresView = (p: Permission): Permission | null => {
  const g = PERMISSION_GROUPS.find((x) => x.items.some((i) => i.key === p))!;
  const view = g.items[0].key as Permission;
  return view === p ? null : view;
};

export const permMeta = (p: Permission) => {
  for (const g of PERMISSION_GROUPS) for (const i of g.items) if (i.key === p) return { group: g as PermGroup, item: i as PermItem };
  throw new Error(`Unknown permission ${p}`);
};

/** Normalise a set: drop unknowns, and drop actions whose view is missing. */
export function normalisePerms(list: readonly string[]): Permission[] {
  const set = new Set(list.filter(isPermission));
  for (const p of [...set]) {
    const v = requiresView(p);
    if (v && !set.has(v)) set.delete(p);
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

export type RoleId = "super_admin" | "ops" | "support" | "compliance" | "finance" | "viewer" | "custom";

export const ROLE_PRESETS: { id: Exclude<RoleId, "custom">; label: string; blurb: string; color: string; perms: Permission[] }[] = [
  { id: "super_admin", label: "Super admin", blurb: "Everything, including pricing and the team.", color: "var(--color-purple-500)", perms: ALL_PERMISSIONS },
  {
    id: "ops", label: "Operations", blurb: "Runs the money: inventory, accounts, KYC, support.", color: "var(--color-orange-500)",
    perms: normalisePerms(["overview.view", "customers.view", "customers.pii", "customers.labels", "customers.freeze", "kyc.view", "kyc.media", "kyc.decide", "transactions.view", "currencies.view", "inventory.view", "inventory.topup", "markups.view", "support.view", "support.reply", "support.resolve", "support.simulate", "api.view", "api.bodies", "audit.view", "team.view"]),
  },
  {
    id: "support", label: "Support", blurb: "Talks to customers, sees what they did, no money moves.", color: "var(--color-blue-500)",
    perms: normalisePerms(["overview.view", "customers.view", "customers.labels", "kyc.view", "transactions.view", "currencies.view", "support.view", "support.reply", "support.resolve", "support.simulate", "api.view"]),
  },
  {
    id: "compliance", label: "Compliance", blurb: "KYC decisions, freezes and the full audit trail.", color: "var(--color-success-600)",
    perms: normalisePerms(["overview.view", "customers.view", "customers.pii", "customers.labels", "customers.freeze", "kyc.view", "kyc.media", "kyc.decide", "transactions.view", "api.view", "api.bodies", "audit.view", "team.view"]),
  },
  {
    id: "finance", label: "Finance", blurb: "Revenue, liquidity and pricing visibility.", color: "var(--color-warning-500)",
    perms: normalisePerms(["overview.view", "transactions.view", "currencies.view", "inventory.view", "inventory.topup", "markups.view", "audit.view"]),
  },
  {
    id: "viewer", label: "Read-only", blurb: "Look, don't touch. No personal data.", color: "var(--color-ink-300)",
    perms: normalisePerms(["overview.view", "customers.view", "transactions.view", "currencies.view", "inventory.view", "markups.view", "support.view"]),
  },
];

export const roleLabel = (r: RoleId) => (r === "custom" ? "Custom" : ROLE_PRESETS.find((x) => x.id === r)?.label ?? r);

/** If a permission set exactly matches a preset, name it; else it's custom. */
export function detectRole(perms: readonly Permission[]): RoleId {
  const key = [...perms].sort().join(",");
  return ROLE_PRESETS.find((r) => [...r.perms].sort().join(",") === key)?.id ?? "custom";
}

export const AVATAR_COLORS = ["purple", "orange", "blue", "success", "warning", "ink"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];
