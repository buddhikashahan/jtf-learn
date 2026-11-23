import { deleteOnServer } from "./server-api";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { Assignment, Course, Enrollment, Submission, UserProfile, WithId } from "@/types";
import type { AssignmentInput, GradeInput } from "@/lib/validation";
import { completionState, isPassed, passMarkOf } from "@/lib/coursework";
import { formatDateTime } from "@/lib/utils";
import { refs } from "./refs";
import { logActivity } from "./activity";
import { logAudit } from "./audit";
import { buildPath, deleteFile, uploadFile } from "./storage";
import { notify, notifyCourseStudents } from "./notifications";

interface CourseRef {
  id: string;
  title: string;
}

function assignmentFields(input: AssignmentInput) {
  return {
    title: input.title,
    description: input.description,
    dueAt: Timestamp.fromDate(new Date(input.dueAt)),
    points: input.points,
    moduleId: input.moduleId || null,
    required: input.required,
    passMark: Math.min(input.passMark, input.points),
  };
}

/** Keep the course's list of required coursework in sync (used by the security rules). */
async function syncRequired(courseId: string, assignmentId: string, required: boolean) {
  await updateDoc(refs.course(courseId), {
    requiredCourseworkIds: required ? arrayUnion(assignmentId) : arrayRemove(assignmentId),
    updatedAt: serverTimestamp(),
  });
}

export async function createAssignment(input: AssignmentInput, course: CourseRef, actor: UserProfile) {
  const ref = await addDoc(refs.assignments(course.id), {
    courseId: course.id,
    courseTitle: course.title,
    ...assignmentFields(input),
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (input.required) await syncRequired(course.id, ref.id, true);

  const kind = input.moduleId ? "coursework" : "assignment";
  await logActivity(course, actor, "assignment_created", `posted new ${kind}: ${input.title}`);
  await logAudit(
    "assignment.created",
    { type: "assignment", id: ref.id, label: input.title, courseId: course.id },
    `Created ${input.required ? "required " : ""}${kind} “${input.title}” in ${course.title}`,
  );
  await notifyCourseStudents(
    course.id,
    {
      type: "assignment_created",
      title: `New ${kind}: ${input.title}`,
      body: `${course.title} · Due ${formatDateTime(new Date(input.dueAt))} · ${input.points} pts${
        input.required ? " · Required to complete the course" : ""
      }`,
      link: "/assignments",
      courseId: course.id,
    },
    actor,
  );
  return ref.id;
}

export async function updateAssignment(assignment: WithId<Assignment>, input: AssignmentInput) {
  await updateDoc(refs.assignment(assignment.courseId, assignment.id), {
    ...assignmentFields(input),
    updatedAt: serverTimestamp(),
  });
  if (Boolean(assignment.required) !== input.required) {
    await syncRequired(assignment.courseId, assignment.id, input.required);
  }
  await logAudit(
    "assignment.updated",
    { type: "assignment", id: assignment.id, label: input.title, courseId: assignment.courseId },
    `Updated “${input.title}” in ${assignment.courseTitle}`,
  );
}

/** Delete coursework with all submissions and their files. */
export async function deleteAssignment(assignment: WithId<Assignment>) {
  await deleteOnServer("assignment", assignment.courseId, assignment.id);
}

export async function submitAssignment(params: {
  assignment: WithId<Assignment>;
  instructorIds?: string[];
  profile: UserProfile;
  file: File;
  note: string;
  existing: Submission | null;
  onProgress?: (p: number) => void;
}) {
  const { assignment, profile, file, note, existing, onProgress, instructorIds = [] } = params;
  // Graded work can only be resubmitted when it did not reach the pass mark.
  if (existing?.status === "graded" && isPassed(assignment, existing)) {
    throw new Error("This work has already been graded.");
  }

  const dir = `submissions/${assignment.courseId}/${assignment.id}/${profile.uid}`;
  const upload = await uploadFile(buildPath(dir, file), file, onProgress);
  const ref = refs.submission(assignment.courseId, assignment.id, profile.uid);
  const trimmedNote = note.trim() || null;

  if (existing) {
    await updateDoc(ref, {
      fileName: upload.name,
      filePath: upload.path,
      fileUrl: upload.url,
      fileSize: upload.size,
      note: trimmedNote,
      submittedAt: serverTimestamp(),
      // Reset any previous (failing) grade so it can be marked again.
      status: "submitted",
      grade: null,
      feedback: null,
      gradedAt: null,
      gradedBy: null,
      gradedByName: null,
    });
    await deleteFile(existing.filePath);
  } else {
    await setDoc(ref, {
      userId: profile.uid,
      userName: profile.displayName,
      courseId: assignment.courseId,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      fileName: upload.name,
      filePath: upload.path,
      fileUrl: upload.url,
      fileSize: upload.size,
      note: trimmedNote,
      status: "submitted",
      grade: null,
      feedback: null,
      submittedAt: serverTimestamp(),
      gradedAt: null,
      gradedBy: null,
      gradedByName: null,
    });
  }

  await logActivity(
    { id: assignment.courseId, title: assignment.courseTitle },
    profile,
    "submitted",
    `${existing ? "resubmitted" : "submitted"} ${assignment.title}`,
  );
  await notify(
    instructorIds,
    {
      type: "submission_received",
      title: `${profile.displayName} ${existing ? "resubmitted" : "submitted"} “${assignment.title}”`,
      body: assignment.courseTitle,
      link: `/assignments/${assignment.courseId}/${assignment.id}`,
      courseId: assignment.courseId,
    },
    profile,
  );
}

/**
 * After grading required coursework, record the pass on the learner's
 * enrolment (only graders can write `passedCourseworkIds`) and complete the
 * course when everything else is done.
 */
async function syncEnrollmentAfterGrade(assignment: WithId<Assignment>, studentId: string, passed: boolean, grader: UserProfile) {
  const enrollmentRef = refs.enrollment(assignment.courseId, studentId);
  const [enrollmentSnap, courseSnap, lessonsSnap] = await Promise.all([
    getDoc(enrollmentRef),
    getDoc(refs.course(assignment.courseId)),
    getDocs(refs.lessons(assignment.courseId)),
  ]);
  if (!enrollmentSnap.exists() || !courseSnap.exists()) return;
  const enrollment = enrollmentSnap.data() as Enrollment;
  const course = courseSnap.data() as Course;

  const passedIds = new Set(enrollment.passedCourseworkIds ?? []);
  if (passed) passedIds.add(assignment.id);
  else passedIds.delete(assignment.id);

  const state = completionState(
    course,
    { completedLessonIds: enrollment.completedLessonIds, passedCourseworkIds: [...passedIds] },
    lessonsSnap.docs.map((d) => d.id),
  );
  const wasComplete = enrollment.status === "completed";

  await updateDoc(enrollmentRef, {
    passedCourseworkIds: [...passedIds],
    progress: state.progress,
    status: state.complete ? "completed" : "active",
    completedAt: state.complete ? (enrollment.completedAt ?? serverTimestamp()) : null,
    updatedAt: serverTimestamp(),
  });

  if (state.complete && !wasComplete) {
    await notify(
      [studentId],
      {
        type: "course_completed",
        title: `Congratulations! You completed ${course.title}`,
        body: "Your certificate of completion is ready.",
        link: `/certificates/${assignment.courseId}`,
        courseId: assignment.courseId,
      },
      grader,
    );
  }
}

export async function gradeSubmission(
  assignment: WithId<Assignment>,
  student: { id: string; name: string },
  input: GradeInput,
  grader: UserProfile,
) {
  await updateDoc(refs.submission(assignment.courseId, assignment.id, student.id), {
    grade: input.grade,
    feedback: input.feedback || null,
    status: "graded",
    gradedAt: serverTimestamp(),
    gradedBy: grader.uid,
    gradedByName: grader.displayName,
  });

  const passed = input.grade >= passMarkOf(assignment);
  if (assignment.required) await syncEnrollmentAfterGrade(assignment, student.id, passed, grader);

  await logActivity(
    { id: assignment.courseId, title: assignment.courseTitle },
    grader,
    "graded",
    `graded a submission for ${assignment.title}`,
  );
  await logAudit(
    "submission.graded",
    { type: "submission", id: student.id, label: `${student.name} — ${assignment.title}`, courseId: assignment.courseId },
    `Graded ${student.name}'s “${assignment.title}”: ${input.grade}/${assignment.points}${
      passMarkOf(assignment) > 0 ? (passed ? " (pass)" : " (below pass mark)") : ""
    }`,
  );

  const needsResubmit = passMarkOf(assignment) > 0 && !passed;
  await notify(
    [student.id],
    {
      type: "assignment_graded",
      title: `Your “${assignment.title}” has been graded`,
      body: needsResubmit
        ? `You scored ${input.grade}/${assignment.points} — the pass mark is ${passMarkOf(assignment)}. Review the feedback and resubmit.`
        : `You scored ${input.grade}/${assignment.points}${input.feedback ? " — tap to read the feedback" : ""}.`,
      link: needsResubmit ? "/assignments" : "/assignments?tab=graded",
      courseId: assignment.courseId,
    },
    grader,
  );
}
