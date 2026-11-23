"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, History, MoreHorizontal, Pencil, Radio, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { useAccessibleCourses, useLiveSessionsFor, useNow } from "@/hooks/use-lms";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { SegmentedTabsList, SegmentedTabsTrigger, Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SessionRow } from "./session-row";
import { SessionFormDialog } from "./session-form-dialog";
import { deleteLiveSession } from "@/lib/services/live";
import { liveStatus } from "@/lib/utils";
import type { LiveSession, WithId } from "@/types";

export function LiveView() {
  const { isStaff } = useAuth();
  const now = useNow(15_000);
  const { courses, loading } = useAccessibleCourses();
  const ids = useMemo(() => (loading ? null : courses.map((c) => c.id)), [loading, courses]);
  const sessions = useLiveSessionsFor(ids);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const params = useSearchParams();
  const [editing, setEditing] = useState<WithId<LiveSession> | "new" | null>(() =>
    isStaff && params.get("new") === "1" ? "new" : null,
  );
  const [deleting, setDeleting] = useState<WithId<LiveSession> | null>(null);

  const groups = useMemo(() => {
    const live: WithId<LiveSession>[] = [];
    const upcoming: WithId<LiveSession>[] = [];
    const past: WithId<LiveSession>[] = [];
    sessions.data.forEach((s) => {
      const st = liveStatus(s, now);
      (st === "live" ? live : st === "upcoming" ? upcoming : past).push(s);
    });
    return { live, upcoming, past: past.reverse() };
  }, [sessions.data, now]);

  const actionsFor = (s: WithId<LiveSession>) =>
    isStaff ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditing(s)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleting(s)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : undefined;

  const list = tab === "upcoming" ? groups.upcoming : groups.past;
  const isLoading = loading || sessions.loading;

  return (
    <div>
      <PageHeader
        title="Live classes"
        description="Join live sessions with your instructors and catch up on recordings."
        actions={
          isStaff && (
            <Button onClick={() => setEditing("new")} disabled={courses.length === 0}>
              <CalendarPlus /> Schedule session
            </Button>
          )
        }
      />

      {groups.live.length > 0 && (
        <section className="mb-8" aria-labelledby="live-now">
          <h2 id="live-now" className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600">
            <Radio className="size-4 animate-pulse" /> Happening now
          </h2>
          <div className="space-y-3">
            {groups.live.map((s) => (
              <SessionRow key={s.id} session={s} now={now} actions={actionsFor(s)} />
            ))}
          </div>
        </section>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <SegmentedTabsList>
          <SegmentedTabsTrigger value="upcoming">Upcoming ({groups.upcoming.length})</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="past">Past sessions ({groups.past.length})</SegmentedTabsTrigger>
        </SegmentedTabsList>
      </Tabs>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === "upcoming" ? Video : History}
          title={tab === "upcoming" ? "No upcoming sessions" : "No past sessions"}
          description={
            tab === "upcoming"
              ? isStaff
                ? "Schedule a live class for one of your courses."
                : "Your instructors haven't scheduled any live classes yet."
              : "Recordings of past sessions will appear here."
          }
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-slate-100 p-0">
            {list.map((s) => (
              <div key={s.id} className="px-5 py-4">
                <SessionRow session={s} now={now} actions={actionsFor(s)} />
                {s.description && <p className="mt-2 text-sm text-slate-500 sm:pl-[72px]">{s.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isStaff && (
        <SessionFormDialog
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          courses={courses}
          session={editing && editing !== "new" ? editing : undefined}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The class, its chat, attendance and recordings (including the video files) will be permanently deleted."
        confirmLabel="Delete session"
        onConfirm={async () => {
          if (deleting) await deleteLiveSession(deleting);
          toast.success("Session deleted");
        }}
      />
    </div>
  );
}
