"use client";

import { useEffect } from "react";
import { useKycQueue } from "@/stores/kyc-store";

export function KycPendingSyncClient({ pending }: { pending: number }) {
  useEffect(() => {
    useKycQueue.getState().setPending(pending);
  }, [pending]);
  return null;
}
