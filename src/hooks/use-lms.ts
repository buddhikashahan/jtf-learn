"use client";

import { useEffect, useMemo, useState } from "react";
import { collectionGroup, limit, orderBy, query, where } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { refs } from "@/lib/services/refs";
import { useAuth } from "@/components/providers/auth-provider";
import { useCollection, useDocument, useDocuments, useQueries } from "./use-firestore";
import type {
  ActivityItem,
  Announcement,
  Assignment,
  Course,
  Enrollment,
  Lesson,
  LiveSession,
  Module,
  Submission,
  WithId,
} from "@/types";
import { toDate } from "@/lib/utils";
import { courseworkState } from "@/lib/coursework";

const EMPTY: never[] = [];

/** Stable string key for a list of ids, so memoised queries don't churn. */
function idsKey(ids: string[] | null): string | null {
  return ids === null ? null : [...new Set(ids)].sort().join("|");
}
function splitKey(key: string): string[] {
  return key ? key.split("|") : [];
}

// ── Enrolments & courses ─────────────────────────────────────────────────────
export function useMyEnrollments() {
  const { user } = useAuth();
  const uid = user?.uid;
  const q = useMemo(
    () => (uid ? query(collectionGroup(firestore(), "enrollments"), where("userId", "==", uid)) : null),
    [uid],
  );
  return useCollection<Enrollment>(q);
}

export interface EnrolledCourse {
  course: WithId<Course>;
  enrollment: WithId<Enrollment>;
}

export function useMyCourses() {
  const { data: enrollments, loading: enrollmentsLoading, error } = useMyEnrollments();
  const key = enrollmentsLoading ? null : idsKey(enrollments.map((e) => e.courseId));
  const docRefs = useMemo(() => (key === null ? null : splitKey(key).map((id) => refs.course(id))), [key]);
  const { data: courses, loading: coursesLoading } = useDocuments<Course>(docRefs);

  const items = useMemo<EnrolledCourse[]>(() => {
    const byId = new Map(courses.map((c) => [c.id, c]));
    return enrollments
      .map((enrollment) => ({ enrollment, course: byId.get(enrollment.courseId) }))
      .filter((x): x is EnrolledCourse => Boolean(x.course))
      .sort(
        (a, b) =>
          (toDate(b.enrollment.updatedAt)?.getTime() ?? 0) - (toDate(a.enrollment.updatedAt)?.getTime() ?? 0),
      );
  }, [courses, enrollments]);

  return { items, loading: enrollmentsLoading || coursesLoading, error };
}

/** Courses the current staff member can manage (admin: all, instructor: assigned). */
export function useStaffCourses() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const role = profile?.role;
  const q = useMemo(() => {
    if (!uid || !role || role === "student") return null;
    return role === "admin" || role === "superadmin"
      ? query(refs.courses())
      : query(refs.courses(), where("instructorIds", "array-contains", uid));
  }, [uid, role]);
  const result = useCollection<Course>(q);
  const sorted = useMemo(
    () =>
      [...result.data].sort(
        (a, b) => (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0),
      ),
    [result.data],
  );
  if (role === "student") return { data: EMPTY as WithId<Course>[], loading: false, error: null };
  return { ...result, data: sorted };
}

export function useCatalog() {
  const { user } = useAuth();
  const uid = user?.uid;
  const q = useMemo(() => (uid ? query(refs.courses(), where("status", "==", "published")) : null), [uid]);
  return useCollection<Course>(q);
}

/** Every course relevant to the current user, regardless of role. */
export function useAccessibleCourses() {
  const { isStaff } = useAuth();
  const mine = useMyCourses();
  const staff = useStaffCourses();
  return useMemo(() => {
    if (isStaff) return { courses: staff.data, loading: staff.loading };
    return { courses: mine.items.map((i) => i.course), loading: mine.loading };
  }, [isStaff, mine.items, mine.loading, staff.data, staff.loading]);
}

// ── Per-course collections ───────────────────────────────────────────────────
export function useAssignmentsFor(courseIds: string[] | null) {
  const key = idsKey(courseIds);
  const queries = useMemo(
    () => (key === null ? null : splitKey(key).map((id) => query(refs.assignments(id), orderBy("dueAt", "asc")))),
    [key],
  );
  const result = useQueries<Assignment>(queries);
  const data = useMemo(
    () => [...result.data].sort((a, b) => (toDate(a.dueAt)?.getTime() ?? 0) - (toDate(b.dueAt)?.getTime() ?? 0)),
    [result.data],
  );
  return { ...result, data };
}

export function useLiveSessionsFor(courseIds: string[] | null) {
  const key = idsKey(courseIds);
  const queries = useMemo(
    () =>
      key === null ? null : splitKey(key).map((id) => query(refs.liveSessions(id), orderBy("startAt", "asc"))),
    [key],
  );
  const result = useQueries<LiveSession>(queries);
  const data = useMemo(
    () =>
      [...result.data].sort((a, b) => (toDate(a.startAt)?.getTime() ?? 0) - (toDate(b.startAt)?.getTime() ?? 0)),
    [result.data],
  );
  return { ...result, data };
}

export function useActivityFor(courseIds: string[] | null, max = 8) {
  const key = idsKey(courseIds);
  const queries = useMemo(
    () =>
      key === null
        ? null
        : splitKey(key).map((id) => query(refs.activity(id), orderBy("createdAt", "desc"), limit(max))),
    [key, max],
  );
  const result = useQueries<ActivityItem>(queries);
  const data = useMemo(
    () =>
      [...result.data]
        .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
        .slice(0, max),
    [result.data, max],
  );
  return { ...result, data };
}

/** Latest announcements across courses, pinned first. */
export function useAnnouncementsFor(courseIds: string[] | null, max = 10) {
  const key = idsKey(courseIds);
  const queries = useMemo(
    () =>
      key === null
        ? null
        : splitKey(key).map((id) => query(refs.announcements(id), orderBy("createdAt", "desc"), limit(max))),
    [key, max],
  );
  const result = useQueries<Announcement>(queries);
  const data = useMemo(
    () =>
      result.data
        .map((a) => ({ ...a }))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
        )
        .slice(0, max),
    [result.data, max],
  );
  return { ...result, data };
}

/** Admin-only: platform-wide activity via a collection-group query. */
export function useGlobalActivity(enabled: boolean, max = 10) {
  const q = useMemo(
    () =>
      enabled ? query(collectionGroup(firestore(), "activity"), orderBy("createdAt", "desc"), limit(max)) : null,
    [enabled, max],
  );
  return useCollection<ActivityItem>(q);
}

export function useMySubmissions() {
  const { user } = useAuth();
  const uid = user?.uid;
  const q = useMemo(
    () => (uid ? query(collectionGroup(firestore(), "submissions"), where("userId", "==", uid)) : null),
    [uid],
  );
  return useCollection<Submission>(q);
}

/**
 * Coursework for one course, for the syllabus outline. For learners each item
 * carries their own status (to do / awaiting grade / passed / resubmit).
 */
export function useCourseCoursework(courseId: string | null, { enabled, asLearner }: { enabled: boolean; asLearner: boolean }) {
  const ids = useMemo(() => (enabled && courseId ? [courseId] : null), [enabled, courseId]);
  const assignments = useAssignmentsFor(ids);
  const submissions = useMySubmissions();
  const now = useNow(60_000);
  return useMemo(() => {
    const mine = new Map(submissions.data.filter((s) => s.courseId === courseId).map((s) => [s.assignmentId, s]));
    const items = assignments.data.map((a) => ({
      id: a.id,
      moduleId: a.moduleId ?? null,
      title: a.title,
      required: Boolean(a.required),
      state: asLearner ? courseworkState(a, mine.get(a.id), now) : undefined,
    }));
    const required = items.filter((i) => i.required);
    return {
      items,
      loading: ids !== null && assignments.loading,
      requiredTotal: required.length,
      requiredPassed: required.filter((i) => i.state === "passed").length,
    };
  }, [assignments.data, assignments.loading, submissions.data, courseId, asLearner, now, ids]);
}

/** Staff: enrolments across the given courses. */
export function useEnrollmentsFor(courseIds: string[] | null) {
  const key = idsKey(courseIds);
  const queries = useMemo(
    () => (key === null ? null : splitKey(key).map((id) => query(refs.enrollments(id)))),
    [key],
  );
  return useQueries<Enrollment>(queries);
}

/** Staff: submissions for the given assignments (optionally only ungraded). */
export function useSubmissionsFor(
  assignments: { id: string; courseId: string }[] | null,
  onlyUngraded = false,
) {
  const key = assignments === null ? null : assignments.map((a) => `${a.courseId}/${a.id}`).sort().join("|");
  const queries = useMemo(() => {
    if (key === null) return null;
    return splitKey(key).map((pair) => {
      const [courseId, assignmentId] = pair.split("/");
      const col = refs.submissions(courseId, assignmentId);
      return onlyUngraded ? query(col, where("status", "==", "submitted")) : query(col);
    });
  }, [key, onlyUngraded]);
  return useQueries<Submission>(queries);
}

// ── Single course ────────────────────────────────────────────────────────────
export function useCourse(courseId: string | null) {
  const ref = useMemo(() => (courseId ? refs.course(courseId) : null), [courseId]);
  return useDocument<Course>(ref);
}

export function useEnrollment(courseId: string | null, userId: string | null | undefined) {
  const ref = useMemo(() => (courseId && userId ? refs.enrollment(courseId, userId) : null), [courseId, userId]);
  return useDocument<Enrollment>(ref);
}

export interface OutlineModule extends WithId<Module> {
  lessons: WithId<Lesson>[];
}

/** Modules + lessons for a course, assembled into an ordered outline. */
export function useCurriculum(courseId: string | null, enabled = true) {
  const modulesQ = useMemo(
    () => (courseId && enabled ? query(refs.modules(courseId), orderBy("order", "asc")) : null),
    [courseId, enabled],
  );
  const lessonsQ = useMemo(
    () => (courseId && enabled ? query(refs.lessons(courseId), orderBy("order", "asc")) : null),
    [courseId, enabled],
  );
  const modules = useCollection<Module>(modulesQ);
  const lessons = useCollection<Lesson>(lessonsQ);

  return useMemo(() => {
    const outline: OutlineModule[] = modules.data.map((m) => ({
      ...m,
      lessons: lessons.data.filter((l) => l.moduleId === m.id),
    }));
    return {
      outline,
      orderedLessons: outline.flatMap((m) => m.lessons),
      loading: modules.loading || lessons.loading,
      error: modules.error ?? lessons.error,
    };
  }, [modules, lessons]);
}

// ── Misc ─────────────────────────────────────────────────────────────────────
/** Current time that re-renders on an interval (for live/upcoming status). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
