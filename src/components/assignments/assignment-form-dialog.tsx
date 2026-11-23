"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { addDays, format, setHours, setMinutes } from "date-fns";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/form";
import { useProfile } from "@/components/providers/auth-provider";
import { useCurriculum } from "@/hooks/use-lms";
import { createAssignment, updateAssignment } from "@/lib/services/assignments";
import { getErrorMessage } from "@/lib/errors";
import { assignmentSchema, type AssignmentInput } from "@/lib/validation";
import { toDate } from "@/lib/utils";
import type { Assignment, Course, WithId } from "@/types";

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

function defaults(assignment?: WithId<Assignment>, courseId?: string, moduleId?: string): AssignmentInput {
  const due = toDate(assignment?.dueAt) ?? setMinutes(setHours(addDays(new Date(), 7), 23), 59);
  const points = assignment?.points ?? 20;
  // New module coursework defaults to "required" with a 50% pass mark.
  const isNewCoursework = !assignment && Boolean(moduleId);
  return {
    courseId: assignment?.courseId ?? courseId ?? "",
    title: assignment?.title ?? "",
    description: assignment?.description ?? "",
    dueAt: format(due, LOCAL_FORMAT),
    points,
    moduleId: assignment?.moduleId ?? moduleId ?? "",
    required: assignment?.required ?? isNewCoursework,
    passMark: assignment?.passMark ?? (isNewCoursework ? Math.ceil(points / 2) : 0),
  };
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  courses,
  assignment,
  defaultCourseId,
  defaultModuleId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: WithId<Course>[];
  assignment?: WithId<Assignment>;
  /** Preselect a course / module when adding coursework from the curriculum. */
  defaultCourseId?: string;
  defaultModuleId?: string;
}) {
  const profile = useProfile();
  const initialCourse = defaultCourseId ?? courses[0]?.id;
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentInput>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: defaults(assignment, initialCourse, defaultModuleId),
  });

  useEffect(() => {
    if (open) reset(defaults(assignment, initialCourse, defaultModuleId));
  }, [open, assignment, initialCourse, defaultModuleId, reset]);

  const courseId = useWatch({ control, name: "courseId" });
  const required = useWatch({ control, name: "required" });
  const points = useWatch({ control, name: "points" });
  const { outline } = useCurriculum(open && courseId ? courseId : null);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (assignment) {
        await updateAssignment(assignment, values);
        toast.success("Saved");
      } else {
        const course = courses.find((c) => c.id === values.courseId);
        if (!course) throw new Error("Course not found");
        await createAssignment(values, course, profile);
        toast.success(values.moduleId ? "Coursework published" : "Assignment published");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={assignment ? "Edit coursework" : "New coursework"}
      description={assignment ? undefined : "Enrolled learners are notified and see it in their assignments list."}
      size="lg"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-form" loading={isSubmitting}>
            {assignment ? "Save changes" : "Publish"}
          </Button>
        </>
      }
    >
      <form method="post" id="assignment-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Course" required error={errors.courseId?.message}>
            <Select disabled={Boolean(assignment)} {...register("courseId")}>
              {courses.length === 0 && <option value="">No courses available</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ` : ""}
                  {c.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Module" error={errors.moduleId?.message} hint="Link it to a module to make it that module's coursework.">
            <Select {...register("moduleId")}>
              <option value="">Whole course (no module)</option>
              {outline.map((m, i) => (
                <option key={m.id} value={m.id}>
                  Module {i + 1}: {m.title}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Title" required error={errors.title?.message}>
          <Input placeholder="e.g. Battery Pack Thermal Analysis Worksheet" {...register("title")} />
        </FormField>
        <FormField label="Instructions" error={errors.description?.message}>
          <Textarea rows={5} placeholder="Describe what learners must submit and how it will be assessed." {...register("description")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Due date" required error={errors.dueAt?.message}>
            <Input type="datetime-local" {...register("dueAt")} />
          </FormField>
          <FormField label="Total points" required error={errors.points?.message}>
            <Input
              type="number"
              min={1}
              max={1000}
              {...register("points", { valueAsNumber: true })}
            />
          </FormField>
          <FormField label="Pass mark" error={errors.passMark?.message} hint={points ? `Out of ${points} points` : undefined}>
            <Input type="number" min={0} max={1000} step="0.5" {...register("passMark", { valueAsNumber: true })} />
          </FormField>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <Checkbox
            label="Required to complete the course"
            {...register("required", {
              onChange: (e) => {
                // Give required coursework a sensible pass mark if none is set yet.
                if (e.target.checked && !(getValues("passMark") > 0)) {
                  setValue("passMark", Math.ceil((getValues("points") || 0) / 2), { shouldValidate: true });
                }
              },
            })}
          />
          <p className="mt-1.5 pl-[26px] text-xs text-slate-500">
            {required
              ? "Learners can't finish the course or get a certificate until this is graded at or above the pass mark. Work below the pass mark can be resubmitted."
              : "Optional — it doesn't block course completion."}
          </p>
        </div>
      </form>
    </Dialog>
  );
}
