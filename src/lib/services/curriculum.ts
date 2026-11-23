import { deleteOnServer } from "./server-api";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { Lesson, LessonResource, Module, WithId } from "@/types";
import type { LessonInput } from "@/lib/validation";
import { refs } from "./refs";
import { refreshCourseStats } from "./courses";
import { logAudit } from "./audit";
import { buildPath, deleteFile, deleteUploadedUrl, uploadFile } from "./storage";

// ── Modules ──────────────────────────────────────────────────────────────────
export async function createModule(courseId: string, title: string, order: number) {
  void logAudit("module.created", { type: "module", id: title, label: title, courseId }, `Added module “${title}”`);
  await addDoc(refs.modules(courseId), { title, order, createdAt: serverTimestamp() });
  await refreshCourseStats(courseId);
}

export async function renameModule(courseId: string, moduleId: string, title: string) {
  void logAudit("module.renamed", { type: "module", id: moduleId, label: title, courseId }, `Renamed a module to “${title}”`);
  await updateDoc(refs.module(courseId, moduleId), { title });
}

/** Delete a module with its lessons (content, files, progress, notes, Q&A) and its coursework. */
export async function deleteModule(courseId: string, moduleId: string) {
  await deleteOnServer("module", courseId, moduleId);
}

// ── Lessons ──────────────────────────────────────────────────────────────────
/**
 * `hasVideo` / `videoDurationSeconds` live on the public lesson doc so the
 * security rules can require learners to actually watch the video.
 */
function videoFields(input: LessonInput) {
  const hasVideo = input.type === "video" && Boolean(input.videoUrl);
  return {
    hasVideo,
    videoDurationSeconds: hasVideo && input.videoDurationSeconds ? Math.round(input.videoDurationSeconds) : 0,
  };
}

export function newLessonId(courseId: string): string {
  return doc(refs.lessons(courseId)).id;
}

export async function createLesson(
  courseId: string,
  moduleId: string,
  order: number,
  input: LessonInput,
  lessonId?: string,
) {
  const lessonRef = lessonId ? refs.lesson(courseId, lessonId) : doc(refs.lessons(courseId));
  const batch = writeBatch(firestore());
  batch.set(lessonRef, {
    moduleId,
    title: input.title,
    type: input.type,
    order,
    durationMinutes: input.durationMinutes,
    ...videoFields(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(refs.lessonContent(courseId, lessonRef.id), {
    body: input.body,
    videoUrl: input.videoUrl || null,
    transcript: input.transcript.trim() || null,
    resources: [],
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  await refreshCourseStats(courseId);
  await logAudit("lesson.created", { type: "lesson", id: lessonRef.id, label: input.title, courseId }, `Added lesson “${input.title}”`);
  return lessonRef.id;
}

export async function updateLesson(courseId: string, lessonId: string, input: LessonInput) {
  const previous = await getDoc(refs.lessonContent(courseId, lessonId));
  const previousVideo = previous.exists() ? (previous.data().videoUrl as string | null) : null;
  void logAudit("lesson.updated", { type: "lesson", id: lessonId, label: input.title, courseId }, `Updated lesson “${input.title}”`);
  const batch = writeBatch(firestore());
  batch.update(refs.lesson(courseId, lessonId), {
    title: input.title,
    type: input.type,
    durationMinutes: input.durationMinutes,
    ...videoFields(input),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    refs.lessonContent(courseId, lessonId),
    {
      body: input.body,
      videoUrl: input.videoUrl || null,
      transcript: input.transcript.trim() || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
  // A replaced (or removed) uploaded video is no longer referenced.
  if (previousVideo && previousVideo !== (input.videoUrl || null)) {
    await deleteUploadedUrl(previousVideo, `courses/${courseId}/lessons/${lessonId}`);
  }
  await refreshCourseStats(courseId);
}

/** Delete a lesson with its content, video & resource files, learners' progress, notes and Q&A. */
export async function deleteLesson(courseId: string, lessonId: string) {
  await deleteOnServer("lesson", courseId, lessonId);
}

// ── Ordering ─────────────────────────────────────────────────────────────────
/** Swap the `order` of an item with its neighbour. Items must be pre-sorted. */
export async function moveItem<T extends { order: number }>(
  items: WithId<T>[],
  index: number,
  direction: -1 | 1,
  refFor: (id: string) => DocumentReference,
) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  const a = items[index];
  const b = items[target];
  const batch = writeBatch(firestore());
  // Use positional indices so legacy duplicate orders get normalised.
  batch.update(refFor(a.id), { order: target });
  batch.update(refFor(b.id), { order: index });
  await batch.commit();
}

export function moveModule(courseId: string, modules: WithId<Module>[], index: number, direction: -1 | 1) {
  return moveItem(modules, index, direction, (id) => refs.module(courseId, id));
}

export function moveLesson(courseId: string, lessons: WithId<Lesson>[], index: number, direction: -1 | 1) {
  return moveItem(lessons, index, direction, (id) => refs.lesson(courseId, id));
}

// ── Resources & media ────────────────────────────────────────────────────────
export async function addLessonResource(
  courseId: string,
  lessonId: string,
  file: File,
  onProgress?: (p: number) => void,
): Promise<LessonResource> {
  const result = await uploadFile(buildPath(`courses/${courseId}/lessons/${lessonId}`, file), file, onProgress);
  const resource: LessonResource = { name: result.name, url: result.url, path: result.path, size: result.size };
  await updateDoc(refs.lessonContent(courseId, lessonId), {
    resources: arrayUnion(resource),
    updatedAt: serverTimestamp(),
  });
  return resource;
}

export async function removeLessonResource(courseId: string, lessonId: string, resource: LessonResource) {
  await updateDoc(refs.lessonContent(courseId, lessonId), {
    resources: arrayRemove(resource),
    updatedAt: serverTimestamp(),
  });
  await deleteFile(resource.path);
}

/** Upload a lesson video and return its URL (persisted when the lesson is saved). */
export async function uploadLessonVideo(
  courseId: string,
  lessonId: string,
  file: File,
  onProgress?: (p: number) => void,
): Promise<string> {
  const result = await uploadFile(buildPath(`courses/${courseId}/lessons/${lessonId}`, file), file, onProgress);
  return result.url;
}
