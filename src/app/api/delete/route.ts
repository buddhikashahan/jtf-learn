import { z } from "zod";
import { adminDb } from "@/lib/server/admin";
import {
  deleteAssignmentCascade,
  deleteCourseCascade,
  deleteDiscussionCascade,
  deleteEnrollmentCascade,
  deleteLessonCascade,
  deleteModuleCascade,
  deleteSessionCascade,
  refreshCourseStats,
} from "@/lib/server/cascade";
import { audit, handler, HttpError, readJson, requireCourse, requireUser } from "@/lib/server/access";
import type { Assignment, DiscussionPost, LiveSession } from "@/types";

const id = z.string().min(1).max(128).regex(/^[^/]+$/);
const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("course"), courseId: id }),
  z.object({ kind: z.enum(["module", "lesson", "assignment", "session", "enrollment", "discussion", "announcement"]), courseId: id, id }),
]);

/**
 * POST /api/delete { kind, courseId, id? } — delete a record together with
 * everything that belongs to it (subcollections, related records and Storage
 * files). Permissions mirror firestore.rules: courses → admins; everything
 * else → course staff; a Q&A post → its author or course staff.
 */
export const POST = handler(async (req) => {
  const caller = await requireUser(req);
  const body = await readJson(req, input);
  const { courseId } = body;
  const { course, isAdmin, isStaff } = await requireCourse(caller, courseId);
  const db = adminDb();
  const courseLabel = course.title || courseId;

  if (body.kind === "course") {
    if (!isAdmin) throw new HttpError(403, "Only administrators can delete courses.");
    const { learners, files } = await deleteCourseCascade(courseId);
    await audit(
      caller,
      "course.deleted",
      { type: "course", id: courseId, label: course.title },
      `Permanently deleted course “${courseLabel}” with all its content, ${learners} enrolments, grades, recordings and ${files} files`,
    );
    return Response.json({ ok: true, files });
  }

  const target = body.id;
  if (body.kind === "discussion") {
    const post = await db.doc(`courses/${courseId}/discussions/${target}`).get();
    if (!post.exists) return Response.json({ ok: true });
    if (!isStaff && (post.data() as DiscussionPost).authorId !== caller.uid) throw new HttpError(403, "You can only delete your own posts.");
    await deleteDiscussionCascade(courseId, target);
    return Response.json({ ok: true });
  }

  if (!isStaff) throw new HttpError(403, "Only the course's instructors and administrators can do that.");

  switch (body.kind) {
    case "lesson": {
      const lesson = await db.doc(`courses/${courseId}/lessons/${target}`).get();
      const files = await deleteLessonCascade(courseId, target);
      await refreshCourseStats(courseId);
      const title = (lesson.data()?.title as string | undefined) ?? "a lesson";
      await audit(caller, "lesson.deleted", { type: "lesson", id: target, label: title, courseId }, `Deleted lesson “${title}” (${files} files) from ${courseLabel}`);
      return Response.json({ ok: true, files });
    }
    case "module": {
      const mod = await db.doc(`courses/${courseId}/modules/${target}`).get();
      const result = await deleteModuleCascade(courseId, target);
      await refreshCourseStats(courseId);
      const title = (mod.data()?.title as string | undefined) ?? "a module";
      await audit(
        caller,
        "module.deleted",
        { type: "module", id: target, label: title, courseId },
        `Deleted module “${title}” with ${result.lessons} lessons, ${result.coursework} coursework and ${result.files} files from ${courseLabel}`,
      );
      return Response.json({ ok: true, ...result });
    }
    case "assignment": {
      const a = await db.doc(`courses/${courseId}/assignments/${target}`).get();
      const subs = (await a.ref.collection("submissions").count().get()).data().count;
      const files = await deleteAssignmentCascade(courseId, target);
      const title = (a.data() as Assignment | undefined)?.title ?? "coursework";
      await audit(
        caller,
        "assignment.deleted",
        { type: "assignment", id: target, label: title, courseId },
        `Deleted “${title}” (${subs} submissions, ${files} files) from ${courseLabel}`,
      );
      return Response.json({ ok: true, files });
    }
    case "session": {
      const snap = await db.doc(`courses/${courseId}/liveSessions/${target}`).get();
      const session = snap.data() as LiveSession | undefined;
      const files = await deleteSessionCascade(courseId, target);
      const title = session?.title ?? "a live class";
      await audit(caller, "session.deleted", { type: "session", id: target, label: title, courseId }, `Deleted live class “${title}” with its attendance and ${files} recording files`);
      return Response.json({ ok: true, files });
    }
    case "enrollment": {
      const e = await db.doc(`courses/${courseId}/enrollments/${target}`).get();
      const name = (e.data()?.userName as string | undefined) ?? "a learner";
      const files = await deleteEnrollmentCascade(courseId, target);
      await audit(
        caller,
        "enrollment.removed",
        { type: "enrollment", id: target, label: name, courseId },
        `Removed ${name} from ${courseLabel} with their progress, notes and submissions`,
      );
      return Response.json({ ok: true, files });
    }
    case "announcement": {
      await db.doc(`courses/${courseId}/announcements/${target}`).delete();
      await audit(caller, "announcement.deleted", { type: "announcement", id: target, courseId }, `Deleted an announcement from ${courseLabel}`);
      return Response.json({ ok: true });
    }
  }
});
