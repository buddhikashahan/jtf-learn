import Link from "next/link";
import Image from "next/image";
import { BookOpen, Clock, Layers, Users } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/feedback";
import { cn, formatMinutes, pluralize } from "@/lib/utils";
import type { Course, CourseStatus, Enrollment, WithId } from "@/types";

export const statusTone: Record<CourseStatus, BadgeTone> = {
  draft: "warning",
  published: "success",
  archived: "neutral",
};

const gradients = [
  "from-brand-600 to-brand-800",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-indigo-700",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-700",
  "from-rose-500 to-pink-700",
];

function gradientFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) | 0;
  return gradients[Math.abs(h) % gradients.length];
}

export function CourseCover({ course, className }: { course: WithId<Course>; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-100", className)}>
      {course.coverImageUrl ? (
        <Image
          src={course.coverImageUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradientFor(course.id))}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgb(255_255_255/0.25),transparent_45%)]" />
          <BookOpen className="absolute right-4 bottom-4 size-10 text-white/25" />
          <span className="absolute top-4 left-4 rounded-md bg-white/15 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
            {course.code || "COURSE"}
          </span>
        </div>
      )}
    </div>
  );
}

export function CourseCard({
  course,
  enrollment,
  href,
  showStatus = false,
  studentCount,
  footer,
}: {
  course: WithId<Course>;
  enrollment?: Enrollment;
  href: string;
  showStatus?: boolean;
  studentCount?: number;
  footer?: React.ReactNode;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated">
      <Link href={href} className="block focus-visible:outline-offset-[-2px]" tabIndex={-1} aria-hidden>
        <CourseCover course={course} className="aspect-[16/7]" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          {course.category && <Badge tone="brand">{course.category}</Badge>}
          {showStatus && (
            <Badge tone={statusTone[course.status]} dot className="capitalize">
              {course.status}
            </Badge>
          )}
          {enrollment?.status === "completed" && <Badge tone="success">Completed</Badge>}
        </div>
        <h3 className="mt-3 line-clamp-2 font-semibold text-slate-900">
          <Link href={href} className="hover:text-brand-700">
            {course.title}
          </Link>
        </h3>
        {course.description && <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{course.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5" /> {pluralize(course.moduleCount, "module")}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" /> {pluralize(course.lessonCount, "lesson")}
          </span>
          {course.totalMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {formatMinutes(course.totalMinutes)}
            </span>
          )}
          {studentCount != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {pluralize(studentCount, "student")}
            </span>
          )}
        </div>

        {enrollment && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Progress</span>
              <span className="font-semibold text-slate-900">{enrollment.progress}%</span>
            </div>
            <ProgressBar value={enrollment.progress} />
          </div>
        )}

        {footer && <div className="mt-auto pt-5">{footer}</div>}
      </div>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
      <div className="aspect-[16/7] animate-pulse bg-slate-200/70" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200/70" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/70" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-200/70" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200/70" />
      </div>
    </div>
  );
}
