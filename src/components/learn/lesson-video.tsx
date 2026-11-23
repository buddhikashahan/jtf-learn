"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, Lock } from "lucide-react";
import { TrackedVideoPlayer, type WatchState } from "./tracked-video-player";
import { ProgressBar } from "@/components/ui/feedback";
import { recordVideoDuration, saveLessonProgress } from "@/lib/services/progress";
import { formatClock } from "@/lib/utils";
import type { Course, Lesson, LessonProgress, WithId } from "@/types";

const SAVE_EVERY_MS = 10_000;

export function requiredWatchPercent(course: Course) {
  return course.requiredWatchPercent ?? 90;
}

/** Mirrors the firestore.rules completion check for video lessons. */
export function hasWatchedEnough(course: Course, lesson: Lesson, progress: LessonProgress | null | undefined) {
  const required = requiredWatchPercent(course);
  if (!lesson.hasVideo || required === 0) return true;
  if (!progress) return false;
  const length = lesson.videoDurationSeconds && lesson.videoDurationSeconds > 0 ? lesson.videoDurationSeconds : progress.duration;
  return progress.maxWatched >= (length * required) / 100 - 2;
}

export function LessonVideo({
  course,
  lesson,
  url,
  uid,
  progress,
  tracking,
  canManage,
  onWatchedEnough,
  onPosition,
}: {
  course: WithId<Course>;
  lesson: WithId<Lesson>;
  url: string | null | undefined;
  uid: string;
  progress: LessonProgress | null;
  /** Persist progress (enrolled learners only). */
  tracking: boolean;
  canManage: boolean;
  onWatchedEnough?: () => void;
  /** Reports the current playback position (seconds) as it changes. */
  onPosition?: (seconds: number) => void;
}) {
  const required = requiredWatchPercent(course);
  const [watch, setWatch] = useState({
    maxWatched: progress?.maxWatched ?? 0,
    duration: lesson.videoDurationSeconds || progress?.duration || 0,
  });
  const latest = useRef<WatchState | null>(null);
  const lastSave = useRef(0);
  const exists = useRef(Boolean(progress));
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [initiallyMet] = useState(() => hasWatchedEnough(course, lesson, progress));
  const notified = useRef(initiallyMet);
  const durationRecorded = useRef(false);

  function save(state: WatchState, force = false) {
    if (!tracking || state.duration <= 0) return chain.current;
    const now = Date.now();
    if (!force && now - lastSave.current < SAVE_EVERY_MS) return chain.current;
    lastSave.current = now;
    chain.current = chain.current
      .then(() => saveLessonProgress(course.id, uid, lesson.id, state, exists.current))
      .then(() => {
        exists.current = true;
      })
      .catch(() => undefined);
    return chain.current;
  }

  function checkThreshold(state: WatchState) {
    if (notified.current || !tracking) return;
    const length = lesson.videoDurationSeconds || state.duration;
    if (length > 0 && state.maxWatched >= (length * required) / 100 - 2) {
      notified.current = true;
      void save(state, true).then(() => onWatchedEnough?.());
    }
  }

  function onUpdate(state: WatchState) {
    latest.current = state;
    onPosition?.(state.position);
    setWatch((w) =>
      Math.floor(w.maxWatched) === Math.floor(state.maxWatched) && w.duration === state.duration
        ? w
        : { maxWatched: state.maxWatched, duration: lesson.videoDurationSeconds || state.duration },
    );
    if (state.playing) void save(state);
    checkThreshold(state);
  }

  // Flush progress when the tab is hidden or the lesson unmounts.
  useEffect(() => {
    const flush = () => {
      if (latest.current) void save(latest.current, true);
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // save() only reads refs/props captured for this lesson instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const length = watch.duration;
  const percent = length > 0 ? Math.min(100, Math.round((watch.maxWatched / length) * 100)) : 0;
  const met = initiallyMet || (length > 0 && percent >= required);

  return (
    <div className="space-y-3">
      <TrackedVideoPlayer
        url={url}
        title={lesson.title}
        initial={progress ? { position: progress.position, maxWatched: progress.maxWatched } : null}
        knownDuration={lesson.videoDurationSeconds || undefined}
        preventSkip={!canManage}
        onUpdate={onUpdate}
        onPause={(s) => {
          latest.current = s;
          void save(s, true);
        }}
        onEnded={(s) => {
          latest.current = s;
          onUpdate(s);
          void save(s, true);
        }}
        onDuration={(seconds) => {
          setWatch((w) => ({ ...w, duration: lesson.videoDurationSeconds || seconds }));
          if (canManage && !durationRecorded.current && Math.abs((lesson.videoDurationSeconds ?? 0) - seconds) > 2) {
            durationRecorded.current = true;
            void recordVideoDuration(course.id, lesson.id, seconds).catch(() => undefined);
          }
        }}
      />

      {tracking && required > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 text-sm">
            {met ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <Lock className="size-4 text-slate-400" />
            )}
            <span className="font-medium text-slate-800">
              {met ? "Watch requirement met" : `Watch ${required}% to complete`}
            </span>
          </div>
          <div className="relative flex-1">
            <ProgressBar value={percent} tone={met ? "success" : "brand"} label="Video watched" />
            <span
              className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-slate-500"
              style={{ left: `${required}%` }}
              aria-hidden
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {percent}% · {formatClock(watch.maxWatched)} / {length ? formatClock(length) : "--:--"}
          </span>
        </div>
      ) : canManage ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Eye className="size-3.5" /> Preview mode — seeking is unrestricted.{" "}
          {required > 0 ? `Learners must watch ${required}% and can't skip ahead.` : "Watch requirement is off for this course."}
        </p>
      ) : null}
    </div>
  );
}
