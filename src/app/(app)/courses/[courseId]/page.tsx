import type { Metadata } from "next";
import { CourseDetail } from "@/components/courses/course-detail";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Course" };

export default function CoursePage({ params }: PageProps<"/courses/[courseId]">) {
  return <CourseDetail params={params} />;
}
