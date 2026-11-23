import type { Metadata } from "next";
import { LiveView } from "@/components/live/live-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Live classes" };

export default function LivePage() {
  return <LiveView />;
}
