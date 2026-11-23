"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCountFromServer, query, where } from "firebase/firestore";
import { BookOpen, ClipboardCheck, GraduationCap, Inbox, Plus, Users, Video } from "lucide-react";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import {
  useActivityFor,
  useAssignmentsFor,
  useEnrollmentsFor,
  useGlobalActivity,
  useLiveSessionsFor,
  useNow,
  useStaffCourses,
  useSubmissionsFor,
} from "@/hooks/use-lms";
import { refs } from "@/lib/services/refs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { SessionRow } from "@/components/live/session-row";
import { statusTone } from "@/components/courses/course-card";
import { firstName, liveStatus, timeAgo } from "@/lib/utils";

function useUserCounts(enabled: boolean) {
  const [counts, setCounts] = useState<{ students: number; instructors: number; admins: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const count = (role: string) => getCountFromServer(query(refs.users(), where("role", "==", role)));
    Promise.all([count("student"), count("instructor"), count("admin"), count("superadmin")])
      .then(([s, i, a, sa]) => {
        if (!cancelled) {
          setCounts({ students: s.data().count, instructors: i.data().count, admins: a.data().count + sa.data().count });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return counts;
}

export function StaffDashboard() {
  const profile = useProfile();
  const { isAdmin } = useAuth();
  const now = useNow();

  const courses = useStaffCourses();
  const ids = useMemo(() => (courses.loading ? null : courses.data.map((c) => c.id)), [courses.loading, courses.data]);
  const enrollments = useEnrollmentsFor(ids);
  const assignments = useAssignmentsFor(ids);
  const toGrade = useSubmissionsFor(assignments.loading ? null : assignments.data, true);
  const sessions = useLiveSessionsFor(ids);
  const courseActivity = useActivityFor(isAdmin ? [] : ids, 8);
  const globalActivity = useGlobalActivity(isAdmin, 8);
  const activity = isAdmin ? globalActivity : courseActivity;
  const userCounts = useUserCounts(isAdmin);

  const studentCounts = useMemo(() => {
    const map = new Map<string, number>();
    enrollments.data.forEach((e) => map.set(e.courseId, (map.get(e.courseId) ?? 0) + 1));
    return map;
  }, [enrollments.data]);

  const uniqueStudents = useMemo(() => new Set(enrollments.data.map((e) => e.userId)).size, [enrollments.data]);
  const upcoming = sessions.data.filter((s) => liveStatus(s, now) !== "ended").slice(0, 4);
  const assignmentTitles = new Map(assignments.data.map((a) => [a.id, a]));

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${firstName(profile.displayName)}`}
        description={isAdmin ? "Platform overview and recent activity." : "Your teaching overview at a glance."}
        actions={
          <Link href="/courses?new=1" className={buttonVariants()}>
            <Plus /> New course
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? (
          <StatCard
            label="Total users"
            value={userCounts ? userCounts.students + userCounts.instructors + userCounts.admins : "–"}
            hint={userCounts ? `${userCounts.students} students · ${userCounts.instructors} instructors` : undefined}
            icon={Users}
          />
        ) : (
          <StatCard label="Active students" value={enrollments.loading ? "–" : uniqueStudents} icon={Users} />
        )}
        <StatCard
          label={isAdmin ? "Courses" : "My courses"}
          value={courses.loading ? "–" : courses.data.length}
          hint={
            courses.loading ? undefined : `${courses.data.filter((c) => c.status === "published").length} published`
          }
          icon={BookOpen}
          tone="emerald"
        />
        <StatCard label="Enrolments" value={enrollments.loading ? "–" : enrollments.data.length} icon={GraduationCap} tone="violet" />
        <StatCard
          label="Awaiting grading"
          value={toGrade.loading ? "–" : toGrade.data.length}
          icon={ClipboardCheck}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs grading</CardTitle>
            <Link href="/assignments" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              All assignments
            </Link>
          </CardHeader>
          <CardContent>
            {toGrade.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : toGrade.data.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing to grade" description="New submissions will show up here." className="border-none py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {toGrade.data.slice(0, 5).map((s) => (
                  <li key={`${s.assignmentId}-${s.userId}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={s.userName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{s.userName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {assignmentTitles.get(s.assignmentId)?.title ?? s.assignmentTitle} · {timeAgo(s.submittedAt)}
                      </p>
                    </div>
                    <Link
                      href={`/assignments/${s.courseId}/${s.assignmentId}`}
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      Grade
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming live classes</CardTitle>
            <Link href="/live" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Manage
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessions.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : upcoming.length === 0 ? (
              <EmptyState icon={Video} title="No sessions scheduled" className="border-none py-6" />
            ) : (
              upcoming.map((s) => <SessionRow key={s.id} session={s} now={now} compact />)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{isAdmin ? "All courses" : "Your courses"}</CardTitle>
            <Link href="/courses" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {courses.loading ? (
              <div className="px-5 pb-3">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : courses.data.length === 0 ? (
              <div className="px-5 pb-3">
                <EmptyState
                  icon={BookOpen}
                  title="No courses yet"
                  description="Create your first course to get started."
                  className="border-none py-6"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                      <th className="w-1/2 px-5 py-2.5">Course</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Lessons</th>
                      <th className="px-5 py-2.5 text-right">Students</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courses.data.slice(0, 6).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60">
                        <td className="max-w-0 px-5 py-3">
                          <Link href={`/courses/${c.id}/manage`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                            {c.title}
                          </Link>
                          <span className="font-mono text-xs text-slate-500">{c.code}</span>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={statusTone[c.status]} dot className="capitalize">
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{c.lessonCount}</td>
                        <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{studentCounts.get(c.id) ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity.data} loading={activity.loading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
