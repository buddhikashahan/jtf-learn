"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Megaphone, MoreHorizontal, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/components/providers/auth-provider";
import { useAnnouncementsFor } from "@/hooks/use-lms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, FormField, Input, Textarea } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Markdown } from "@/components/learn/markdown";
import { deleteAnnouncement, postAnnouncement, togglePinned } from "@/lib/services/announcements";
import { getErrorMessage } from "@/lib/errors";
import { announcementSchema, type AnnouncementInput } from "@/lib/validation";
import { cn, timeAgo } from "@/lib/utils";
import type { Announcement, Course, WithId } from "@/types";

export function AnnouncementCard({
  item,
  courseId,
  canManage = false,
  showCourse = false,
  compact = false,
}: {
  item: WithId<Announcement>;
  courseId: string;
  canManage?: boolean;
  showCourse?: boolean;
  compact?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <article className={cn("rounded-xl border bg-surface p-4", item.pinned ? "border-brand-200 bg-brand-50/30" : "border-slate-200")}>
      <header className="flex items-start gap-3">
        <Avatar name={item.authorName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            {item.pinned && (
              <Badge tone="brand">
                <Pin className="size-3" /> Pinned
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {item.authorName} · {timeAgo(item.createdAt)}
            {showCourse && item.courseTitle ? ` · ${item.courseTitle}` : ""}
          </p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Announcement actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => togglePinned(courseId, item).catch((e) => toast.error(getErrorMessage(e)))}>
                {item.pinned ? <PinOff /> : <Pin />} {item.pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      <div className={cn("mt-3", compact && "line-clamp-3")}>
        {compact ? (
          <p className="text-sm text-slate-600">{item.body.replace(/[#*_>`]/g, "")}</p>
        ) : (
          <Markdown content={item.body} className="prose-sm" />
        )}
      </div>
      {canManage && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title="Delete this announcement?"
          description="Learners will no longer see it."
          confirmLabel="Delete"
          onConfirm={() => deleteAnnouncement(courseId, item.id)}
        />
      )}
    </article>
  );
}

/** Course-page section: list (+ composer for staff). */
export function CourseAnnouncements({ course, canManage }: { course: WithId<Course>; canManage: boolean }) {
  const ids = useMemo(() => [course.id], [course.id]);
  const { data, loading } = useAnnouncementsFor(ids, 20);
  const profile = useProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", pinned: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await postAnnouncement(course, values, profile);
      reset({ title: "", body: "", pinned: false });
      toast.success("Announcement posted — learners have been notified");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Post an announcement</CardTitle>
              <CardDescription>Every enrolled learner gets an in-app notification.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form method="post" onSubmit={onSubmit} noValidate className="space-y-3">
              <FormField label="Title" required error={errors.title?.message}>
                <Input placeholder="e.g. Workshop moved to Bay 3 this Friday" {...register("title")} />
              </FormField>
              <FormField label="Message" required error={errors.body?.message} hint="Markdown supported.">
                <Textarea rows={4} {...register("body")} />
              </FormField>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox label="Pin to the top of the course" {...register("pinned")} />
                <Button type="submit" loading={isSubmitting}>
                  <Send /> Post announcement
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <Skeleton className="h-28 w-full" />
      ) : data.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" className="py-8" />
      ) : (
        data.map((a) => <AnnouncementCard key={a.id} item={a} courseId={course.id} canManage={canManage} />)
      )}
    </div>
  );
}
