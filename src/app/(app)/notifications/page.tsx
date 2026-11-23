import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications/notifications-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsView />;
}
