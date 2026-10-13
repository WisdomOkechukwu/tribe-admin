"use client";

import { useEffect } from "react";
import { usePalette } from "@/stores/palette-store";
import { useUi } from "@/stores/ui-store";

/** Rehydrate persisted zustand stores after mount (skipHydration avoids SSR mismatches). */
export function StoreHydrator() {
  useEffect(() => {
    void useUi.persist.rehydrate();
    void usePalette.persist.rehydrate();
  }, []);
  return null;
}
