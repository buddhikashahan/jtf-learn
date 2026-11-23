import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { FullPageLoader } from "@/components/ui/feedback";

// Auth-gated, client-rendered (Firebase) routes: data loads after hydration, so
// navigations intentionally show a loading state instead of a prerendered shell.
export const instant = false;

// Private, signed-in areas are never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading your workspace" />}>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </Suspense>
  );
}
