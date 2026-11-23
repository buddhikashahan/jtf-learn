"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useDocument } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import { noteId, saveNote } from "@/lib/services/notes";
import { Textarea } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/feedback";
import { timeAgo } from "@/lib/utils";
import type { LessonNote } from "@/types";

type SaveState = "idle" | "saving" | "saved" | "error";

function NotesEditor({
  uid,
  courseId,
  lessonId,
  initial,
  updatedAt,
}: {
  uid: string;
  courseId: string;
  lessonId: string;
  initial: string;
  updatedAt: LessonNote["updatedAt"];
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  async function persist(content: string) {
    setState("saving");
    try {
      await saveNote(uid, courseId, lessonId, content);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  function onChange(next: string) {
    setValue(next);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(next), 900);
  }

  // Flush any pending save when switching lessons / unmounting.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void saveNote(uid, courseId, lessonId, latest.current).catch(() => undefined);
      }
    };
  }, [uid, courseId, lessonId]);

  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        maxLength={20000}
        placeholder="Write your private notes for this lesson. They're saved automatically."
        aria-label="Lesson notes"
      />
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
        {state === "saving" && (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </>
        )}
        {state === "saved" && (
          <>
            <Check className="size-3.5 text-emerald-500" /> Saved
          </>
        )}
        {state === "error" && <span className="text-red-600">Couldn&apos;t save your notes. Check your connection.</span>}
        {state === "idle" && (updatedAt ? `Last saved ${timeAgo(updatedAt)}` : "Only you can see these notes.")}
      </p>
    </div>
  );
}

export function LessonNotes({ uid, courseId, lessonId }: { uid: string; courseId: string; lessonId: string }) {
  const ref = useMemo(() => refs.note(uid, noteId(courseId, lessonId)), [uid, courseId, lessonId]);
  const note = useDocument<LessonNote>(ref);
  if (note.loading) return <Skeleton className="h-48 w-full" />;
  return (
    <NotesEditor
      key={lessonId}
      uid={uid}
      courseId={courseId}
      lessonId={lessonId}
      initial={note.data?.content ?? ""}
      updatedAt={note.data?.updatedAt ?? null}
    />
  );
}
