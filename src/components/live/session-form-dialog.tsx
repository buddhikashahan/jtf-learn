"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { addDays, format, setHours, setMinutes } from "date-fns";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { useProfile } from "@/components/providers/auth-provider";
import { createLiveSession, updateLiveSession } from "@/lib/services/live";
import { getErrorMessage } from "@/lib/errors";
import { liveSessionSchema, type LiveSessionInput } from "@/lib/validation";
import { toDate } from "@/lib/utils";
import type { Course, LiveSession, WithId } from "@/types";

function defaults(session?: WithId<LiveSession>, courseId?: string): LiveSessionInput {
  const start = toDate(session?.startAt) ?? setMinutes(setHours(addDays(new Date(), 1), 18), 0);
  return {
    courseId: session?.courseId ?? courseId ?? "",
    title: session?.title ?? "",
    description: session?.description ?? "",
    startAt: format(start, "yyyy-MM-dd'T'HH:mm"),
    durationMinutes: session?.durationMinutes ?? 60,
    meetingUrl: session?.meetingUrl ?? "",
    recordingUrl: session?.recordingUrl ?? "",
  };
}

export function SessionFormDialog({
  open,
  onOpenChange,
  courses,
  session,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: WithId<Course>[];
  session?: WithId<LiveSession>;
}) {
  const profile = useProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LiveSessionInput>({
    resolver: zodResolver(liveSessionSchema),
    defaultValues: defaults(session, courses[0]?.id),
  });

  useEffect(() => {
    if (open) reset(defaults(session, courses[0]?.id));
  }, [open, session, courses, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (session) {
        await updateLiveSession(session, values);
        toast.success("Session updated");
      } else {
        const course = courses.find((c) => c.id === values.courseId);
        if (!course) throw new Error("Course not found");
        await createLiveSession(values, course, profile);
        toast.success("Live class scheduled");
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
      title={session ? "Edit live class" : "Schedule a live class"}
      size="lg"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="session-form" loading={isSubmitting}>
            {session ? "Save changes" : "Schedule"}
          </Button>
        </>
      }
    >
      <form method="post" id="session-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Course" required error={errors.courseId?.message}>
          <Select disabled={Boolean(session)} {...register("courseId")}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Title" required error={errors.title?.message}>
          <Input placeholder="e.g. Live Q&A: Battery Thermal Runaway" {...register("title")} />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={3} placeholder="What will be covered?" {...register("description")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start time" required error={errors.startAt?.message}>
            <Input type="datetime-local" {...register("startAt")} />
          </FormField>
          <FormField label="Duration (minutes)" required error={errors.durationMinutes?.message}>
            <Input type="number" min={5} max={600} step={5} {...register("durationMinutes", { valueAsNumber: true })} />
          </FormField>
        </div>
        <FormField label="Meeting link" required error={errors.meetingUrl?.message} hint="Zoom, Google Meet or Microsoft Teams link learners will join.">
          <Input type="url" placeholder="https://zoom.us/j/… or https://meet.google.com/…" {...register("meetingUrl")} />
        </FormField>
        <FormField label="Recording link" error={errors.recordingUrl?.message} hint="Optional — you can also add a link or upload a video from the class page after it ends.">
          <Input type="url" placeholder="https://…" {...register("recordingUrl")} />
        </FormField>
      </form>
    </Dialog>
  );
}
