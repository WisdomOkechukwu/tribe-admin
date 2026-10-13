import type { IconName } from "./icons";

export const NAV: { href: string; label: string; icon: IconName; perm: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "Overview", icon: "overview", perm: "overview.view", match: (p) => p === "/" },
  { href: "/customers", label: "Customers", icon: "customers", perm: "customers.view", match: (p) => p.startsWith("/customers") },
  { href: "/transactions", label: "Transactions", icon: "tx", perm: "transactions.view", match: (p) => p.startsWith("/transactions") },
  { href: "/support", label: "Support", icon: "support", perm: "support.view", match: (p) => p.startsWith("/support") },
  { href: "/currencies", label: "Currencies", icon: "coins", perm: "currencies.view", match: (p) => p.startsWith("/currencies") },
  { href: "/api-trail", label: "API trail", icon: "trail", perm: "api.view", match: (p) => p.startsWith("/api-trail") },
  { href: "/inventory", label: "Inventory", icon: "inventory", perm: "inventory.view", match: (p) => p.startsWith("/inventory") },
  { href: "/verifications", label: "Verifications", icon: "kyc", perm: "kyc.view", match: (p) => p.startsWith("/verifications") },
  { href: "/audit", label: "Audit log", icon: "audit", perm: "audit.view", match: (p) => p.startsWith("/audit") },
  { href: "/team", label: "Team & access", icon: "team", perm: "team.view", match: (p) => p.startsWith("/team") },
];
