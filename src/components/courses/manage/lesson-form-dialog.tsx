"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, FileText, Paperclip, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Skeleton } from "@/components/ui/feedback";
import { SegmentedTabsList, SegmentedTabsTrigger, Tabs, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/learn/markdown";
import { useDocument } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import {
  addLessonResource,
  createLesson,
  newLessonId,
  removeLessonResource,
  updateLesson,
  uploadLessonVideo,
} from "@/lib/services/curriculum";
import { getErrorMessage } from "@/lib/errors";
import { aiErrorMessage, generateTranscript, storageVideoUri } from "@/lib/services/ai";
import { usePlatformSettings } from "@/hooks/use-platform";
import { lessonSchema, validateFile, type LessonInput } from "@/lib/validation";
import { formatBytes, safeExternalUrl } from "@/lib/utils";
import { readVideoDuration } from "@/lib/media";
import type { Lesson, LessonContent, LessonResource, WithId } from "@/types";

const EMPTY: LessonInput = { title: "", type: "video", durationMinutes: 10, videoUrl: "", body: "", transcript: "" };

function ResourcesManager({ courseId, lessonId, resources }: { courseId: string; lessonId: string; resources: LessonResource[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setProgress(0);
    try {
      await addLessonResource(courseId, lessonId, file, setProgress);
      toast.success("Resource added");
      setFile(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      {resources.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {resources.map((r) => (
            <li key={r.url} className="flex items-center gap-3 px-3 py-2">
              <FileText className="size-4 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.name}</span>
              <span className="text-xs text-slate-400">{formatBytes(r.size)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${r.name}`}
                loading={removing === r.url}
                onClick={async () => {
                  setRemoving(r.url);
                  try {
                    await removeLessonResource(courseId, lessonId, r);
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  } finally {
                    setRemoving(null);
                  }
                }}
              >
                {removing !== r.url && <Trash2 />}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FileDropzone kind="lessonResource" file={file} onFileChange={setFile} progress={progress} disabled={progress !== null} hint="PDF, slides, worksheets, ZIP — up to 500 MB" />
      {file && (
        <Button variant="outline" onClick={upload} loading={progress !== null} className="w-full">
          <Upload /> Upload resource
        </Button>
      )}
    </div>
  );
}

export function LessonFormDialog({
  open,
  onOpenChange,
  courseId,
  moduleId,
  order,
  lesson,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  moduleId: string;
  order: number;
  lesson?: WithId<Lesson>;
}) {
  const isEdit = Boolean(lesson);
  const [draftId] = useState(() => lesson?.id ?? newLessonId(courseId));
  const lessonId = lesson?.id ?? draftId;
  const contentRef = useMemo(() => (lesson ? refs.lessonContent(courseId, lesson.id) : null), [courseId, lesson]);
  const content = useDocument<LessonContent>(contentRef);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const platform = usePlatformSettings();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LessonInput>({ resolver: zodResolver(lessonSchema), defaultValues: EMPTY });

  const contentLoaded = !isEdit || !content.loading;
  useEffect(() => {
    if (!contentLoaded) return;
    reset(
      lesson
        ? {
            title: lesson.title,
            type: lesson.type,
            durationMinutes: lesson.durationMinutes,
            videoUrl: content.data?.videoUrl ?? "",
            body: content.data?.body ?? "",
            transcript: content.data?.transcript ?? "",
            videoDurationSeconds: lesson.videoDurationSeconds || undefined,
          }
        : EMPTY,
    );
    // Only reset when the dialog's subject changes, not on every content snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, contentLoaded, reset]);

  const type = useWatch({ control, name: "type" });
  const body = useWatch({ control, name: "body" });
  const videoUrl = useWatch({ control, name: "videoUrl" });

  async function onVideoFile(file: File | null) {
    if (!file) return;
    const problem = validateFile(file, "lessonResource");
    if (problem || !file.type.startsWith("video/")) {
      toast.error(problem ?? "Please choose an MP4 or WebM video.");
      return;
    }
    setVideoProgress(0);
    try {
      const [url, seconds] = await Promise.all([
        uploadLessonVideo(courseId, lessonId, file, setVideoProgress),
        readVideoDuration(file),
      ]);
      setUploadedUrl(url);
      setValue("videoUrl", url, { shouldDirty: true, shouldValidate: true });
      if (seconds) {
        setValue("videoDurationSeconds", Math.round(seconds), { shouldDirty: true });
        setValue("durationMinutes", Math.max(1, Math.round(seconds / 60)), { shouldDirty: true });
      }
      toast.success("Video uploaded — save the lesson to apply it.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setVideoProgress(null);
    }
  }

  const onSubmit = handleSubmit(async (raw) => {
    // A pasted (non-uploaded) URL invalidates the stored duration; staff
    // previews of the lesson re-capture it automatically.
    const urlChanged = raw.videoUrl !== (content.data?.videoUrl ?? "") && raw.videoUrl !== uploadedUrl;
    const values = urlChanged ? { ...raw, videoDurationSeconds: undefined } : raw;
    try {
      if (lesson) await updateLesson(courseId, lesson.id, values);
      else await createLesson(courseId, moduleId, order, values, draftId);
      toast.success(isEdit ? "Lesson updated" : "Lesson added");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const busy = isSubmitting || videoProgress !== null || transcribing;

  async function transcribe() {
    setTranscribing(true);
    try {
      const text = await generateTranscript(videoUrl, (partial) => setValue("transcript", partial, { shouldDirty: true }));
      setValue("transcript", text, { shouldDirty: true });
      toast.success("Transcript generated — review it, then save the lesson.");
    } catch (error) {
      toast.error(aiErrorMessage(error));
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit lesson" : "Add lesson"}
      size="xl"
      dismissible={!busy}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="lesson-form" loading={isSubmitting} disabled={busy}>
            {isEdit ? "Save lesson" : "Add lesson"}
          </Button>
        </>
      }
    >
      {!contentLoaded ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <form method="post" id="lesson-form" onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_160px_140px]">
            <FormField label="Lesson title" required error={errors.title?.message}>
              <Input placeholder="e.g. Reading CAN frames" {...register("title")} />
            </FormField>
            <FormField label="Type" error={errors.type?.message}>
              <Select {...register("type")}>
                <option value="video">Video</option>
                <option value="article">Reading</option>
              </Select>
            </FormField>
            <FormField label="Duration (min)" error={errors.durationMinutes?.message}>
              <Input type="number" min={0} max={1000} {...register("durationMinutes", { valueAsNumber: true })} />
            </FormField>
          </div>

          {type === "video" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <FormField
                label="Video URL"
                error={errors.videoUrl?.message}
                hint="YouTube, Vimeo, or a direct MP4/WebM link — or upload a file below."
              >
                <Input placeholder="https://www.youtube.com/watch?v=…" {...register("videoUrl")} />
              </FormField>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  <Upload className="size-4" />
                  {videoProgress !== null ? `Uploading… ${videoProgress}%` : "Upload video file"}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      void onVideoFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                {safeExternalUrl(videoUrl) && (
                  <a href={safeExternalUrl(videoUrl)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                    <Download className="size-3.5" /> Open current video
                  </a>
                )}
              </div>
            </div>
          )}

          {type === "video" && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="lesson-transcript" className="text-sm font-medium text-slate-700">
                  Video transcript <span className="font-normal text-slate-400">(used by the AI study assistant)</span>
                </label>
                {platform.aiAssistantEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={transcribe}
                    loading={transcribing}
                    disabled={busy || !storageVideoUri(videoUrl)}
                    title={
                      storageVideoUri(videoUrl)
                        ? "Generate a timestamped transcript from the uploaded video"
                        : "Available for videos uploaded to the platform. For YouTube/Vimeo, paste the transcript."
                    }
                  >
                    <Sparkles /> Generate with AI
                  </Button>
                )}
              </div>
              <Textarea
                id="lesson-transcript"
                rows={5}
                className="font-mono text-[13px]"
                placeholder={"[00:00] Welcome to this lesson…\n[00:25] First, isolate the high-voltage system…"}
                {...register("transcript")}
              />
              {errors.transcript && <p className="mt-1 text-xs text-red-600">{errors.transcript.message}</p>}
              <p className="mt-1 text-xs text-slate-500">
                With a transcript, learners can ask the AI assistant about anything said or shown in the video. Timestamps like [02:15] let it point to the right moment.
              </p>
            </div>
          )}

          <Tabs defaultValue="write">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Lesson content</span>
              <SegmentedTabsList>
                <SegmentedTabsTrigger value="write">Write</SegmentedTabsTrigger>
                <SegmentedTabsTrigger value="preview">Preview</SegmentedTabsTrigger>
              </SegmentedTabsList>
            </div>
            <TabsContent value="write" className="pt-0">
              <Textarea
                rows={12}
                className="font-mono text-[13px]"
                placeholder={"## Overview\n\nWrite lesson notes using **Markdown**…"}
                aria-label="Lesson content (Markdown)"
                {...register("body")}
              />
              {errors.body && <p className="mt-1 text-xs text-red-600">{errors.body.message}</p>}
              <p className="mt-1 text-xs text-slate-500">Supports Markdown: headings, lists, links, tables, code.</p>
            </TabsContent>
            <TabsContent value="preview" className="min-h-60 rounded-lg border border-slate-200 p-4 pt-4">
              {body?.trim() ? <Markdown content={body} /> : <p className="text-sm text-slate-400">Nothing to preview.</p>}
            </TabsContent>
          </Tabs>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Paperclip className="size-4 text-slate-400" /> Downloadable resources
            </div>
            {isEdit && lesson ? (
              <ResourcesManager courseId={courseId} lessonId={lesson.id} resources={content.data?.resources ?? []} />
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Save the lesson first, then edit it to attach slides, worksheets and other files.
              </p>
            )}
          </div>
        </form>
      )}
    </Dialog>
  );
}
