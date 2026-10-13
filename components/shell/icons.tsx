import type { SVGProps } from "react";

// Small stroke icon set (inline, no icon library).
const P = {
  overview: "M3 13h7V3H3zM14 21h7V11h-7zM3 21h7v-5H3zM14 7h7V3h-7z",
  customers: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  find: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3M8 11h6M11 8v6",
  tx: "M7 7h13l-4-4M17 17H4l4 4",
  trail: "M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3",
  inventory: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  kyc: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
  audit: "M9 3h6l1 2h3v16H5V5h3zM9 11h6M9 15h4",
  markup: "M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3",
  menu: "M4 7h16M4 12h16M4 17h16",
  collapse: "M15 6l-6 6 6 6",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8",
  system: "M3 4h18v12H3zM8 20h8M12 16v4",
  logout: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3",
  arrow: "M5 12h14M13 6l6 6-6 6",
  coins: "M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12M16 22a6 6 0 1 0 0-12M18.1 9.4A6 6 0 0 1 14 22M7 6h1v4",
  legs: "M4 6h6v4H4zM14 14h6v4h-6zM10 8h2a2 2 0 0 1 2 2v6",
  close: "M6 6l12 12M18 6 6 18",
  zoom: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3M8 11h6M11 8v6",
  chevronL: "M15 6l-6 6 6 6",
  chevronR: "M9 6l6 6-6 6",
  compare: "M3 4h8v16H3zM13 4h8v16h-8z",
  support: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5",
  ticket: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zM13 5v2M13 17v2M13 11v2",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  team: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  key: "M15 7a4 4 0 1 1-3.9 4.9L3 20v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7M16 10h.01",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  check: "M20 6 9 17l-5-5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
