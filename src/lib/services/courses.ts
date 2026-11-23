import { deleteOnServer } from "./server-api";
import {
  addDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { Course, CourseStatus, Lesson, UserProfile, WithId } from "@/types";
import type { CourseInput } from "@/lib/validation";
import { refs } from "./refs";
import { logAudit } from "./audit";
import { logActivity } from "./activity";
import { buildPath, deleteUploadedUrl, uploadFile } from "./storage";

function courseFields(input: CourseInput) {
  return {
    title: input.title,
    code: input.code.toUpperCase(),
    description: input.description,
    category: input.category,
    level: input.level,
    status: input.status,
    cohort: input.cohort || null,
    startDate: input.startDate ? Timestamp.fromDate(new Date(input.startDate)) : null,
    allowSelfEnroll: input.allowSelfEnroll,
    requiredWatchPercent: input.requiredWatchPercent,
    sequential: input.sequential,
  };
}

export async function createCourse(input: CourseInput, actor: UserProfile): Promise<string> {
  const ref = await addDoc(refs.courses(), {
    ...courseFields(input),
    coverImageUrl: null,
    instructorIds: [actor.uid],
    instructorNames: [actor.displayName],
    moduleCount: 0,
    lessonCount: 0,
    totalMinutes: 0,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit("course.created", { type: "course", id: ref.id, label: input.title }, `Created course “${input.title}”`);
  return ref.id;
}

export async function updateCourse(course: WithId<Course>, input: CourseInput, actor: UserProfile) {
  await updateDoc(refs.course(course.id), { ...courseFields(input), updatedAt: serverTimestamp() });
  if (course.status !== "published" && input.status === "published") {
    await logActivity(course, actor, "course_published", `published ${input.title}`);
  }
  const statusNote = course.status !== input.status ? ` (status ${course.status} → ${input.status})` : "";
  await logAudit("course.updated", { type: "course", id: course.id, label: input.title }, `Updated course “${input.title}”${statusNote}`);
}

export async function setCourseStatus(courseId: string, status: CourseStatus) {
  await updateDoc(refs.course(courseId), { status, updatedAt: serverTimestamp() });
  await logAudit("course.status_changed", { type: "course", id: courseId }, `Set course status to ${status}`);
}

export async function setCourseInstructors(courseId: string, instructors: { uid: string; displayName: string }[]) {
  await updateDoc(refs.course(courseId), {
    instructorIds: instructors.map((i) => i.uid),
    instructorNames: instructors.map((i) => i.displayName),
    updatedAt: serverTimestamp(),
  });
  await logAudit(
    "course.instructors_changed",
    { type: "course", id: courseId },
    `Set instructors: ${instructors.map((i) => i.displayName).join(", ") || "none"}`,
  );
}

export async function uploadCourseCover(courseId: string, file: File, onProgress?: (p: number) => void, previousUrl?: string | null) {
  const result = await uploadFile(buildPath(`courses/${courseId}/cover`, file), file, onProgress);
  await updateDoc(refs.course(courseId), { coverImageUrl: result.url, updatedAt: serverTimestamp() });
  // The old cover file is no longer referenced.
  await deleteUploadedUrl(previousUrl, `courses/${courseId}/cover`);
  await logAudit("course.cover_updated", { type: "course", id: courseId }, "Uploaded a new cover image");
  return result.url;
}

/** Recompute denormalised counters after curriculum edits. */
export async function refreshCourseStats(courseId: string) {
  const [modules, lessons] = await Promise.all([getDocs(refs.modules(courseId)), getDocs(refs.lessons(courseId))]);
  const totalMinutes = lessons.docs.reduce((sum, d) => sum + ((d.data() as Lesson).durationMinutes || 0), 0);
  await updateDoc(refs.course(courseId), {
    moduleCount: modules.size,
    lessonCount: lessons.size,
    totalMinutes,
    updatedAt: serverTimestamp(),
  });
}

/** Admin-only: permanently delete a course and all its sub-collections. */
/** Admin: delete a course with all its content, enrolments, grades, recordings and files. */
export async function deleteCourse(courseId: string) {
  await deleteOnServer("course", courseId);
}
