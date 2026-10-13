"use client";

import { useEffect } from "react";
import { useAccessStore } from "@/stores/access-store";

export function AccessSyncClient({ perms }: { perms: string[] }) {
  useEffect(() => {
    useAccessStore.getState().set(perms);
  }, [perms]);
  return null;
}
