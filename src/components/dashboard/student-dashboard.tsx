"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Award, BookOpen, CalendarClock, CheckCircle2, ClipboardList, Compass, Megaphone, PlayCircle, Video } from "lucide-react";
import { AnnouncementCard } from "@/components/announcements/announcements";
import { useProfile } from "@/components/providers/auth-provider";
import {
  useActivityFor,
  useAnnouncementsFor,
  useAssignmentsFor,
  useLiveSessionsFor,
  useMyCourses,
  useMySubmissions,
  useNow,
} from "@/hooks/use-lms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/page-header";
import { EmptyState, ProgressRing, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CourseCover, CourseCard } from "@/components/courses/course-card";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { SessionRow } from "@/components/live/session-row";
import { firstName, formatDateTime, liveStatus, toDate } from "@/lib/utils";
import { format } from "date-fns";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function StudentDashboard() {
  const profile = useProfile();
  const now = useNow();
  const { items, loading } = useMyCourses();
  const courseIds = useMemo(() => (loading ? null : items.map((i) => i.course.id)), [loading, items]);
  const assignments = useAssignmentsFor(courseIds);
  const sessions = useLiveSessionsFor(courseIds);
  const activity = useActivityFor(courseIds, 6);
  const submissions = useMySubmissions();
  const announcements = useAnnouncementsFor(courseIds, 3);

  const stats = useMemo(() => {
    const submitted = new Set(submissions.data.map((s) => s.assignmentId));
    const pending = assignments.data.filter((a) => !submitted.has(a.id));
    return {
      pending,
      lessonsCompleted: items.reduce((sum, i) => sum + i.enrollment.completedLessonIds.length, 0),
      certificates: items.filter((i) => i.enrollment.status === "completed").length,
      upcomingSessions: sessions.data.filter((s) => liveStatus(s, now) !== "ended").slice(0, 3),
    };
  }, [assignments.data, submissions.data, items, sessions.data, now]);

  const resume = items.find((i) => i.enrollment.status === "active") ?? items[0];
  const greetingName = firstName(profile.displayName);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">{format(now, "EEEE, MMMM d")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {greeting(new Date(now).getHours())}, {greetingName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">Here&apos;s an overview of your learning.</p>
      </div>

      {/* Continue learning */}
      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : resume ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <CourseCover course={resume.course} className="h-36 md:h-auto md:w-72" />
            <div className="flex flex-1 flex-col gap-5 p-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Badge tone="brand">Continue learning</Badge>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{resume.course.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {resume.enrollment.completedLessonIds.length} of {resume.course.lessonCount} lessons completed
                  {resume.course.cohort ? ` · ${resume.course.cohort}` : ""}
                </p>
                <Link href={`/learn/${resume.course.id}`} className={buttonVariants({ className: "mt-4" })}>
                  <PlayCircle /> {resume.enrollment.progress > 0 ? "Resume course" : "Start course"}
                </Link>
              </div>
              <ProgressRing value={resume.enrollment.progress} size={88} stroke={8} />
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={Compass}
          title="You're not enrolled in any courses yet"
          description="Browse the course catalog to find something to learn, or ask your administrator to enrol you."
          action={
            <Link href="/courses?tab=browse" className={buttonVariants()}>
              Browse courses
            </Link>
          }
        />
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enrolled courses" value={loading ? "–" : items.length} icon={BookOpen} />
        <StatCard label="Lessons completed" value={loading ? "–" : stats.lessonsCompleted} icon={CheckCircle2} tone="emerald" />
        <StatCard
          label="Pending assignments"
          value={assignments.loading ? "–" : stats.pending.length}
          icon={ClipboardList}
          tone="amber"
        />
        <StatCard label="Certificates earned" value={loading ? "–" : stats.certificates} icon={Award} tone="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming live classes</CardTitle>
            <Link href="/live" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessions.loading ? (
              <Skeleton className="h-16 w-full" />
            ) : stats.upcomingSessions.length === 0 ? (
              <EmptyState icon={Video} title="No upcoming live classes" className="border-none py-6" />
            ) : (
              stats.upcomingSessions.map((s) => <SessionRow key={s.id} session={s} now={now} compact />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
            <Link href="/assignments" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {assignments.loading ? (
              <Skeleton className="h-16 w-full" />
            ) : stats.pending.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="You're all caught up" description="No pending assignments." className="border-none py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.pending.slice(0, 4).map((a) => {
                  const due = toDate(a.dueAt)?.getTime() ?? 0;
                  const overdue = due < now;
                  const soon = !overdue && due - now < 3 * 24 * 3600 * 1000;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <CalendarClock className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href="/assignments" className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                          {a.title}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          Due {formatDateTime(a.dueAt)} · {a.points} pts
                        </p>
                      </div>
                      {overdue ? <Badge tone="danger">Overdue</Badge> : soon ? <Badge tone="warning">Due soon</Badge> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {announcements.data.length > 0 && (
        <section aria-labelledby="announcements-heading">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone className="size-4 text-violet-600" />
            <h2 id="announcements-heading" className="text-base font-semibold text-slate-900">
              Latest announcements
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {announcements.data.map((a) => (
              <AnnouncementCard key={a.id} item={a} courseId={a.courseId ?? ""} showCourse compact />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">My courses</h2>
            <Link href="/courses" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : items.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.slice(0, 2).map(({ course, enrollment }) => (
                <CourseCard key={course.id} course={course} enrollment={enrollment} href={`/courses/${course.id}`} />
              ))}
            </div>
          )}
        </div>
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
