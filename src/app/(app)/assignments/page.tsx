import type { Metadata } from "next";
import { AssignmentsView } from "@/components/assignments/assignments-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return <AssignmentsView />;
}
