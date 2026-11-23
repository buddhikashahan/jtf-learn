"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** True once React has hydrated on the client (false during SSR/prerender). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
