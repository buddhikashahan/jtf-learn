"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Compass, Plus, Search } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useCatalog, useEnrollmentsFor, useMyCourses, useStaffCourses } from "@/hooks/use-lms";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import {
  SegmentedTabsList,
  SegmentedTabsTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CourseCard, CourseCardSkeleton } from "./course-card";
import { CourseFormDialog } from "./course-form-dialog";
import type { Course, WithId } from "@/types";

function matches(course: Course, term: string) {
  if (!term) return true;
  const t = term.toLowerCase();
  return [course.title, course.code, course.category, course.description].some((v) => v?.toLowerCase().includes(t));
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function LoadingGrid() {
  return (
    <Grid>
      {Array.from({ length: 3 }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </Grid>
  );
}

function NoResults() {
  return <EmptyState icon={Search} title="No matching courses" description="Try a different search term or filter." />;
}

// ── Student ──────────────────────────────────────────────────────────────────
function StudentCourses() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "browse" ? "browse" : "mine";
  const [filter, setFilter] = useState("all");
  const [term, setTerm] = useState("");
  const mine = useMyCourses();
  const catalog = useCatalog();
  const enrolledIds = useMemo(() => new Set(mine.items.map((i) => i.course.id)), [mine.items]);

  const myFiltered = mine.items.filter(
    ({ course, enrollment }) =>
      matches(course, term) &&
      (filter === "all" ||
        (filter === "completed" ? enrollment.status === "completed" : enrollment.status !== "completed")),
  );
  const catalogFiltered = catalog.data
    .filter((c) => matches(c, term))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      <PageHeader title="My courses" description="Continue where you left off or discover something new." />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === "browse" ? `${pathname}?tab=browse` : pathname)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TabsList className="border-none">
            <TabsTrigger value="mine">
              <BookOpen /> Enrolled ({mine.items.length})
            </TabsTrigger>
            <TabsTrigger value="browse">
              <Compass /> Browse catalog
            </TabsTrigger>
          </TabsList>
          <SearchInput value={term} onChange={setTerm} placeholder="Search courses" className="sm:w-72" />
        </div>
        <div className="border-b border-slate-200" />

        <TabsContent value="mine">
          <Tabs value={filter} onValueChange={setFilter} className="mb-5">
            <SegmentedTabsList>
              <SegmentedTabsTrigger value="all">All</SegmentedTabsTrigger>
              <SegmentedTabsTrigger value="active">In progress</SegmentedTabsTrigger>
              <SegmentedTabsTrigger value="completed">Completed</SegmentedTabsTrigger>
            </SegmentedTabsList>
          </Tabs>
          {mine.loading ? (
            <LoadingGrid />
          ) : mine.items.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="You're not enrolled in any courses"
              description="Explore the catalog to find a course, or contact your administrator."
              action={
                <Button onClick={() => router.replace(`${pathname}?tab=browse`)}>
                  <Compass /> Browse catalog
                </Button>
              }
            />
          ) : myFiltered.length === 0 ? (
            <NoResults />
          ) : (
            <Grid>
              {myFiltered.map(({ course, enrollment }) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrollment={enrollment}
                  href={`/courses/${course.id}`}
                  footer={
                    <Link href={`/learn/${course.id}`} className={buttonVariants({ className: "w-full" })}>
                      {enrollment.status === "completed"
                        ? "Review course"
                        : enrollment.progress > 0
                          ? "Continue course"
                          : "Start course"}
                    </Link>
                  }
                />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="browse">
          {catalog.loading ? (
            <LoadingGrid />
          ) : catalogFiltered.length === 0 ? (
            term ? <NoResults /> : <EmptyState icon={BookOpen} title="No published courses yet" />
          ) : (
            <Grid>
              {catalogFiltered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  href={`/courses/${course.id}`}
                  footer={
                    <Link
                      href={enrolledIds.has(course.id) ? `/learn/${course.id}` : `/courses/${course.id}`}
                      className={buttonVariants({
                        variant: enrolledIds.has(course.id) ? "secondary" : "outline",
                        className: "w-full",
                      })}
                    >
                      {enrolledIds.has(course.id) ? "Go to course" : "View details"}
                    </Link>
                  }
                />
              ))}
            </Grid>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

// ── Staff ────────────────────────────────────────────────────────────────────
function StaffCourses() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const createOpen = params.get("new") === "1";
  const [status, setStatus] = useState("all");
  const [term, setTerm] = useState("");
  const courses = useStaffCourses();
  const ids = useMemo(() => (courses.loading ? null : courses.data.map((c) => c.id)), [courses.loading, courses.data]);
  const enrollments = useEnrollmentsFor(ids);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    enrollments.data.forEach((e) => m.set(e.courseId, (m.get(e.courseId) ?? 0) + 1));
    return m;
  }, [enrollments.data]);

  const filtered = courses.data.filter(
    (c: WithId<Course>) => matches(c, term) && (status === "all" || c.status === status),
  );

  return (
    <>
      <PageHeader
        title="Courses"
        description={isAdmin ? "Manage every course on the platform." : "Courses you teach."}
        actions={
          <Button onClick={() => router.replace(`${pathname}?new=1`)}>
            <Plus /> New course
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onValueChange={setStatus}>
          <SegmentedTabsList>
            <SegmentedTabsTrigger value="all">All</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="published">Published</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="draft">Drafts</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="archived">Archived</SegmentedTabsTrigger>
          </SegmentedTabsList>
        </Tabs>
        <SearchInput value={term} onChange={setTerm} placeholder="Search courses" className="sm:w-72" />
      </div>

      {courses.loading ? (
        <LoadingGrid />
      ) : courses.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create your first course, then add modules and lessons."
          action={
            <Button onClick={() => router.replace(`${pathname}?new=1`)}>
              <Plus /> Create course
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResults />
      ) : (
        <Grid>
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/courses/${course.id}/manage`}
              showStatus
              studentCount={enrollments.loading ? undefined : (counts.get(course.id) ?? 0)}
              footer={
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/courses/${course.id}/manage`} className={buttonVariants({ size: "sm" })}>
                    Manage
                  </Link>
                  <Link href={`/courses/${course.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Preview
                  </Link>
                </div>
              }
            />
          ))}
        </Grid>
      )}

      <CourseFormDialog
        open={createOpen}
        onOpenChange={(o) => !o && router.replace(pathname)}
        onSaved={(id) => router.push(`/courses/${id}/manage`)}
      />
    </>
  );
}

export function CoursesView() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffCourses /> : <StudentCourses />;
}
