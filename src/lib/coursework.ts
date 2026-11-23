import type { Assignment, Course, Enrollment, Submission } from "@/types";

/**
 * Coursework rules shared by the UI and the services.
 *
 * An assignment linked to a module is that module's coursework. When it is
 * marked `required`, the learner must be graded at or above its pass mark
 * before the course can be completed (also enforced by firestore.rules via
 * `course.requiredCourseworkIds` / `enrollment.passedCourseworkIds`).
 */

export type CourseworkState = "todo" | "overdue" | "submitted" | "passed" | "failed";

export function passMarkOf(assignment: Pick<Assignment, "passMark">): number {
  return assignment.passMark ?? 0;
}

export function isPassed(
  assignment: Pick<Assignment, "passMark">,
  submission: Pick<Submission, "status" | "grade"> | null | undefined,
): boolean {
  return submission?.status === "graded" && (submission.grade ?? 0) >= passMarkOf(assignment);
}

export function courseworkState(
  assignment: Pick<Assignment, "passMark" | "dueAt">,
  submission: Pick<Submission, "status" | "grade"> | null | undefined,
  now: number,
): CourseworkState {
  if (submission?.status === "graded") return isPassed(assignment, submission) ? "passed" : "failed";
  if (submission) return "submitted";
  const due = assignment.dueAt?.toDate?.().getTime() ?? Infinity;
  return due < now ? "overdue" : "todo";
}

export interface CompletionState {
  lessonsDone: number;
  lessonsTotal: number;
  courseworkPassed: number;
  courseworkRequired: number;
  /** 0–100; only reaches 100 when everything is complete. */
  progress: number;
  complete: boolean;
  /** All lessons finished but required coursework is still outstanding. */
  awaitingCoursework: boolean;
}

/** Overall course progress from completed lessons + passed required coursework. */
export function completionState(
  course: Pick<Course, "requiredCourseworkIds">,
  enrollment: Pick<Enrollment, "completedLessonIds" | "passedCourseworkIds">,
  allLessonIds: string[],
): CompletionState {
  const valid = new Set(allLessonIds);
  const lessonsDone = enrollment.completedLessonIds.filter((id) => valid.has(id)).length;
  const lessonsTotal = allLessonIds.length;
  const required = course.requiredCourseworkIds ?? [];
  const passed = new Set(enrollment.passedCourseworkIds ?? []);
  const courseworkPassed = required.filter((id) => passed.has(id)).length;
  const courseworkRequired = required.length;

  const total = lessonsTotal + courseworkRequired;
  const lessonsComplete = lessonsTotal > 0 && lessonsDone >= lessonsTotal;
  const complete = lessonsComplete && courseworkPassed >= courseworkRequired;
  const progress = complete ? 100 : total === 0 ? 0 : Math.min(99, Math.floor(((lessonsDone + courseworkPassed) / total) * 100));
  return {
    lessonsDone,
    lessonsTotal,
    courseworkPassed,
    courseworkRequired,
    progress,
    complete,
    awaitingCoursework: lessonsComplete && !complete,
  };
}
