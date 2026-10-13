"use client";

import { Button } from "@/components/ui/Button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="display text-[36px] font-bold uppercase">Something broke</h1>
      <p className="mt-2 text-muted">This section failed to load. Your other tabs are unaffected.</p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-muted">Ref {error.digest}</p>}
      <Button variant="primary" className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
