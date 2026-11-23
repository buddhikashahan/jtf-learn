"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Link2,
  Lock,
  PlayCircle,
  Radio,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/providers/theme";
import { useCourse, useEnrollment, useNow } from "@/hooks/use-lms";
import { useCollection, useDocument } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import { endLiveSession, removeRecording, setRecordingLink, uploadRecording } from "@/lib/services/classroom";
import { getErrorMessage } from "@/lib/errors";
import { downloadCsv } from "@/lib/csv";
import { cn, formatBytes, formatClock, formatDateTime, liveStatus, safeExternalUrl, toDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { FullPageLoader, ProgressBar } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusScreen } from "@/components/auth/auth-guard";
import { JoinMeetingLink } from "./session-row";
import { RecordingPlayer } from "./recording-player";
import type { Attendance, LiveSession, RecordingPart, WithId } from "@/types";

const MAX_RECORDING_MB = 2048;

// ── Attendance (who opened the meeting link) ─────────────────────────────────
function AttendancePanel({ session }: { session: WithId<LiveSession> }) {
  const ref = useMemo(() => refs.attendance(session.courseId, session.id), [session.courseId, session.id]);
  const { data } = useCollection<Attendance>(ref);
  const rows = [...data].sort((a, b) => (toDate(a.firstJoinedAt)?.getTime() ?? 0) - (toDate(b.firstJoinedAt)?.getTime() ?? 0));

  return (
    <section className="rounded-2xl border border-slate-200 bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users className="size-4 text-slate-400" /> Attendance <span className="font-normal text-slate-500">({rows.length})</span>
        </h2>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `attendance-${session.title}.csv`,
                ["Name", "Role", "First joined", "Last joined"],
                rows.map((a) => [a.userName, a.role, formatDateTime(a.firstJoinedAt), formatDateTime(a.lastSeenAt)]),
              )
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        )}
      </div>
      <p className="px-5 pt-3 text-xs text-slate-500">Everyone who opened the meeting link from the LMS.</p>
      <ul className="scrollbar-thin max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
            <Avatar name={a.userName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{a.userName}</p>
              <p className="text-xs text-slate-500">{a.role === "student" ? "Learner" : "Host"}</p>
            </div>
            <span className="text-xs text-slate-500">{formatDateTime(a.firstJoinedAt)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No one has joined yet.</li>}
      </ul>
    </section>
  );
}

// ── Recording management (hosts) ─────────────────────────────────────────────
function RecordingManager({ session }: { session: WithId<LiveSession> }) {
  const profile = useProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [link, setLink] = useState(session.recordingUrl ?? "");
  const [savingLink, setSavingLink] = useState(false);
  const [removing, setRemoving] = useState<RecordingPart | null>(null);
  const parts = session.recordings ?? [];

  async function upload(file: File) {
    if (!file.type.startsWith("video/")) return toast.error("Choose a video file (MP4, WebM or MOV).");
    if (file.size > MAX_RECORDING_MB * 1024 * 1024) return toast.error(`Recordings can be up to ${MAX_RECORDING_MB / 1024} GB.`);
    setProgress(0);
    try {
      await uploadRecording(session, file, profile, setProgress);
      toast.success("Recording uploaded. Learners have been notified.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function saveLink(e: React.FormEvent) {
    e.preventDefault();
    const value = link.trim();
    if (value && !safeExternalUrl(value)) return toast.error("Enter a valid link starting with https://");
    setSavingLink(true);
    try {
      await setRecordingLink(session, value || null, profile);
      toast.success(value ? "Recording link saved. Learners have been notified." : "Recording link removed.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingLink(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-surface p-5 shadow-card">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Class recording</h2>
        <p className="mt-0.5 text-xs text-slate-500">Upload the video, add a link (Zoom cloud recording, YouTube, Drive…), or both.</p>
      </div>

      <div className="space-y-3">
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          className="sr-only"
          id="recording-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {progress !== null ? (
          <ProgressBar value={progress} label={`Uploading… ${Math.round(progress)}%`} />
        ) : (
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload /> Upload recording video
          </Button>
        )}
        <p className="text-xs text-slate-500">MP4, WebM or MOV, up to {MAX_RECORDING_MB / 1024} GB. Keep this page open while it uploads.</p>
        {parts.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {parts.map((p) => (
              <li key={p.path} className="flex items-center gap-3 px-3 py-2">
                <Video className="size-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.name ?? p.path.split("/").pop()}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {p.seconds ? `${formatClock(p.seconds)} · ` : ""}
                  {formatBytes(p.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoving(p)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${p.name ?? "recording"}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form method="post" onSubmit={saveLink} className="space-y-2">
        <label htmlFor="recording-link" className="text-sm font-medium text-slate-700">
          Recording link
        </label>
        <div className="flex gap-2">
          <Input
            id="recording-link"
            type="url"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline" loading={savingLink} disabled={link.trim() === (session.recordingUrl ?? "")}>
            <Link2 /> {link.trim() || !session.recordingUrl ? "Save" : "Remove"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this recording?"
        description="The video file will be permanently deleted. Learners won't be able to watch it any more."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removing) await removeRecording(session, removing);
          toast.success("Recording removed");
        }}
      />
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function Classroom({ params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { courseId, sessionId } = use(params);
  const profile = useProfile();
  const { isAdmin } = useAuth();
  const now = useNow(1000);
  const course = useCourse(courseId);
  const enrollment = useEnrollment(courseId, profile.uid);
  const sessionRef = useMemo(() => refs.liveSession(courseId, sessionId), [courseId, sessionId]);
  const session = useDocument<LiveSession>(sessionRef);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (course.loading || session.loading || enrollment.loading) return <FullPageLoader label="Opening class" />;

  const c = course.data;
  const s = session.data;
  const canModerate = Boolean(c && (isAdmin || (profile.role === "instructor" && c.instructorIds.includes(profile.uid))));
  if (!c || !s || !(canModerate || enrollment.data)) {
    return (
      <StatusScreen
        icon={Lock}
        title="Class unavailable"
        description="This live class doesn't exist or you're not enrolled in its course."
        action={
          <Link href="/live" className={buttonVariants()}>
            Back to live classes
          </Link>
        }
      />
    );
  }

  const status = s.endedAt ? "ended" : liveStatus(s, now);
  const start = toDate(s.startAt)?.getTime() ?? 0;
  const meetingUrl = safeExternalUrl(s.meetingUrl);
  const recordingUrl = safeExternalUrl(s.recordingUrl);
  const parts = s.recordings ?? [];
  const hasRecording = parts.length > 0 || Boolean(recordingUrl);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-surface px-4 sm:px-6">
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Live classes</span>
        </Link>
        <div className="h-6 w-px bg-slate-200" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{s.title}</p>
          <p className="truncate text-xs text-slate-500">
            {c.title} · Host: {s.hostName}
          </p>
        </div>
        {status === "live" && (
          <Badge tone="live" dot>
            Live now
          </Badge>
        )}
        {status === "upcoming" && <Badge tone="info">Scheduled</Badge>}
        {status === "ended" && <Badge>Ended</Badge>}
        <ThemeToggle className="hidden sm:inline-flex" />
        {canModerate && status !== "ended" && (
          <Button variant="outline" size="sm" onClick={() => setConfirmEnd(true)}>
            <CheckCircle2 /> <span className="hidden sm:inline">Mark as ended</span>
          </Button>
        )}
      </header>

      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        {/* Class details + join */}
        <section className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-card">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900">{s.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4" /> {formatDateTime(s.startAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" /> {s.durationMinutes} min
                </span>
              </p>
              {s.description && <p className="mt-4 text-sm whitespace-pre-wrap text-slate-700">{s.description}</p>}
            </div>

            {status !== "ended" && (
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                {meetingUrl ? (
                  <JoinMeetingLink
                    session={s}
                    className={buttonVariants({ size: "lg", variant: status === "live" ? "danger" : "primary" })}
                  >
                    {status === "live" ? <Radio /> : <ExternalLink />} {status === "live" ? "Join now" : "Open meeting link"}
                  </JoinMeetingLink>
                ) : (
                  <p className="text-sm text-slate-500">The host hasn&apos;t added a meeting link yet.</p>
                )}
                {status === "upcoming" && start > now && (
                  <p className="text-xs text-slate-500">Starts in {formatClock((start - now) / 1000)}</p>
                )}
                {meetingUrl && <p className="text-xs text-slate-500">Opens in Zoom, Google Meet or Teams.</p>}
              </div>
            )}
          </div>
        </section>

        {/* Recording */}
        {(hasRecording || status === "ended") && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Recording</h2>
            {parts.length > 0 && <RecordingPlayer parts={parts} title={s.title} />}
            {recordingUrl && (
              <a href={recordingUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: parts.length ? "outline" : "primary" })}>
                <PlayCircle /> Watch the recording <ExternalLink className="opacity-60" />
              </a>
            )}
            {!hasRecording && (
              <p className={cn("rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500")}>
                {canModerate ? "No recording yet — upload the video or add a link below." : "The recording isn't available yet. You'll be notified when it is."}
              </p>
            )}
          </section>
        )}

        {canModerate && <RecordingManager key={`${s.recordingUrl ?? ""}`} session={s} />}
        {canModerate && <AttendancePanel session={s} />}
      </main>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="Mark this class as ended?"
        description="Learners will see it as ended, and you can add the recording here."
        confirmLabel="Mark as ended"
        tone="primary"
        onConfirm={async () => {
          await endLiveSession(s);
          toast.success("Class marked as ended");
        }}
      />
    </div>
  );
}
