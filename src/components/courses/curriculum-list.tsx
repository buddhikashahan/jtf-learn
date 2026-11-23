import Link from "next/link";
import { CheckCircle2, ChevronDown, Circle, ClipboardList, FileText, Lock, PlayCircle } from "lucide-react";
import { cn, formatMinutes, pluralize } from "@/lib/utils";
import type { OutlineModule } from "@/hooks/use-lms";
import type { CourseworkState } from "@/lib/coursework";

export interface OutlineCoursework {
  id: string;
  moduleId: string | null | undefined;
  title: string;
  required?: boolean;
  /** Learner's status; omitted for staff/preview. */
  state?: CourseworkState;
}

const courseworkMeta: Record<CourseworkState, { label: string; className: string }> = {
  todo: { label: "To do", className: "text-amber-700" },
  overdue: { label: "Overdue", className: "text-red-600" },
  submitted: { label: "Awaiting grade", className: "text-sky-700" },
  passed: { label: "Passed", className: "text-emerald-700" },
  failed: { label: "Resubmit", className: "text-red-600" },
};

/** Read-only syllabus, used on the course page and in the lesson player. */
export function CurriculumList({
  outline,
  completedIds,
  lockedIds,
  activeLessonId,
  hrefFor,
  locked = false,
  dense = false,
  coursework,
  courseworkHref,
}: {
  /** Module coursework to list under each module's lessons. */
  coursework?: OutlineCoursework[];
  /** Where a learner goes to submit coursework. */
  courseworkHref?: string;
  outline: OutlineModule[];
  completedIds?: Set<string>;
  /** Individually locked lessons (sequential courses). */
  lockedIds?: Set<string>;
  activeLessonId?: string | null;
  hrefFor?: (lessonId: string) => string;
  locked?: boolean;
  dense?: boolean;
}) {
  if (outline.length === 0) {
    return <p className="px-1 py-4 text-sm text-slate-500">The curriculum hasn&apos;t been published yet.</p>;
  }

  return (
    <div className={cn("space-y-2", dense && "space-y-1")}>
      {outline.map((module, mi) => {
        const minutes = module.lessons.reduce((s, l) => s + l.durationMinutes, 0);
        const done = completedIds ? module.lessons.filter((l) => completedIds.has(l.id)).length : 0;
        const containsActive = module.lessons.some((l) => l.id === activeLessonId);
        return (
          <details
            key={module.id}
            open={containsActive || (!activeLessonId && mi === 0)}
            className={cn("group rounded-xl border border-slate-200 bg-surface", dense && "rounded-lg")}
          >
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden",
                dense && "px-3 py-2.5",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                {mi + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{module.title}</span>
                <span className="block text-xs text-slate-500">
                  {completedIds ? `${done}/${module.lessons.length} completed` : pluralize(module.lessons.length, "lesson")}
                  {minutes > 0 && ` · ${formatMinutes(minutes)}`}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <ul className="border-t border-slate-100 py-1">
              {module.lessons.map((lesson) => {
                const completed = completedIds?.has(lesson.id);
                const lessonLocked = locked || Boolean(lockedIds?.has(lesson.id));
                const active = lesson.id === activeLessonId;
                const TypeIcon = lesson.type === "video" ? PlayCircle : FileText;
                const content = (
                  <>
                    {completed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Completed" />
                    ) : lessonLocked ? (
                      <Lock className="size-4 shrink-0 text-slate-400" aria-hidden />
                    ) : completedIds ? (
                      <Circle className="size-4 shrink-0 text-slate-400" aria-hidden />
                    ) : (
                      <TypeIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
                    )}
                    <span className={cn("min-w-0 flex-1 truncate", active && "font-medium")}>{lesson.title}</span>
                    {lesson.durationMinutes > 0 && (
                      <span className="shrink-0 text-xs text-slate-400 tabular-nums">{formatMinutes(lesson.durationMinutes)}</span>
                    )}
                  </>
                );
                const cls = cn(
                  "mx-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700",
                  active && "bg-brand-50 text-brand-800",
                  lessonLocked && !active && "text-slate-400",
                );
                return (
                  <li key={lesson.id}>
                    {hrefFor && !lessonLocked ? (
                      <Link
                        href={hrefFor(lesson.id)}
                        className={cn(cls, !active && "hover:bg-slate-50")}
                        aria-current={active ? "page" : undefined}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className={cls}>{content}</div>
                    )}
                  </li>
                );
              })}
              {module.lessons.length === 0 && <li className="px-4 py-2 text-xs text-slate-400">No lessons yet</li>}
              {coursework
                ?.filter((c) => c.moduleId === module.id)
                .map((c) => {
                  const meta = c.state ? courseworkMeta[c.state] : null;
                  const row = (
                    <>
                      {c.state === "passed" ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Passed" />
                      ) : (
                        <ClipboardList className={cn("size-4 shrink-0", c.state === "failed" ? "text-red-500" : "text-amber-500")} aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      <span className={cn("shrink-0 text-[11px] font-medium", meta?.className ?? "text-amber-700")}>
                        {meta?.label ?? (c.required ? "Required" : "Coursework")}
                      </span>
                    </>
                  );
                  const cls = "mx-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700";
                  return (
                    <li key={c.id}>
                      {courseworkHref && !locked ? (
                        <Link href={courseworkHref} className={cn(cls, "hover:bg-slate-50")}>
                          {row}
                        </Link>
                      ) : (
                        <div className={cls}>{row}</div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
