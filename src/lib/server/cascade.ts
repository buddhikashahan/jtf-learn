import "server-only";
import { FieldPath, FieldValue, type DocumentReference, type DocumentSnapshot, type UpdateData } from "firebase-admin/firestore";
import { adminBucket, adminDb } from "./admin";
import type { Enrollment, Lesson } from "@/types";

/**
 * Cascading deletes. Firestore doesn't delete subcollections or Storage files
 * on its own, so each delete here removes the record *and* everything that
 * belongs to it. Storage layout:
 *
 *   courses/{c}/cover/…                     course cover
 *   courses/{c}/lessons/{lessonId}/…        lesson videos & resources
 *   courses/{c}/recordings/{sessionId}/…    uploaded class recordings
 *   submissions/{c}/{assignmentId}/{uid}/…  coursework files
 *
 * Audit logs are kept on purpose: they are the record of these deletions.
 */

const db = () => adminDb();

/** BulkWriter that collects per-write failures and reports the first one on close(). */
function bulk() {
  const writer = db().bulkWriter();
  const errors: unknown[] = [];
  const track = (p: Promise<unknown>): void => void p.catch((e: unknown) => errors.push(e));
  return {
    delete: (ref: DocumentReference): void => track(writer.delete(ref)),
    update: (ref: DocumentReference, data: UpdateData<FirebaseFirestore.DocumentData>): void => track(writer.update(ref, data)),
    async close() {
      await writer.close();
      if (errors.length) throw errors[0];
    },
  };
}

/** Delete every Storage object under a folder. Returns how many were removed. */
export async function deleteFolder(prefix: string): Promise<number> {
  const bucket = adminBucket();
  const [files] = await bucket.getFiles({ prefix: prefix.endsWith("/") ? prefix : `${prefix}/` });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true }).catch(() => undefined)));
  return files.length;
}

/** Delete one Storage object given its path or Firebase download URL (only within `folder`). */
export async function deleteStorageObject(pathOrUrl: string | null | undefined, folder: string) {
  const path = storagePath(pathOrUrl);
  if (!path || !path.startsWith(folder)) return;
  await adminBucket().file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
}

/** Storage path from a Firebase download URL (…/o/<encoded path>?alt=media…) or a plain path. */
export function storagePath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const match = /\/o\/([^?#]+)/.exec(pathOrUrl);
  if (match) return decodeURIComponent(match[1]);
  return /^https?:/.test(pathOrUrl) ? null : pathOrUrl;
}

async function enrollments(courseId: string) {
  return (await db().collection(`courses/${courseId}/enrollments`).get()).docs;
}

/** Private notes are users/{uid}/notes/{courseId}_{lessonId}. */
async function deleteCourseNotes(courseId: string, uids: string[]) {
  const writer = bulk();
  for (const uid of uids) {
    const notes = await db()
      .collection(`users/${uid}/notes`)
      .where(FieldPath.documentId(), ">=", `${courseId}_`)
      .where(FieldPath.documentId(), "<", `${courseId}_`)
      .get();
    notes.docs.forEach((d) => writer.delete(d.ref));
  }
  await writer.close();
}

/** Recompute the course's denormalised counters after curriculum changes. */
export async function refreshCourseStats(courseId: string) {
  const [modules, lessons] = await Promise.all([
    db().collection(`courses/${courseId}/modules`).count().get(),
    db().collection(`courses/${courseId}/lessons`).get(),
  ]);
  const totalMinutes = lessons.docs.reduce((sum, d) => sum + ((d.data() as Lesson).durationMinutes || 0), 0);
  await db().doc(`courses/${courseId}`).update({
    moduleCount: modules.data().count,
    lessonCount: lessons.size,
    totalMinutes,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ── Lessons ──────────────────────────────────────────────────────────────────
/** A lesson, its content & files, everyone's progress/notes on it, and its Q&A. */
export async function deleteLessonCascade(courseId: string, lessonId: string, enrolled?: DocumentSnapshot[]) {
  const learners = enrolled ?? (await enrollments(courseId));
  const writer = bulk();
  for (const e of learners) {
    const data = e.data() as Enrollment;
    writer.delete(e.ref.collection("lessonProgress").doc(lessonId));
    writer.delete(db().doc(`users/${e.id}/notes/${courseId}_${lessonId}`));
    // Keep progress consistent: drop the lesson from completions.
    if (data.completedLessonIds?.includes(lessonId) || data.lastLessonId === lessonId) {
      writer.update(e.ref, {
        completedLessonIds: FieldValue.arrayRemove(lessonId),
        ...(data.lastLessonId === lessonId ? { lastLessonId: null } : {}),
      });
    }
  }
  const posts = await db().collection(`courses/${courseId}/discussions`).where("lessonId", "==", lessonId).get();
  posts.docs.forEach((d) => writer.delete(d.ref));
  writer.delete(db().doc(`courses/${courseId}/lessonContent/${lessonId}`));
  writer.delete(db().doc(`courses/${courseId}/lessons/${lessonId}`));
  await writer.close();
  return deleteFolder(`courses/${courseId}/lessons/${lessonId}`);
}

// ── Coursework ───────────────────────────────────────────────────────────────
/** An assignment, all submissions and their files, and its pass/required markers. */
export async function deleteAssignmentCascade(courseId: string, assignmentId: string, enrolled?: DocumentSnapshot[]) {
  const learners = enrolled ?? (await enrollments(courseId));
  await db().recursiveDelete(db().doc(`courses/${courseId}/assignments/${assignmentId}`));
  const writer = bulk();
  for (const e of learners) {
    if ((e.data() as Enrollment).passedCourseworkIds?.includes(assignmentId)) {
      writer.update(e.ref, { passedCourseworkIds: FieldValue.arrayRemove(assignmentId) });
    }
  }
  writer.update(db().doc(`courses/${courseId}`), { requiredCourseworkIds: FieldValue.arrayRemove(assignmentId) });
  await writer.close();
  return deleteFolder(`submissions/${courseId}/${assignmentId}`);
}

// ── Modules ──────────────────────────────────────────────────────────────────
/** A module with all its lessons and its coursework. */
export async function deleteModuleCascade(courseId: string, moduleId: string) {
  const learners = await enrollments(courseId);
  const [lessons, coursework] = await Promise.all([
    db().collection(`courses/${courseId}/lessons`).where("moduleId", "==", moduleId).get(),
    db().collection(`courses/${courseId}/assignments`).where("moduleId", "==", moduleId).get(),
  ]);
  let files = 0;
  for (const l of lessons.docs) files += await deleteLessonCascade(courseId, l.id, learners);
  for (const a of coursework.docs) files += await deleteAssignmentCascade(courseId, a.id, learners);
  await db().doc(`courses/${courseId}/modules/${moduleId}`).delete();
  return { lessons: lessons.size, coursework: coursework.size, files };
}

// ── Live classes ─────────────────────────────────────────────────────────────
/** A live class with its attendance (and any old chat) and its uploaded recording files. */
export async function deleteSessionCascade(courseId: string, sessionId: string) {
  await db().recursiveDelete(db().doc(`courses/${courseId}/liveSessions/${sessionId}`));
  return deleteFolder(`courses/${courseId}/recordings/${sessionId}`);
}

// ── Enrolments ───────────────────────────────────────────────────────────────
/** A learner's enrolment with their progress, notes, submissions and submission files. */
export async function deleteEnrollmentCascade(courseId: string, uid: string) {
  const assignments = await db().collection(`courses/${courseId}/assignments`).select().get();
  const writer = bulk();
  assignments.docs.forEach((a) => writer.delete(a.ref.collection("submissions").doc(uid)));
  await writer.close();
  await deleteCourseNotes(courseId, [uid]);
  await db().recursiveDelete(db().doc(`courses/${courseId}/enrollments/${uid}`));
  let files = 0;
  for (const a of assignments.docs) files += await deleteFolder(`submissions/${courseId}/${a.id}/${uid}`);
  return files;
}

// ── Discussions ──────────────────────────────────────────────────────────────
/** A Q&A post and its replies. */
export async function deleteDiscussionCascade(courseId: string, postId: string) {
  const replies = await db().collection(`courses/${courseId}/discussions`).where("parentId", "==", postId).get();
  const writer = bulk();
  replies.docs.forEach((d) => writer.delete(d.ref));
  writer.delete(db().doc(`courses/${courseId}/discussions/${postId}`));
  await writer.close();
}

// ── Courses ──────────────────────────────────────────────────────────────────
/** A whole course: every subcollection, learners' notes and all files. */
export async function deleteCourseCascade(courseId: string) {
  const learners = await enrollments(courseId);
  await deleteCourseNotes(
    courseId,
    learners.map((e) => e.id),
  );
  await db().recursiveDelete(db().doc(`courses/${courseId}`));
  const files = (await deleteFolder(`courses/${courseId}`)) + (await deleteFolder(`submissions/${courseId}`));
  return { learners: learners.length, files };
}
