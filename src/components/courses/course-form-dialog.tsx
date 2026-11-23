"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/form";
import { useProfile } from "@/components/providers/auth-provider";
import { createCourse, updateCourse } from "@/lib/services/courses";
import { getErrorMessage } from "@/lib/errors";
import { courseSchema, type CourseInput } from "@/lib/validation";
import { toDate } from "@/lib/utils";
import type { Course, WithId } from "@/types";

function defaults(course?: WithId<Course>): CourseInput {
  const start = toDate(course?.startDate);
  return {
    title: course?.title ?? "",
    code: course?.code ?? "",
    description: course?.description ?? "",
    category: course?.category ?? "",
    level: course?.level ?? "beginner",
    status: course?.status ?? "draft",
    cohort: course?.cohort ?? "",
    startDate: start ? format(start, "yyyy-MM-dd") : "",
    allowSelfEnroll: course?.allowSelfEnroll ?? false,
    requiredWatchPercent: course?.requiredWatchPercent ?? 90,
    sequential: course?.sequential ?? false,
  };
}

/** Shared create / edit course form. */
export function CourseForm({
  course,
  onSaved,
  onCancel,
  submitLabel,
}: {
  course?: WithId<Course>;
  onSaved?: (courseId: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const profile = useProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CourseInput>({ resolver: zodResolver(courseSchema), defaultValues: defaults(course) });

  useEffect(() => {
    reset(defaults(course));
  }, [course, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (course) {
        await updateCourse(course, values, profile);
        toast.success("Course updated");
        onSaved?.(course.id);
      } else {
        const id = await createCourse(values, profile);
        toast.success("Course created");
        onSaved?.(id);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField label="Course title" required error={errors.title?.message}>
        <Input placeholder="e.g. Electric Vehicle Technology" {...register("title")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Course code" error={errors.code?.message} hint="Short identifier, e.g. JET-EV-101">
          <Input className="font-mono uppercase" placeholder="JET-EV-101" {...register("code")} />
        </FormField>
        <FormField label="Category" error={errors.category?.message}>
          <Input placeholder="Automotive" {...register("category")} />
        </FormField>
      </div>
      <FormField label="Description" error={errors.description?.message}>
        <Textarea rows={4} placeholder="What will learners achieve in this course?" {...register("description")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Level" error={errors.level?.message}>
          <Select {...register("level")}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </FormField>
        <FormField label="Status" error={errors.status?.message}>
          <Select {...register("status")}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </FormField>
        <FormField label="Start date" error={errors.startDate?.message}>
          <Input type="date" {...register("startDate")} />
        </FormField>
      </div>
      <FormField label="Cohort" error={errors.cohort?.message}>
        <Input placeholder="Cohort 4 — 2026" {...register("cohort")} />
      </FormField>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Learning rules</legend>
        <FormField
          label="Video watch requirement"
          error={errors.requiredWatchPercent?.message}
          hint="Learners can't skip ahead in videos and must watch this much before completing a video lesson."
        >
          <Select {...register("requiredWatchPercent", { valueAsNumber: true })}>
            <option value={100}>100% — the whole video</option>
            <option value={90}>90% (recommended)</option>
            <option value={75}>75%</option>
            <option value={50}>50%</option>
            <option value={0}>Off — completion not tied to watching</option>
          </Select>
        </FormField>
        <Checkbox label="Unlock lessons in order (learners must complete each lesson before the next)" {...register("sequential")} />
        <Checkbox label="Allow learners to self-enrol from the catalog" {...register("allowSelfEnroll")} />
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} disabled={Boolean(course) && !isDirty}>
          {submitLabel ?? (course ? "Save changes" : "Create course")}
        </Button>
      </div>
    </form>
  );
}

export function CourseFormDialog({
  open,
  onOpenChange,
  course,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course?: WithId<Course>;
  onSaved?: (courseId: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={course ? "Edit course" : "Create a new course"}
      description={course ? undefined : "You can add modules and lessons after creating the course."}
      size="lg"
    >
      <CourseForm
        course={course}
        onCancel={() => onOpenChange(false)}
        onSaved={(id) => {
          onOpenChange(false);
          onSaved?.(id);
        }}
      />
    </Dialog>
  );
}
