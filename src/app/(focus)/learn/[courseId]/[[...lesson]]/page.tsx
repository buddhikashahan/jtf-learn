import type { Metadata } from "next";
import { LessonPlayer } from "@/components/learn/lesson-player";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Learn" };

export default function LearnPage({ params }: PageProps<"/learn/[courseId]/[[...lesson]]">) {
  return <LessonPlayer routeParams={params} />;
}
