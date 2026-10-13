import type { Metadata } from "next";
import { Bricolage_Grotesque, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: { default: "Tribe Admin", template: "%s · Tribe Admin" },
  description: "Internal operations console for Tribe.",
  robots: { index: false, follow: false },
};

// Runs before first paint so the stored theme never flashes (see Next's
// "Preventing flash before hydration" guide). Keep in sync with stores/ui-store.ts.
const themeScript = `try{var s=JSON.parse(localStorage.getItem("tribe-admin-ui")||"{}").state||{};var t=s.theme||"system";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;if(s.collapsed)document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} ${bricolage.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
