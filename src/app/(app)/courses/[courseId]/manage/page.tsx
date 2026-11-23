import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/auth-guard";
import { CourseManager } from "@/components/courses/manage/course-manager";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Manage course" };

export default function ManageCoursePage({ params }: PageProps<"/courses/[courseId]/manage">) {
  return (
    <RoleGate roles={["superadmin", "admin", "instructor"]}>
      <CourseManager routeParams={params} />
    </RoleGate>
  );
}
