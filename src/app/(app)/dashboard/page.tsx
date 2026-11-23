import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardView />;
}
