import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r-2 border-edge bg-purple-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="stripes absolute -top-8 -right-28 h-64 w-[62%] [--stripe-w:40px]" aria-hidden />
        <span className="absolute top-52 right-16 -rotate-6 rounded-full border-2 border-ink-900 bg-warning-300 px-3 py-1 text-[12px] font-extrabold uppercase text-ink-900 shadow-hard-sm">staff only</span>
        <div className="relative flex items-center gap-3">
          <Image src="/brand/tribe-icon.png" alt="" width={40} height={40} className="rounded-chip" priority />
          <span className="display text-[26px] font-bold uppercase">Tribe</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="display text-[72px] leading-[0.9] font-extrabold uppercase">Admin<br />console</h1>
          <p className="mt-3 text-[15px] text-purple-100">Customers, transactions and their legs, inventory, markups and the API trail, all in one place.</p>
        </div>
        <p className="relative text-[12px] text-purple-200">Authorised staff only. Every action is logged.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/brand/tribe-icon.png" alt="" width={36} height={36} className="rounded-chip" />
            <span className="display text-[24px] font-bold uppercase">Tribe admin</span>
          </div>
          <h2 className="display text-[44px] font-extrabold uppercase">Sign in</h2>
          <p className="mt-1 mb-6 text-[13px] text-muted">Use your Tribe staff account.</p>
          <Suspense fallback={<LoginForm />}>
            <LoginWithNext searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function LoginWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const reason = sp.reason === "suspended" ? "Your access was suspended by a team manager." : sp.reason === "removed" ? "Your account was removed from the team." : null;
  return (
    <>
      {reason && <p role="status" className="mb-4 rounded-chip border-2 border-edge bg-warning-300 px-3 py-2 text-[12.5px] font-semibold text-ink-900">{reason}</p>}
      <LoginForm next={next} />
    </>
  );
}
