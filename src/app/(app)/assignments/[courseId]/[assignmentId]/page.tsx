import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/auth-guard";
import { GradingView } from "@/components/assignments/grading-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Review submissions" };

export default function GradingPage({ params }: PageProps<"/assignments/[courseId]/[assignmentId]">) {
  return (
    <RoleGate roles={["superadmin", "admin", "instructor"]}>
      <GradingView params={params} />
    </RoleGate>
  );
}
