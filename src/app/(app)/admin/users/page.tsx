import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/auth-guard";
import { UsersView } from "@/components/admin/users-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <RoleGate roles={["superadmin", "admin"]}>
      <UsersView />
    </RoleGate>
  );
}
