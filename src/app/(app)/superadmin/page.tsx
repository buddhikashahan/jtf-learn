import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/auth-guard";
import { SuperAdminView } from "@/components/superadmin/superadmin-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Super Admin" };

export default function SuperAdminPage() {
  return (
    <RoleGate roles={["superadmin"]}>
      <SuperAdminView />
    </RoleGate>
  );
}
