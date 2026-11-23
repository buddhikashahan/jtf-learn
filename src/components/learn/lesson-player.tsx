"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eye,
  FileText,
  ListTree,
  Lock,
  MessageCircle,
  NotebookPen,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/providers/theme";
import { useCourse, useCourseCoursework, useCurriculum, useEnrollment } from "@/hooks/use-lms";
import { useDocument } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import { setLastLesson, setLessonCompleted } from "@/lib/services/enrollments";
import { getErrorMessage } from "@/lib/errors";
import { cn, formatBytes, formatMinutes, safeExternalUrl } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/dialog";
import { Alert, EmptyState, FullPageLoader, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurriculumList } from "@/components/courses/curriculum-list";
import { StatusScreen } from "@/components/auth/auth-guard";
import { Markdown } from "./markdown";
import { LessonNotes } from "./lesson-notes";
import { LessonDiscussion } from "./lesson-discussion";
import { LessonVideo, hasWatchedEnough, requiredWatchPercent } from "./lesson-video";
import { AiAssistant } from "./ai-assistant";
import { usePlatformSettings } from "@/hooks/use-platform";
import type { LessonContent, LessonProgress } from "@/types";

const TABS = ["overview", "resources", "notes", "discussion"] as const;
type Tab = (typeof TABS)[number];

export function LessonPlayer({ routeParams }: { routeParams: Promise<{ courseId: string; lesson?: string[] }> }) {
  const params = use(routeParams);
  const search = useSearchParams();
  const courseId = params.courseId;
  const lessonParam = params.lesson?.[0] ?? null;
  const router = useRouter();
  const profile = useProfile();
  const { isAdmin } = useAuth();
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestedTab = search.get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : "overview");

  const platform = usePlatformSettings();
  // Latest playback position, read by the AI assistant when a question is sent.
  const videoPosition = useRef<number | null>(null);

  const course = useCourse(courseId);
  const enrollment = useEnrollment(courseId, profile.uid);
  const curriculum = useCurriculum(courseId, Boolean(course.data));
  const coursework = useCourseCoursework(courseId, {
    enabled: Boolean(course.data) && (Boolean(enrollment.data) || profile.role !== "student"),
    asLearner: Boolean(enrollment.data),
  });

  const c = course.data;
  const e = enrollment.data;
  const canManage = Boolean(c && (isAdmin || (profile.role === "instructor" && c.instructorIds.includes(profile.uid))));
  const hasAccess = Boolean(e) || canManage;

  const lessons = curriculum.orderedLessons;
  const currentId = lessonParam ?? e?.lastLessonId ?? lessons[0]?.id ?? null;
  const index = lessons.findIndex((l) => l.id === currentId);
  const lesson = index >= 0 ? lessons[index] : null;
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;
  const currentModule = lesson ? curriculum.outline.find((m) => m.id === lesson.moduleId) : null;

  const contentRef = useMemo(
    () => (hasAccess && lesson ? refs.lessonContent(courseId, lesson.id) : null),
    [hasAccess, lesson, courseId],
  );
  const content = useDocument<LessonContent>(contentRef);

  const progressRef = useMemo(
    () => (e && lesson?.hasVideo ? refs.lessonProgress(courseId, profile.uid, lesson.id) : null),
    [e, lesson, courseId, profile.uid],
  );
  const progress = useDocument<LessonProgress>(progressRef);

  const completedIds = useMemo(() => new Set(e?.completedLessonIds ?? []), [e?.completedLessonIds]);
  const isCompleted = lesson ? completedIds.has(lesson.id) : false;

  // Sequential courses: everything after the first incomplete lesson is locked.
  const lockedIds = useMemo(() => {
    const locked = new Set<string>();
    if (!c?.sequential || !e) return locked;
    const firstOpen = lessons.findIndex((l) => !completedIds.has(l.id));
    if (firstOpen === -1) return locked;
    lessons.slice(firstOpen + 1).forEach((l) => locked.add(l.id));
    return locked;
  }, [c?.sequential, e, lessons, completedIds]);
  const isLocked = lesson ? lockedIds.has(lesson.id) : false;
  const firstOpenLesson = lessons.find((l) => !lockedIds.has(l.id) && !completedIds.has(l.id));

  const watchedEnough = c && lesson ? hasWatchedEnough(c, lesson, progress.data) : true;
  const canComplete = !lesson?.hasVideo || watchedEnough;

  // Remember where the learner left off.
  const lastLessonId = e?.lastLessonId;
  const lessonId = lesson?.id;
  const enrolled = Boolean(e);
  useEffect(() => {
    if (enrolled && lessonId && !isLocked && lastLessonId !== lessonId) {
      setLastLesson(courseId, profile.uid, lessonId).catch(() => undefined);
    }
  }, [enrolled, lessonId, isLocked, lastLessonId, courseId, profile.uid]);

  // Keyboard shortcuts: Alt+→ next lesson, Alt+← previous lesson.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!ev.altKey) return;
      if (ev.key === "ArrowRight" && next && !lockedIds.has(next.id)) router.push(`/learn/${courseId}/${next.id}`);
      if (ev.key === "ArrowLeft" && prev) router.push(`/learn/${courseId}/${prev.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, lockedIds, router, courseId]);

  if (course.loading || enrollment.loading || (c && curriculum.loading)) {
    return <FullPageLoader label="Loading lesson" />;
  }

  if (!c || !hasAccess) {
    return (
      <StatusScreen
        icon={Lock}
        title="You don't have access to this course"
        description="Enrol in the course to start learning. If you think this is a mistake, contact your administrator."
        action={
          <Link href={c ? `/courses/${c.id}` : "/courses"} className={buttonVariants()}>
            {c ? "View course" : "Browse courses"}
          </Link>
        }
      />
    );
  }

  const hrefFor = (id: string) => `/learn/${courseId}/${id}`;
  const required = requiredWatchPercent(c);

  async function complete(value: boolean, goNext: boolean) {
    if (!e || !lesson || !c) return;
    setBusy(true);
    try {
      await setLessonCompleted(c, e, lesson.id, value, lessons.map((l) => l.id), profile);
      if (goNext && next) router.push(hrefFor(next.id));
      else if (value && !next) toast.success("Lesson completed 🎉");
    } catch (error) {
      toast.error(
        lesson.hasVideo && !watchedEnough
          ? `Watch at least ${required}% of the video to complete this lesson.`
          : getErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function autoComplete() {
    if (!e || !lesson || !c || completedIds.has(lesson.id)) return;
    try {
      await setLessonCompleted(c, e, lesson.id, true, lessons.map((l) => l.id), profile);
      toast.success("Nice work! Lesson marked as complete.", {
        action: next ? { label: "Next lesson", onClick: () => router.push(hrefFor(next.id)) } : undefined,
      });
    } catch {
      /* the learner can still complete manually */
    }
  }

  const outline = (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-4">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Course progress</p>
        {e ? (
          <>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-2xl font-semibold text-slate-900">{e.progress}%</span>
              <span className="text-xs text-slate-500">
                {lessons.filter((l) => completedIds.has(l.id)).length} of {lessons.length} lessons
                {coursework.requiredTotal > 0 && ` · ${coursework.requiredPassed}/${coursework.requiredTotal} coursework`}
              </span>
            </div>
            <ProgressBar value={e.progress} className="mt-2" />
            {e.status === "completed" && (
              <Link
                href={`/certificates/${courseId}`}
                className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3 w-full" })}
              >
                <Award /> View certificate
              </Link>
            )}
            {e.status !== "completed" &&
              coursework.requiredTotal > coursework.requiredPassed &&
              lessons.length > 0 &&
              lessons.every((l) => completedIds.has(l.id)) && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Almost there!</p>
                  <p className="mt-0.5">
                    You&apos;ve finished every lesson. Pass the remaining required coursework to complete the course.
                  </p>
                  <Link href="/assignments" className="mt-1.5 inline-block font-semibold underline underline-offset-2">
                    Go to coursework
                  </Link>
                </div>
              )}
            {c.sequential && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="size-3.5" /> Lessons unlock in order
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Preview mode — progress isn&apos;t tracked.</p>
        )}
      </div>
      <CurriculumList
        outline={curriculum.outline}
        completedIds={e ? completedIds : undefined}
        lockedIds={lockedIds}
        activeLessonId={lesson?.id}
        hrefFor={hrefFor}
        coursework={coursework.items}
        courseworkHref={e ? "/assignments" : undefined}
        dense
      />
    </div>
  );

  const resources = content.data?.resources ?? [];
  const nextLocked = next ? lockedIds.has(next.id) : false;

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-surface/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Link
            href={`/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="h-6 w-px bg-slate-200" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{c.title}</p>
            {c.code && <p className="truncate font-mono text-xs text-slate-500">{c.code}</p>}
          </div>
          {e && (
            <div className="hidden w-48 items-center gap-3 md:flex">
              <ProgressBar value={e.progress} className="h-1.5" />
              <span className="text-xs font-medium text-slate-600 tabular-nums">{e.progress}%</span>
            </div>
          )}
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOutlineOpen(true)}>
            <ListTree /> Content
          </Button>
          <ThemeToggle className="hidden sm:inline-flex" />
          <Avatar name={profile.displayName} src={profile.photoURL} size="sm" className="hidden sm:inline-flex" />
        </div>
      </header>

      <Sheet open={outlineOpen} onOpenChange={setOutlineOpen} title="Course content">
        <div
          className="overflow-y-auto"
          onClick={(ev) => (ev.target as HTMLElement).closest("a") && setOutlineOpen(false)}
        >
          {outline}
        </div>
      </Sheet>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <main id="main-content" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {!e && (
            <Alert tone="info" icon={Eye} className="mb-5">
              You&apos;re previewing this course as {profile.role === "instructor" ? "an instructor" : "an administrator"}.
            </Alert>
          )}

          {!lesson ? (
            <EmptyState icon={FileText} title="No lessons yet" description="This course doesn't have any lessons published." />
          ) : isLocked ? (
            <div className="mx-auto max-w-xl py-16 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100">
                <Lock className="size-7 text-slate-500" />
              </div>
              <h1 className="mt-5 text-xl font-semibold text-slate-900">This lesson is locked</h1>
              <p className="mt-2 text-sm text-slate-500">
                Lessons in this course unlock in order. Complete
                {firstOpenLesson ? ` “${firstOpenLesson.title}”` : " the previous lessons"} to continue.
              </p>
              {firstOpenLesson && (
                <Link href={hrefFor(firstOpenLesson.id)} className={buttonVariants({ className: "mt-6" })}>
                  Go to next available lesson <ChevronRight />
                </Link>
              )}
            </div>
          ) : (
            <article className="mx-auto max-w-4xl">
              {lesson.type === "video" && (
                <div className="mb-6">
                  {content.loading || (progressRef && progress.loading) ? (
                    <Skeleton className="aspect-video w-full rounded-xl" />
                  ) : (
                    <LessonVideo
                      key={lesson.id}
                      course={c}
                      lesson={lesson}
                      url={content.data?.videoUrl}
                      uid={profile.uid}
                      progress={progress.data}
                      tracking={Boolean(e)}
                      canManage={canManage}
                      onWatchedEnough={autoComplete}
                      onPosition={(seconds) => {
                        videoPosition.current = seconds;
                      }}
                    />
                  )}
                </div>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {currentModule && (
                    <p className="text-sm font-medium text-brand-600">
                      Module {curriculum.outline.indexOf(currentModule) + 1} · {currentModule.title}
                    </p>
                  )}
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{lesson.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <Badge tone={lesson.type === "video" ? "info" : "success"}>
                      {lesson.type === "video" ? "Video" : "Reading"}
                    </Badge>
                    {lesson.durationMinutes > 0 && <span>{formatMinutes(lesson.durationMinutes)}</span>}
                    <span>
                      · Lesson {index + 1} of {lessons.length}
                    </span>
                  </div>
                </div>
                {e && (
                  <Button
                    variant={isCompleted ? "secondary" : "outline"}
                    onClick={() => complete(!isCompleted, false)}
                    loading={busy}
                    disabled={!isCompleted && !canComplete}
                    title={!canComplete ? `Watch ${required}% of the video to complete` : undefined}
                    className={cn("shrink-0", isCompleted && "text-emerald-700")}
                    aria-pressed={isCompleted}
                  >
                    {!busy &&
                      (isCompleted ? (
                        <CheckCircle2 className="text-emerald-600" />
                      ) : canComplete ? (
                        <Circle />
                      ) : (
                        <Lock />
                      ))}
                    {isCompleted ? "Completed" : canComplete ? "Mark as complete" : `Watch ${required}% to complete`}
                  </Button>
                )}
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
                <TabsList>
                  <TabsTrigger value="overview">
                    <FileText /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="resources">
                    <Paperclip /> Resources {resources.length > 0 && `(${resources.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    <NotebookPen /> My notes
                  </TabsTrigger>
                  <TabsTrigger value="discussion">
                    <MessageCircle /> Q&amp;A
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  {content.loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : content.data?.body?.trim() ? (
                    <Markdown content={content.data.body} />
                  ) : (
                    <p className="text-sm text-slate-500">No written content for this lesson.</p>
                  )}
                </TabsContent>

                <TabsContent value="resources">
                  {resources.length === 0 ? (
                    <EmptyState icon={Paperclip} title="No resources" description="This lesson has no downloadable files." className="py-8" />
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-surface">
                      {resources.map((r) => {
                        const href = safeExternalUrl(r.url);
                        return (
                          <li key={r.url} className="flex items-center gap-3 px-4 py-3">
                            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                              <FileText className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                              <p className="text-xs text-slate-500">{formatBytes(r.size)}</p>
                            </div>
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                                <Download /> Open
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="notes">
                  <LessonNotes uid={profile.uid} courseId={courseId} lessonId={lesson.id} />
                </TabsContent>

                <TabsContent value="discussion">
                  <LessonDiscussion course={c} lesson={lesson} canModerate={canManage} />
                </TabsContent>
              </Tabs>

              <nav
                aria-label="Lesson navigation"
                className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between"
              >
                {prev ? (
                  <Link href={hrefFor(prev.id)} className={buttonVariants({ variant: "outline", className: "justify-start" })}>
                    <ChevronLeft />
                    <span className="truncate">Previous: {prev.title}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {next &&
                  (e && !isCompleted ? (
                    <Button
                      onClick={() => complete(true, true)}
                      loading={busy}
                      disabled={!canComplete}
                      title={!canComplete ? `Watch ${required}% of the video first` : undefined}
                    >
                      {canComplete ? "Complete & continue" : `Watch ${required}% to continue`} <ChevronRight />
                    </Button>
                  ) : nextLocked ? (
                    <Button disabled>
                      <Lock /> Next lesson locked
                    </Button>
                  ) : (
                    <Link href={hrefFor(next.id)} className={buttonVariants()}>
                      <span className="truncate">Next: {next.title}</span>
                      <ChevronRight />
                    </Link>
                  ))}
              </nav>
              <p className="mt-4 hidden text-center text-xs text-slate-400 sm:block">
                Tip: use <kbd className="rounded border border-slate-200 px-1">Alt</kbd> +{" "}
                <kbd className="rounded border border-slate-200 px-1">←</kbd>/<kbd className="rounded border border-slate-200 px-1">→</kbd> to move between lessons
              </p>
            </article>
          )}
        </main>

        <aside className="hidden border-l border-slate-200 bg-slate-50 lg:block">
          <div className="scrollbar-thin sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto">{outline}</div>
        </aside>
      </div>

      {platform.aiAssistantEnabled && lesson && !isLocked && (
        <AiAssistant
          key={lesson.id}
          context={{
            courseTitle: c.title,
            moduleTitle: currentModule?.title,
            lessonTitle: lesson.title,
            lessonType: lesson.type,
            body: content.data?.body,
            transcript: content.data?.transcript,
            learnerName: profile.displayName,
          }}
          getVideoTime={() => (lesson.type === "video" ? videoPosition.current : null)}
        />
      )}
    </div>
  );
}
