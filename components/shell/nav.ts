import type { IconName } from "./icons";

export const NAV: { href: string; label: string; icon: IconName; perm: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "Overview", icon: "overview", perm: "overview.view", match: (p) => p === "/" },
  { href: "/customers", label: "Customers", icon: "customers", perm: "customers.view", match: (p) => p.startsWith("/customers") },
  { href: "/transactions", label: "Transactions", icon: "tx", perm: "transactions.view", match: (p) => p.startsWith("/transactions") },
  { href: "/support", label: "Support", icon: "support", perm: "support.view", match: (p) => p.startsWith("/support") },
  { href: "/currencies", label: "Currencies", icon: "coins", perm: "currencies.view", match: (p) => p.startsWith("/currencies") },
  { href: "/rates", label: "Rates & pricing", icon: "rates", perm: "currencies.view", match: (p) => p.startsWith("/rates") },
  { href: "/api-trail", label: "API trail", icon: "trail", perm: "api.view", match: (p) => p.startsWith("/api-trail") },
  { href: "/inventory", label: "Inventory", icon: "inventory", perm: "inventory.view", match: (p) => p.startsWith("/inventory") },
  { href: "/ledger", label: "Ledger", icon: "ledger", perm: "ledger.view", match: (p) => p.startsWith("/ledger") },
  { href: "/providers", label: "Providers", icon: "providers", perm: "providers.view", match: (p) => p.startsWith("/providers") },
  { href: "/card-designs", label: "Card designs", icon: "card", perm: "card_designs.manage", match: (p) => p.startsWith("/card-designs") },
  { href: "/verifications", label: "Verifications", icon: "kyc", perm: "kyc.view", match: (p) => p.startsWith("/verifications") },
  { href: "/audit", label: "Audit log", icon: "audit", perm: "audit.view", match: (p) => p.startsWith("/audit") },
  { href: "/jobs", label: "Jobs", icon: "jobs", perm: "jobs.view", match: (p) => p.startsWith("/jobs") },
  { href: "/team", label: "Team & access", icon: "team", perm: "team.view", match: (p) => p.startsWith("/team") },
];
