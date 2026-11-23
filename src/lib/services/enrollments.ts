import { deleteOnServer } from "./server-api";
import { getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Course, Enrollment, UserProfile, WithId } from "@/types";
import { ValidationError } from "@/lib/errors";
import { refs } from "./refs";
import { logActivity } from "./activity";
import { findUserByEmail } from "./users";
import { notify } from "./notifications";
import { logAudit } from "./audit";
import { completionState } from "@/lib/coursework";

function newEnrollment(courseId: string, student: Pick<UserProfile, "uid" | "displayName" | "email">, by: string) {
  return {
    userId: student.uid,
    courseId,
    userName: student.displayName,
    userEmail: student.email,
    status: "active",
    progress: 0,
    completedLessonIds: [],
    passedCourseworkIds: [],
    lastLessonId: null,
    enrolledBy: by,
    enrolledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  };
}

export async function enrollSelf(course: WithId<Course>, profile: UserProfile) {
  await setDoc(refs.enrollment(course.id, profile.uid), newEnrollment(course.id, profile, profile.uid));
  await logActivity(course, profile, "enrolled", `enrolled in ${course.title}`);
}

export async function enrollUserByEmail(course: WithId<Course>, email: string, actor: UserProfile) {
  const student = await findUserByEmail(email);
  if (!student) throw new ValidationError("No account found with that email. Ask them to register first.");
  const existing = await getDoc(refs.enrollment(course.id, student.uid));
  if (existing.exists()) throw new ValidationError(`${student.displayName} is already enrolled.`);
  await setDoc(refs.enrollment(course.id, student.uid), newEnrollment(course.id, student, actor.uid));
  await logActivity(course, actor, "enrolled", `enrolled ${student.displayName} in ${course.title}`);
  await logAudit(
    "enrollment.created",
    { type: "enrollment", id: student.uid, label: student.displayName, courseId: course.id },
    `Enrolled ${student.displayName} in ${course.title}`,
  );
  await notify(
    [student.uid],
    {
      type: "enrolled",
      title: `You've been enrolled in ${course.title}`,
      body: "Start learning whenever you're ready.",
      link: `/courses/${course.id}`,
      courseId: course.id,
    },
    actor,
  );
  return student;
}

/** Remove a learner with their progress, notes, submissions and submission files. */
export async function removeEnrollment(course: { id: string }, student: { userId: string }) {
  await deleteOnServer("enrollment", course.id, student.userId);
}

/** Toggle a lesson's completion and recompute progress against the live syllabus. */
export async function setLessonCompleted(
  course: WithId<Course>,
  enrollment: Enrollment,
  lessonId: string,
  completed: boolean,
  allLessonIds: string[],
  actor: UserProfile,
) {
  // The stored list is only ever extended by one id (or shrunk) per write —
  // firestore.rules verifies the added lesson (e.g. that its video was watched).
  const stored = new Set(enrollment.completedLessonIds);
  const alreadyDone = stored.has(lessonId);
  if (completed === alreadyDone) return;
  if (completed) stored.add(lessonId);
  else stored.delete(lessonId);

  // A course is complete only when every lesson is done AND all required
  // coursework has been passed (see lib/coursework.ts).
  const state = completionState(
    course,
    { completedLessonIds: [...stored], passedCourseworkIds: enrollment.passedCourseworkIds },
    allLessonIds,
  );
  const progress = state.progress;
  const isComplete = state.complete;
  const wasComplete = enrollment.status === "completed";

  await updateDoc(refs.enrollment(course.id, enrollment.userId), {
    completedLessonIds: [...stored],
    ...(completed ? { lastCompletedLessonId: lessonId } : {}),
    progress,
    status: isComplete ? "completed" : "active",
    lastLessonId: lessonId,
    completedAt: isComplete ? (enrollment.completedAt ?? serverTimestamp()) : null,
    updatedAt: serverTimestamp(),
  });

  if (isComplete && !wasComplete) {
    await logActivity(course, actor, "course_completed", `completed ${course.title} 🎉`);
    await notify(
      [actor.uid],
      {
        type: "course_completed",
        title: `Congratulations! You completed ${course.title}`,
        body: "Your certificate of completion is ready.",
        link: `/certificates/${course.id}`,
        courseId: course.id,
      },
      actor,
      { includeSelf: true },
    );
  }
}

export async function setLastLesson(courseId: string, userId: string, lessonId: string) {
  await updateDoc(refs.enrollment(courseId, userId), { lastLessonId: lessonId, updatedAt: serverTimestamp() });
}
