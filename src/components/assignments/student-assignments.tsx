"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageSquareQuote,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { useMyCourses, useAssignmentsFor, useMySubmissions, useNow } from "@/hooks/use-lms";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { SegmentedTabsList, SegmentedTabsTrigger, Tabs } from "@/components/ui/tabs";
import { SubmitDialog } from "./submit-dialog";
import { SubmissionFile } from "./submission-file";
import { courseworkState, passMarkOf, type CourseworkState } from "@/lib/coursework";
import { cn, formatDateTime, timeAgo, toDate } from "@/lib/utils";
import type { Assignment, Submission, WithId } from "@/types";

const statusMeta: Record<CourseworkState, { label: string; tone: BadgeTone }> = {
  todo: { label: "To do", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  submitted: { label: "Awaiting grade", tone: "info" },
  passed: { label: "Graded", tone: "success" },
  failed: { label: "Resubmit needed", tone: "danger" },
};

function AssignmentCard({
  assignment,
  submission,
  status,
  onSubmit,
}: {
  assignment: WithId<Assignment>;
  submission: WithId<Submission> | undefined;
  status: CourseworkState;
  onSubmit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = statusMeta[status];
  const long = assignment.description.length > 220;
  const late =
    submission && (toDate(submission.submittedAt)?.getTime() ?? 0) > (toDate(assignment.dueAt)?.getTime() ?? Infinity);
  const passMark = passMarkOf(assignment);
  const failed = status === "failed";

  return (
    <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            status === "passed"
              ? "bg-emerald-50 text-emerald-600"
              : status === "overdue" || failed
                ? "bg-red-50 text-red-600"
                : "bg-brand-50 text-brand-600",
          )}
        >
          {status === "passed" ? <CheckCircle2 className="size-5" /> : failed ? <XCircle className="size-5" /> : <ClipboardList className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
            {assignment.required && status !== "passed" && <Badge tone="warning">Required to complete course</Badge>}
            {late && <Badge tone="warning">Late</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span>{assignment.courseTitle}</span>
            {assignment.moduleId && <span>Module coursework</span>}
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" /> Due {formatDateTime(assignment.dueAt)}
            </span>
            <span>
              {assignment.points} points{passMark > 0 ? ` · pass mark ${passMark}` : ""}
            </span>
          </p>
          {assignment.description && (
            <div className="mt-3">
              <p className={cn("text-sm leading-relaxed whitespace-pre-line text-slate-600", !expanded && long && "line-clamp-3")}>
                {assignment.description}
              </p>
              {long && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {submission && (
            <div className="mt-4 space-y-3">
              <SubmissionFile submission={submission} />
              {submission.note && <p className="text-xs text-slate-500">Your note: “{submission.note}”</p>}
            </div>
          )}

          {submission?.status === "graded" && (
            <div
              className={cn(
                "mt-4 rounded-xl border p-4",
                failed ? "border-red-200 bg-red-50/60 text-red-900" : "border-emerald-200 bg-emerald-50/60 text-emerald-900",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{failed ? "Below the pass mark" : passMark > 0 ? "Passed" : "Grade"}</p>
                <p className={cn("text-xl font-semibold tabular-nums", failed ? "text-red-700" : "text-emerald-700")}>
                  {submission.grade}/{assignment.points}
                </p>
              </div>
              {failed && (
                <p className="mt-1 text-sm">
                  You need at least {passMark} to pass. Review the feedback below and resubmit your work.
                </p>
              )}
              {submission.feedback && (
                <div className={cn("mt-3 flex gap-2 border-t pt-3 text-sm", failed ? "border-red-200/70" : "border-emerald-200/70")}>
                  <MessageSquareQuote className="mt-0.5 size-4 shrink-0 opacity-70" />
                  <p className="whitespace-pre-line">{submission.feedback}</p>
                </div>
              )}
              <p className="mt-2 text-xs opacity-80">
                Graded by {submission.gradedByName ?? "instructor"} · {timeAgo(submission.gradedAt)}
              </p>
            </div>
          )}
        </div>

        {status !== "passed" && (
          <div className="shrink-0">
            {submission ? (
              <Button variant={failed ? "primary" : "outline"} size="sm" onClick={onSubmit}>
                <RefreshCw /> Resubmit
              </Button>
            ) : (
              <Button size="sm" onClick={onSubmit}>
                <Upload /> Submit work
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function StudentAssignments() {
  const now = useNow();
  const { items, loading } = useMyCourses();
  const courseIds = useMemo(() => (loading ? null : items.map((i) => i.course.id)), [loading, items]);
  const assignments = useAssignmentsFor(courseIds);
  const submissions = useMySubmissions();
  const params = useSearchParams();
  const [tab, setTab] = useState<"todo" | "submitted" | "graded">(() => {
    const t = params.get("tab");
    return t === "graded" || t === "submitted" ? t : "todo";
  });
  const [active, setActive] = useState<WithId<Assignment> | null>(null);

  const rows = useMemo(() => {
    const byAssignment = new Map(submissions.data.map((s) => [s.assignmentId, s]));
    return assignments.data.map((a) => {
      const submission = byAssignment.get(a.id);
      return { assignment: a, submission, status: courseworkState(a, submission, now) };
    });
  }, [assignments.data, submissions.data, now]);

  const groups = {
    // Work that still needs action — including anything graded below its pass mark.
    todo: rows.filter((r) => r.status === "todo" || r.status === "overdue" || r.status === "failed"),
    submitted: rows.filter((r) => r.status === "submitted"),
    graded: rows.filter((r) => r.status === "passed").reverse(),
  };
  const visible = groups[tab];
  const isLoading = loading || assignments.loading || submissions.loading;
  const activeSubmission = active ? rows.find((r) => r.assignment.id === active.id)?.submission ?? null : null;

  return (
    <div>
      <PageHeader title="Assignments & coursework" description="Track deadlines, submit your work, and review feedback." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-5">
        <SegmentedTabsList>
          <SegmentedTabsTrigger value="todo">To do ({groups.todo.length})</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="submitted">Submitted ({groups.submitted.length})</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="graded">Graded ({groups.graded.length})</SegmentedTabsTrigger>
        </SegmentedTabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={tab === "todo" ? CheckCircle2 : ClipboardList}
          title={tab === "todo" ? "You're all caught up" : tab === "submitted" ? "No submissions awaiting grading" : "No graded work yet"}
          description={tab === "todo" ? "New coursework from your courses will appear here." : undefined}
        />
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <AssignmentCard
              key={r.assignment.id}
              assignment={r.assignment}
              submission={r.submission}
              status={r.status}
              onSubmit={() => setActive(r.assignment)}
            />
          ))}
        </div>
      )}

      {active && (
        <SubmitDialog
          key={active.id}
          open
          onOpenChange={(o) => !o && setActive(null)}
          assignment={active}
          existing={activeSubmission}
          instructorIds={items.find((i) => i.course.id === active.courseId)?.course.instructorIds ?? []}
        />
      )}
    </div>
  );
}
