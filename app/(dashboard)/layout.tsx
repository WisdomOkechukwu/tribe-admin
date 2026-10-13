import { Suspense, type ReactNode } from "react";
import { AccessSync } from "@/components/access/AccessSyncServer";
import { MarkupHost } from "@/components/markups/MarkupHost";
import { AdminMenu, AdminMenuSkeleton } from "@/components/shell/AdminMenu";
import { CommandPalette, PaletteButton } from "@/components/shell/CommandPalette";
import { MobileMenuButton, Sidebar } from "@/components/shell/Sidebar";
import { NavProgress } from "@/components/shell/NavProgress";
import { StoreHydrator } from "@/components/shell/StoreHydrator";
import { SoundToggle, SupportListener } from "@/components/shell/SupportListener";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { MarkupsButton } from "@/components/markups/MarkupModal";
import { TxDrawer } from "@/components/transactions/TxDrawer";

// Static chrome prerenders into the shell; only the admin badge and the markup
// rules stream in behind their own boundaries.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <NavProgress />
      <StoreHydrator />
      <SupportListener />
      <Sidebar />
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b-2 border-edge bg-bg px-4 sm:px-6 lg:px-10">
          <MobileMenuButton />
          <div className="min-w-0 flex-1">
            <PaletteButton />
          </div>
          <div className="hidden sm:block">
            <MarkupsButton size="sm" />
          </div>
          <SoundToggle />
          <ThemeToggle />
          <Suspense fallback={<AdminMenuSkeleton />}>
            <AdminMenu />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 pb-16 sm:px-6 lg:px-10">{children}</main>
      <TxDrawer />
      </div>
      <CommandPalette />
      <Suspense fallback={null}>
        <MarkupHost />
      </Suspense>
      <Suspense fallback={null}>
        <AccessSync />
      </Suspense>
    </div>
  );
}

