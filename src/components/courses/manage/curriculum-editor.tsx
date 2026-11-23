"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  FileText,
  Layers,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAssignmentsFor, useCurriculum, type OutlineModule } from "@/hooks/use-lms";
import { AssignmentFormDialog } from "@/components/assignments/assignment-form-dialog";
import { passMarkOf } from "@/lib/coursework";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LessonFormDialog } from "./lesson-form-dialog";
import {
  createModule,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
  renameModule,
} from "@/lib/services/curriculum";
import { getErrorMessage } from "@/lib/errors";
import { formatMinutes, pluralize } from "@/lib/utils";
import type { Assignment, Course, Lesson, WithId } from "@/types";

type LessonDialogState = { moduleId: string; order: number; lesson?: WithId<Lesson> } | null;
type ConfirmState = { kind: "module" | "lesson"; id: string; title: string } | null;

async function run(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    toast.error(getErrorMessage(error));
  }
}

function ModuleCard({
  courseId,
  module,
  index,
  modules,
  onAddLesson,
  onEditLesson,
  onDelete,
  coursework,
  onAddCoursework,
  onEditCoursework,
}: {
  courseId: string;
  module: OutlineModule;
  index: number;
  modules: OutlineModule[];
  onAddLesson: () => void;
  onEditLesson: (lesson: WithId<Lesson>) => void;
  onDelete: (state: ConfirmState) => void;
  coursework: WithId<Assignment>[];
  onAddCoursework: () => void;
  onEditCoursework: (assignment: WithId<Assignment>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(module.title);
  const minutes = module.lessons.reduce((s, l) => s + l.durationMinutes, 0);

  async function saveTitle() {
    const value = title.trim();
    if (!value || value === module.title) return setEditing(false);
    await run(() => renameModule(courseId, module.id, value));
    setEditing(false);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-surface shadow-card" aria-label={`Module ${index + 1}`}>
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-700">
          {index + 1}
        </span>
        {editing ? (
          <form method="post"
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus aria-label="Module title" className="h-9" />
            <Button type="submit" size="icon-sm" aria-label="Save title">
              <Check />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => (setTitle(module.title), setEditing(false))}>
              <X />
            </Button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900">{module.title}</h3>
            <p className="text-xs text-slate-500">
              {pluralize(module.lessons.length, "lesson")}
              {minutes > 0 && ` · ${formatMinutes(minutes)}`}
            </p>
          </div>
        )}
        {!editing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move module up"
              disabled={index === 0}
              onClick={() => run(() => moveModule(courseId, modules, index, -1))}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move module down"
              disabled={index === modules.length - 1}
              onClick={() => run(() => moveModule(courseId, modules, index, 1))}
            >
              <ArrowDown />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Module actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => onDelete({ kind: "module", id: module.id, title: module.title })}>
                  <Trash2 /> Delete module
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      <ul className="divide-y divide-slate-100">
        {module.lessons.map((lesson, li) => (
          <li key={lesson.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70">
            {lesson.type === "video" ? (
              <PlayCircle className="size-4 shrink-0 text-brand-500" aria-label="Video lesson" />
            ) : (
              <FileText className="size-4 shrink-0 text-emerald-500" aria-label="Reading lesson" />
            )}
            <button
              type="button"
              onClick={() => onEditLesson(lesson)}
              className="min-w-0 flex-1 truncate text-left text-sm text-slate-800 hover:text-brand-700"
            >
              {lesson.title}
            </button>
            <span className="hidden text-xs text-slate-400 tabular-nums sm:inline">{formatMinutes(lesson.durationMinutes)}</span>
            <div className="flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move lesson up"
                disabled={li === 0}
                onClick={() => run(() => moveLesson(courseId, module.lessons, li, -1))}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move lesson down"
                disabled={li === module.lessons.length - 1}
                onClick={() => run(() => moveLesson(courseId, module.lessons, li, 1))}
              >
                <ArrowDown />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Edit lesson" onClick={() => onEditLesson(lesson)}>
                <Pencil />
              </Button>
              <Button
                variant="danger-ghost"
                size="icon-sm"
                aria-label="Delete lesson"
                onClick={() => onDelete({ kind: "lesson", id: lesson.id, title: lesson.title })}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {coursework.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-amber-50/30">
          {coursework.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <ClipboardList className="size-4 shrink-0 text-amber-600" aria-label="Coursework" />
              <button
                type="button"
                onClick={() => onEditCoursework(a)}
                className="min-w-0 flex-1 truncate text-left text-sm text-slate-800 hover:text-brand-700"
              >
                {a.title}
              </button>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {a.points} pts{passMarkOf(a) > 0 ? ` · pass ${passMarkOf(a)}` : ""}
              </span>
              <Badge tone={a.required ? "warning" : "neutral"}>{a.required ? "Required" : "Optional"}</Badge>
              <Link href={`/assignments/${a.courseId}/${a.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Submissions
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1 px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={onAddLesson} className="text-brand-700">
          <Plus /> Add lesson
        </Button>
        <Button variant="ghost" size="sm" onClick={onAddCoursework} className="text-amber-700">
          <ClipboardList /> Add coursework
        </Button>
        {coursework.length === 0 && module.lessons.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">No coursework for this module yet</span>
        )}
      </div>
    </section>
  );
}

export function CurriculumEditor({ course }: { course: WithId<Course> }) {
  const { outline, loading } = useCurriculum(course.id);
  const [newModule, setNewModule] = useState("");
  const [adding, setAdding] = useState(false);
  const [lessonDialog, setLessonDialog] = useState<LessonDialogState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [courseworkDialog, setCourseworkDialog] = useState<{ moduleId: string; assignment?: WithId<Assignment> } | null>(null);
  const courseIds = useMemo(() => [course.id], [course.id]);
  const courses = useMemo(() => [course], [course]);
  const assignments = useAssignmentsFor(courseIds);

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    const title = newModule.trim();
    if (!title) return;
    setAdding(true);
    await run(() => createModule(course.id, title, outline.length));
    setNewModule("");
    setAdding(false);
  }

  async function handleDelete() {
    if (!confirm) return;
    if (confirm.kind === "module") {
      await deleteModule(course.id, confirm.id);
    } else {
      await deleteLesson(course.id, confirm.id);
    }
    toast.success(`${confirm.kind === "module" ? "Module" : "Lesson"} deleted`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Badge>{pluralize(course.moduleCount, "module")}</Badge>
        <Badge>{pluralize(course.lessonCount, "lesson")}</Badge>
        <Badge>{formatMinutes(course.totalMinutes)} total</Badge>
        <Badge tone={(course.requiredCourseworkIds?.length ?? 0) > 0 ? "warning" : "neutral"}>
          {pluralize(course.requiredCourseworkIds?.length ?? 0, "required coursework", "required coursework")}
        </Badge>
      </div>

      {outline.length === 0 && (
        <EmptyState
          icon={Layers}
          title="Start building your curriculum"
          description="Organise your course into modules, then add video or reading lessons to each one."
        />
      )}

      {outline.map((module, index) => (
        <ModuleCard
          key={module.id}
          courseId={course.id}
          module={module}
          index={index}
          modules={outline}
          onAddLesson={() => setLessonDialog({ moduleId: module.id, order: module.lessons.length })}
          onEditLesson={(lesson) => setLessonDialog({ moduleId: module.id, order: lesson.order, lesson })}
          onDelete={setConfirm}
          coursework={assignments.data.filter((a) => a.moduleId === module.id)}
          onAddCoursework={() => setCourseworkDialog({ moduleId: module.id })}
          onEditCoursework={(assignment) => setCourseworkDialog({ moduleId: module.id, assignment })}
        />
      ))}

      <form method="post" onSubmit={addModule} className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-surface p-4 sm:flex-row">
        <Input
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
          placeholder="New module title, e.g. Battery Systems & BMS"
          maxLength={160}
          aria-label="New module title"
        />
        <Button type="submit" loading={adding} disabled={!newModule.trim()} className="shrink-0">
          <Plus /> Add module
        </Button>
      </form>

      {lessonDialog && (
        <LessonFormDialog
          key={lessonDialog.lesson?.id ?? `new-${lessonDialog.moduleId}`}
          open
          onOpenChange={(o) => !o && setLessonDialog(null)}
          courseId={course.id}
          moduleId={lessonDialog.moduleId}
          order={lessonDialog.order}
          lesson={lessonDialog.lesson}
        />
      )}

      <AssignmentFormDialog
        open={courseworkDialog !== null}
        onOpenChange={(o) => !o && setCourseworkDialog(null)}
        courses={courses}
        assignment={courseworkDialog?.assignment}
        defaultCourseId={course.id}
        defaultModuleId={courseworkDialog?.moduleId}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.kind ?? ""} “${confirm?.title ?? ""}”?`}
        description={
          confirm?.kind === "module"
            ? "Its lessons (with videos and files), its coursework (with submissions and grades), and learners' progress, notes and Q&A for them will be permanently deleted."
            : "The lesson, its video and files, and learners' progress, notes and Q&A for it will be permanently deleted."
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
