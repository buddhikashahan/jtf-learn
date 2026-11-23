"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Clock, ExternalLink, PlayCircle, Radio } from "lucide-react";
import { useProfile } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { recordJoin } from "@/lib/services/classroom";
import { cn, formatDate, liveStatus, safeExternalUrl, toDate } from "@/lib/utils";
import type { LiveSession, WithId } from "@/types";

/** Opens the external meeting in a new tab and records attendance. */
export function JoinMeetingLink({
  session,
  className,
  children,
}: {
  session: WithId<LiveSession>;
  className?: string;
  children: React.ReactNode;
}) {
  const profile = useProfile();
  const url = safeExternalUrl(session.meetingUrl);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} onClick={() => void recordJoin(session, profile)}>
      {children}
    </a>
  );
}

export function SessionRow({
  session,
  now,
  actions,
  compact = false,
}: {
  session: WithId<LiveSession>;
  now: number;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const status = liveStatus(session, now);
  const start = toDate(session.startAt);
  const page = `/live/${session.courseId}/${session.id}`;
  const hasRecording = Boolean(safeExternalUrl(session.recordingUrl)) || (session.recordings?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center",
        status === "live" && !compact && "rounded-xl bg-red-50/60 p-4 ring-1 ring-red-100",
      )}
    >
      <div
        className={cn(
          "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center",
          status === "live" ? "border-red-200 bg-surface" : "border-slate-200 bg-slate-50",
        )}
        aria-hidden
      >
        <span className={cn("text-[10px] font-semibold uppercase", status === "live" ? "text-red-600" : "text-brand-600")}>
          {start ? format(start, "MMM") : "—"}
        </span>
        <span className="text-lg leading-none font-semibold text-slate-900">{start ? format(start, "d") : "—"}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={page} className="truncate text-sm font-semibold text-slate-900 hover:text-brand-600">
            {session.title}
          </Link>
          {status === "live" && (
            <Badge tone="live" dot>
              Live now
            </Badge>
          )}
          {status === "upcoming" && !compact && <Badge tone="info">Scheduled</Badge>}
          {status === "ended" && !compact && <Badge>Ended</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {start ? format(start, "EEE, h:mm a") : formatDate(session.startAt)} · {session.durationMinutes} min
          </span>
          <span>Host: {session.hostName}</span>
          {!compact && <span className="truncate">{session.courseTitle}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status === "live" && (
          <JoinMeetingLink session={session} className={buttonVariants({ size: "sm", variant: "danger" })}>
            <Radio /> Join now
          </JoinMeetingLink>
        )}
        {status === "upcoming" && !compact && (
          <JoinMeetingLink session={session} className={buttonVariants({ size: "sm", variant: "outline" })}>
            <ExternalLink /> Meeting link
          </JoinMeetingLink>
        )}
        {status === "ended" && hasRecording && (
          <Link href={page} className={buttonVariants({ size: "sm", variant: "outline" })}>
            <PlayCircle /> Recording
          </Link>
        )}
        {actions}
      </div>
    </div>
  );
}
