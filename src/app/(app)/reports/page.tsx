import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/auth-guard";
import { ReportsView } from "@/components/reports/reports-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <RoleGate roles={["superadmin", "admin", "instructor"]}>
      <ReportsView />
    </RoleGate>
  );
}
