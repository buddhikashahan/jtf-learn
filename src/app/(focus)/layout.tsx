import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { FullPageLoader } from "@/components/ui/feedback";

// Auth-gated, client-rendered (Firebase) routes: data loads after hydration, so
// navigations intentionally show a loading state instead of a prerendered shell.
export const instant = false;

// Private, signed-in areas are never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Distraction-free layout (no sidebar) for the lesson player & certificates. */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
