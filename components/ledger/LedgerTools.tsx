"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { verifyLedger } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

/** Runs the same checks as `ledger:verify` on the API and shows the result. */
export function VerifyLedgerButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; problems?: string[] } | null>(null);
  const run = () =>
    start(async () => {
      const r = await verifyLedger();
      if (!r.ok && !r.problems) return void toast.error(r.message);
      setResult(r);
      (r.ok ? toast.success : toast.error)(r.ok ? "Ledger verified" : r.message);
    });
  return (
    <>
      <Button variant="primary" onClick={run} disabled={pending}>
        <Icon name="check" size={15} /> {pending ? "Verifying…" : "Verify ledger"}
      </Button>
      <Modal open={!!result} onClose={() => setResult(null)} title={result?.ok ? "Ledger balances" : "Ledger problems"} footer={<><span /><Button variant="primary" onClick={() => setResult(null)}>Done</Button></>}>
        {result && (
          <div className="space-y-3 p-6 text-[13px]">
            <p className={result.ok ? "font-semibold text-success-700 dark:text-success-300" : "font-semibold text-error-600"}>{result.message}</p>
            {result.problems && result.problems.length > 0 && (
              <ul className="max-h-72 space-y-1.5 overflow-auto rounded-chip border-2 border-line bg-sunken p-3 font-mono text-[12px]">
                {result.problems.map((p, i) => <li key={i} className="break-words">{p}</li>)}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
