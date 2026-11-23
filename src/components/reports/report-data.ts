"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { refs } from "@/lib/services/refs";
import { useAssignmentsFor, useCurriculum, useEnrollmentsFor, useSubmissionsFor } from "@/hooks/use-lms";
import { isPassed } from "@/lib/coursework";
import { toDate } from "@/lib/utils";
import type { Assignment, Course, Enrollment, Lesson, LessonProgress, Submission, WithId } from "@/types";

/** Video progress of every learner in a course: uid → lessonId → progress. */
function useLessonProgressFor(courseId: string | null, studentIds: string[] | null) {
  const idsKey = studentIds ? [...studentIds].sort().join("|") : null;
  const [state, setState] = useState<{ key: string | null; data: Map<string, Map<string, LessonProgress>> }>({
    key: null,
    data: new Map(),
  });
  const key = courseId && idsKey !== null ? `${courseId}#${idsKey}` : null;

  useEffect(() => {
    if (!key || !courseId || idsKey === null) return;
    const ids = idsKey ? idsKey.split("|") : [];
    if (ids.length === 0) return;
    const unsubs = ids.map((uid) =>
      onSnapshot(
        refs.lessonProgressAll(courseId, uid),
        (snap) =>
          setState((prev) => {
            const data = new Map(prev.key === key ? prev.data : []);
            data.set(uid, new Map(snap.docs.map((d) => [d.id, d.data({ serverTimestamps: "estimate" }) as LessonProgress])));
            return { key, data };
          }),
        () =>
          setState((prev) => {
            const data = new Map(prev.key === key ? prev.data : []);
            data.set(uid, new Map());
            return { key, data };
          }),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key, courseId, idsKey]);

  const expected = idsKey ? idsKey.split("|").length : 0;
  const current = state.key === key;
  return {
    data: current ? state.data : new Map<string, Map<string, LessonProgress>>(),
    loading: key !== null && expected > 0 && (!current || state.data.size < expected),
  };
}

export interface LessonWatch {
  lesson: WithId<Lesson>;
  /** 0–100, null when not a video lesson. */
  watchedPercent: number | null;
  watchedSeconds: number;
  lengthSeconds: number;
  completed: boolean;
  lastWatched: Date | null;
}

export interface CourseworkResult {
  assignment: WithId<Assignment>;
  submission: WithId<Submission> | null;
  /** 0–100, null until graded. */
  percent: number | null;
  passed: boolean;
}

export interface StudentReport {
  enrollment: WithId<Enrollment>;
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  /** Average % watched across the course's video lessons (null if the course has none). */
  videoPercent: number | null;
  watchedSeconds: number;
  videoSeconds: number;
  courseworkPassed: number;
  courseworkRequired: number;
  /** Average mark across graded work, 0–100 (null if nothing graded yet). */
  averageMark: number | null;
  submitted: number;
  lastActive: Date | null;
  lessons: LessonWatch[];
  coursework: CourseworkResult[];
}

export interface LessonReport {
  lesson: WithId<Lesson>;
  moduleTitle: string;
  completedBy: number;
  startedBy: number;
  averageWatched: number | null;
}

export interface CourseworkReport {
  assignment: WithId<Assignment>;
  submitted: number;
  graded: number;
  averageMark: number | null;
  passRate: number | null;
}

function videoLength(lesson: Lesson, progress: LessonProgress | undefined) {
  return lesson.videoDurationSeconds && lesson.videoDurationSeconds > 0 ? lesson.videoDurationSeconds : (progress?.duration ?? 0);
}

const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

/** Everything the reports need for one course, computed from live data. */
export function useCourseReport(course: WithId<Course> | null) {
  const courseId = course?.id ?? null;
  const ids = useMemo(() => (courseId ? [courseId] : null), [courseId]);
  const curriculum = useCurriculum(courseId);
  const enrollments = useEnrollmentsFor(ids);
  const assignments = useAssignmentsFor(ids);
  const submissions = useSubmissionsFor(assignments.loading ? null : assignments.data);
  const studentIds = useMemo(
    () => (enrollments.loading ? null : enrollments.data.map((e) => e.userId)),
    [enrollments.loading, enrollments.data],
  );
  const progress = useLessonProgressFor(courseId, studentIds);

  const loading = !course || curriculum.loading || enrollments.loading || assignments.loading || submissions.loading || progress.loading;

  const report = useMemo(() => {
    const lessons = curriculum.orderedLessons;
    const moduleTitle = new Map(curriculum.outline.map((m) => [m.id, m.title]));
    const lessonIds = new Set(lessons.map((l) => l.id));
    const videoLessons = lessons.filter((l) => l.hasVideo);
    const required = new Set(course?.requiredCourseworkIds ?? []);
    const subsByStudent = new Map<string, Map<string, WithId<Submission>>>();
    for (const s of submissions.data) {
      if (!subsByStudent.has(s.userId)) subsByStudent.set(s.userId, new Map());
      subsByStudent.get(s.userId)!.set(s.assignmentId, s);
    }

    const students: StudentReport[] = enrollments.data
      .map((enrollment) => {
        const watch = progress.data.get(enrollment.userId) ?? new Map<string, LessonProgress>();
        const done = new Set(enrollment.completedLessonIds.filter((id) => lessonIds.has(id)));
        const lessonRows: LessonWatch[] = lessons.map((lesson) => {
          const p = watch.get(lesson.id);
          const len = videoLength(lesson, p);
          return {
            lesson,
            watchedPercent: lesson.hasVideo ? (len > 0 && p ? Math.min(100, Math.round((p.maxWatched / len) * 100)) : 0) : null,
            watchedSeconds: lesson.hasVideo ? Math.min(p?.maxWatched ?? 0, len || Infinity) : 0,
            lengthSeconds: lesson.hasVideo ? len : 0,
            completed: done.has(lesson.id),
            lastWatched: toDate(p?.updatedAt),
          };
        });
        const videoRows = lessonRows.filter((r) => r.watchedPercent !== null);
        const mine = subsByStudent.get(enrollment.userId) ?? new Map();
        const coursework: CourseworkResult[] = assignments.data.map((assignment) => {
          const submission = mine.get(assignment.id) ?? null;
          const graded = submission?.status === "graded" && submission.grade != null;
          return {
            assignment,
            submission,
            percent: graded ? Math.round(((submission!.grade ?? 0) / assignment.points) * 100) : null,
            passed: isPassed(assignment, submission),
          };
        });
        const graded = coursework.filter((c) => c.percent !== null).map((c) => c.percent!);
        const lastWatched = lessonRows.map((r) => r.lastWatched?.getTime() ?? 0);
        const lastActive = Math.max(toDate(enrollment.updatedAt)?.getTime() ?? 0, ...lastWatched);

        return {
          enrollment,
          progress: enrollment.progress,
          lessonsDone: done.size,
          lessonsTotal: lessons.length,
          videoPercent: videoRows.length ? Math.round(avg(videoRows.map((r) => r.watchedPercent!))!) : null,
          watchedSeconds: videoRows.reduce((s, r) => s + r.watchedSeconds, 0),
          videoSeconds: videoRows.reduce((s, r) => s + r.lengthSeconds, 0),
          courseworkPassed: coursework.filter((c) => required.has(c.assignment.id) && c.passed).length,
          courseworkRequired: required.size,
          averageMark: graded.length ? Math.round(avg(graded)!) : null,
          submitted: coursework.filter((c) => c.submission).length,
          lastActive: lastActive > 0 ? new Date(lastActive) : null,
          lessons: lessonRows,
          coursework,
        };
      })
      .sort((a, b) => a.enrollment.userName.localeCompare(b.enrollment.userName));

    const lessonReports: LessonReport[] = lessons.map((lesson) => {
      const rows = students.map((s) => s.lessons.find((l) => l.lesson.id === lesson.id)!);
      const watched = rows.filter((r) => r.watchedPercent !== null);
      return {
        lesson,
        moduleTitle: moduleTitle.get(lesson.moduleId) ?? "",
        completedBy: rows.filter((r) => r.completed).length,
        startedBy: lesson.hasVideo ? watched.filter((r) => (r.watchedPercent ?? 0) > 0).length : rows.filter((r) => r.completed).length,
        averageWatched: lesson.hasVideo && watched.length ? Math.round(avg(watched.map((r) => r.watchedPercent!))!) : null,
      };
    });

    const courseworkReports: CourseworkReport[] = assignments.data.map((assignment) => {
      const results = students.map((s) => s.coursework.find((c) => c.assignment.id === assignment.id)!);
      const graded = results.filter((r) => r.percent !== null);
      return {
        assignment,
        submitted: results.filter((r) => r.submission).length,
        graded: graded.length,
        averageMark: graded.length ? Math.round(avg(graded.map((r) => r.percent!))!) : null,
        passRate: graded.length ? Math.round((graded.filter((r) => r.passed).length / graded.length) * 100) : null,
      };
    });

    const withVideo = students.filter((s) => s.videoPercent !== null);
    const withMarks = students.filter((s) => s.averageMark !== null);
    return {
      students,
      lessons: lessonReports,
      coursework: courseworkReports,
      videoLessonCount: videoLessons.length,
      summary: {
        enrolled: students.length,
        completed: students.filter((s) => s.enrollment.status === "completed").length,
        averageProgress: students.length ? Math.round(avg(students.map((s) => s.progress))!) : null,
        averageVideo: withVideo.length ? Math.round(avg(withVideo.map((s) => s.videoPercent!))!) : null,
        averageMark: withMarks.length ? Math.round(avg(withMarks.map((s) => s.averageMark!))!) : null,
      },
    };
  }, [curriculum, enrollments.data, assignments.data, submissions.data, progress.data, course]);

  return { loading, ...report };
}
