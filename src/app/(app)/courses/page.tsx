import type { Metadata } from "next";
import { CoursesView } from "@/components/courses/courses-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return <CoursesView />;
}
