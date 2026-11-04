"use client";

import { useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { retryJob, runDailySnapshot } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

export function RunSnapshotButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runDailySnapshot();
          (r.ok ? toast.success : toast.error)(r.message);
        })
      }
    >
      <Icon name="refresh" size={15} /> {pending ? "Running snapshot…" : "Run daily snapshot"}
    </Button>
  );
}

export function RetryButton({ queue, id }: { queue: string; id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retryJob(queue, id);
          (r.ok ? toast.success : toast.error)(r.message);
        })
      }
    >
      {pending ? "Retrying…" : "Retry"}
    </Button>
  );
}
