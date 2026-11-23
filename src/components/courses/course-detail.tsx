"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock,
  Layers,
  Lock,
  PlayCircle,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { useCourse, useCourseCoursework, useCurriculum, useEnrollment } from "@/hooks/use-lms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { CourseCover, statusTone } from "./course-card";
import { CurriculumList } from "./curriculum-list";
import { CourseAnnouncements } from "@/components/announcements/announcements";
import { enrollSelf } from "@/lib/services/enrollments";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMinutes, pluralize } from "@/lib/utils";

export function CourseDetail({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const profile = useProfile();
  const { isAdmin } = useAuth();
  const course = useCourse(courseId);
  const enrollment = useEnrollment(courseId, profile.uid);
  const curriculum = useCurriculum(courseId, Boolean(course.data));
  const coursework = useCourseCoursework(courseId, {
    enabled: Boolean(course.data) && (Boolean(enrollment.data) || profile.role !== "student"),
    asLearner: Boolean(enrollment.data),
  });
  const [enrolling, setEnrolling] = useState(false);

  if (course.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!course.data) {
    return (
      <EmptyState
        icon={Lock}
        title="Course unavailable"
        description="This course doesn't exist or you don't have access to it."
        action={
          <Link href="/courses" className={buttonVariants()}>
            Back to courses
          </Link>
        }
      />
    );
  }

  const c = course.data;
  const canManage = isAdmin || (profile.role === "instructor" && c.instructorIds.includes(profile.uid));
  const enrolled = enrollment.data;
  const completedIds = new Set(enrolled?.completedLessonIds ?? []);

  async function handleEnroll() {
    setEnrolling(true);
    try {
      await enrollSelf(c, profile);
      toast.success(`You're enrolled in ${c.title}`);
      router.push(`/learn/${c.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setEnrolling(false);
    }
  }

  const facts = [
    { icon: Layers, label: "Modules", value: c.moduleCount },
    { icon: BookOpen, label: "Lessons", value: c.lessonCount },
    { icon: Clock, label: "Duration", value: formatMinutes(c.totalMinutes) },
    { icon: BarChart3, label: "Level", value: <span className="capitalize">{c.level}</span> },
    ...(c.startDate ? [{ icon: CalendarDays, label: "Starts", value: formatDate(c.startDate) }] : []),
    ...(c.cohort ? [{ icon: Users, label: "Cohort", value: c.cohort }] : []),
  ];

  return (
    <div>
      <PageHeader
        back={{ href: "/courses", label: "Back to courses" }}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {c.code && <span className="font-mono text-xs font-semibold text-slate-500">{c.code}</span>}
            {c.category && <Badge tone="brand">{c.category}</Badge>}
            {canManage && (
              <Badge tone={statusTone[c.status]} dot className="capitalize">
                {c.status}
              </Badge>
            )}
          </div>
        }
        title={c.title}
        description={c.instructorNames.length > 0 ? `Taught by ${c.instructorNames.join(", ")}` : undefined}
        actions={
          canManage && (
            <Link href={`/courses/${c.id}/manage`} className={buttonVariants({ variant: "outline" })}>
              <Settings2 /> Manage course
            </Link>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <CourseCover course={c} className="aspect-[21/8]" />
            {c.description && (
              <CardContent className="pt-5">
                <h2 className="text-base font-semibold text-slate-900">About this course</h2>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">{c.description}</p>
              </CardContent>
            )}
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Course content</h2>
              <span className="text-xs text-slate-500">
                {pluralize(c.moduleCount, "module")} · {pluralize(c.lessonCount, "lesson")}
              </span>
            </div>
            {curriculum.loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <CurriculumList
                coursework={coursework.items}
                courseworkHref={enrollment.data ? "/assignments" : undefined}
                outline={curriculum.outline}
                completedIds={enrolled ? completedIds : undefined}
                hrefFor={enrolled || canManage ? (lessonId) => `/learn/${c.id}/${lessonId}` : undefined}
                locked={!enrolled && !canManage}
              />
            )}
          </div>

          {(enrolled || canManage) && (
            <section id="announcements" className="scroll-mt-24">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Announcements</h2>
              <CourseAnnouncements course={c} canManage={false} />
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>{enrolled ? "Your progress" : "Get started"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {enrollment.loading ? (
                <Skeleton className="h-20 w-full" />
              ) : enrolled ? (
                <>
                  <div>
                    <div className="mb-2 flex items-end justify-between">
                      <span className="text-3xl font-semibold text-slate-900">{enrolled.progress}%</span>
                      <span className="text-xs text-slate-500">
                        {completedIds.size}/{c.lessonCount} lessons
                      </span>
                    </div>
                    <ProgressBar value={enrolled.progress} />
                  </div>
                  <Link href={`/learn/${c.id}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
                    <PlayCircle /> {enrolled.progress > 0 ? "Continue learning" : "Start learning"}
                  </Link>
                  {enrolled.status === "completed" && (
                    <Link
                      href={`/certificates/${c.id}`}
                      className={buttonVariants({ variant: "secondary", className: "w-full" })}
                    >
                      <Award /> View certificate
                    </Link>
                  )}
                </>
              ) : canManage ? (
                <Link href={`/learn/${c.id}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
                  <PlayCircle /> Preview as learner
                </Link>
              ) : c.status === "published" && c.allowSelfEnroll ? (
                <Button size="lg" className="w-full" onClick={handleEnroll} loading={enrolling}>
                  Enrol in this course
                </Button>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  Enrolment for this course is managed by the training team. Contact your administrator to join.
                </p>
              )}

              <dl className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <dt className="flex items-center gap-2 text-slate-500">
                      <f.icon className="size-4 text-slate-400" /> {f.label}
                    </dt>
                    <dd className="font-medium text-slate-900">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
