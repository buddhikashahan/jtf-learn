import type { Metadata } from "next";
import { Classroom } from "@/components/live/classroom";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Live classroom" };

export default function ClassroomPage({ params }: PageProps<"/live/[courseId]/[sessionId]">) {
  return <Classroom params={params} />;
}
