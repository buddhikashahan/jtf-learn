"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { refs } from "@/lib/services/refs";
import { useDocument } from "./use-firestore";
import type { PlatformSettings } from "@/types";

/** Platform-wide switches managed by the super admin (settings/platform). */
export function usePlatformSettings() {
  const { user } = useAuth();
  const ref = useMemo(() => (user ? refs.platformSettings() : null), [user]);
  const { data, loading } = useDocument<PlatformSettings>(ref);
  return {
    loading,
    // The assistant is on unless the super admin has switched it off.
    aiAssistantEnabled: data?.aiAssistantEnabled ?? true,
  };
}
