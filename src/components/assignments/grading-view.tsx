"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, CheckCircle2, ClipboardCheck, Download, Lock, Users } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { useDocument } from "@/hooks/use-firestore";
import { useCourse, useEnrollmentsFor, useNow, useSubmissionsFor } from "@/hooks/use-lms";
import { refs } from "@/lib/services/refs";
import { gradeSubmission } from "@/lib/services/assignments";
import { getErrorMessage } from "@/lib/errors";
import { gradeSchema, type GradeInput } from "@/lib/validation";
import { isPassed, passMarkOf } from "@/lib/coursework";
import { formatDateTime, safeExternalUrl, toDate } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { SegmentedTabsList, SegmentedTabsTrigger, Tabs } from "@/components/ui/tabs";
import { SubmissionFile } from "./submission-file";
import type { Assignment, Submission, WithId } from "@/types";

function GradeDialog({
  assignment,
  submission,
  onClose,
}: {
  assignment: WithId<Assignment>;
  submission: WithId<Submission>;
  onClose: () => void;
}) {
  const profile = useProfile();
  const schema = useMemo(() => gradeSchema(assignment.points), [assignment.points]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GradeInput>({
    resolver: zodResolver(schema),
    defaultValues: { grade: submission.grade ?? undefined, feedback: submission.feedback ?? "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await gradeSubmission(assignment, { id: submission.userId, name: submission.userName }, values, profile);
      toast.success(`Graded ${submission.userName}`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Grade ${submission.userName}`}
      description={assignment.title}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="grade-form" loading={isSubmitting}>
            <CheckCircle2 /> Save grade
          </Button>
        </>
      }
    >
      <form method="post" id="grade-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <SubmissionFile submission={submission} />
        {submission.note && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Student note:</span> {submission.note}
          </p>
        )}
        <FormField
          label={`Grade (out of ${assignment.points})`}
          required
          error={errors.grade?.message}
          hint={
            passMarkOf(assignment) > 0
              ? `Pass mark: ${passMarkOf(assignment)}. Below it, the learner is asked to resubmit${assignment.required ? " and can't complete the course" : ""}.`
              : undefined
          }
        >
          <Input type="number" step="0.5" min={0} max={assignment.points} {...register("grade", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Feedback" error={errors.feedback?.message}>
          <Textarea rows={5} placeholder="Share what went well and what to improve." {...register("feedback")} />
        </FormField>
      </form>
    </Dialog>
  );
}

type Row = {
  userId: string;
  name: string;
  email: string;
  submission?: WithId<Submission>;
};

export function GradingView({ params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  const { courseId, assignmentId } = use(params);
  const profile = useProfile();
  const { isAdmin } = useAuth();
  const course = useCourse(courseId);
  const assignmentRef = useMemo(() => refs.assignment(courseId, assignmentId), [courseId, assignmentId]);
  const assignment = useDocument<Assignment>(assignmentRef);
  const ids = useMemo(() => [courseId], [courseId]);
  const enrollments = useEnrollmentsFor(ids);
  const target = useMemo(() => [{ id: assignmentId, courseId }], [assignmentId, courseId]);
  const submissions = useSubmissionsFor(target);
  const [filter, setFilter] = useState<"all" | "submitted" | "graded" | "missing">("all");
  const [grading, setGrading] = useState<WithId<Submission> | null>(null);
  const now = useNow();

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    enrollments.data.forEach((e) => map.set(e.userId, { userId: e.userId, name: e.userName, email: e.userEmail }));
    submissions.data.forEach((s) => {
      const row = map.get(s.userId) ?? { userId: s.userId, name: s.userName, email: "" };
      map.set(s.userId, { ...row, submission: s });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [enrollments.data, submissions.data]);

  if (course.loading || assignment.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const c = course.data;
  const a = assignment.data;
  const canGrade = c && (isAdmin || (profile.role === "instructor" && c.instructorIds.includes(profile.uid)));
  if (!c || !a || !canGrade) {
    return (
      <EmptyState
        icon={Lock}
        title="Assignment unavailable"
        description="It may have been deleted, or you don't teach this course."
        action={
          <Link href="/assignments" className={buttonVariants()}>
            Back to assignments
          </Link>
        }
      />
    );
  }

  const due = toDate(a.dueAt)?.getTime() ?? Infinity;
  const submitted = rows.filter((r) => r.submission);
  const graded = submitted.filter((r) => r.submission?.status === "graded");
  const avg = graded.length
    ? graded.reduce((s, r) => s + (r.submission?.grade ?? 0), 0) / graded.length
    : null;

  const visible = rows.filter((r) => {
    if (filter === "submitted") return r.submission?.status === "submitted";
    if (filter === "graded") return r.submission?.status === "graded";
    if (filter === "missing") return !r.submission;
    return true;
  });

  return (
    <div>
      <PageHeader
        back={{ href: "/assignments", label: "All assignments" }}
        eyebrow={<span className="text-sm text-slate-500">{c.title}</span>}
        title={a.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-4" /> Due {formatDateTime(a.dueAt)}
            </span>
            <span>{a.points} points</span>
            {passMarkOf(a) > 0 && <span>Pass mark {passMarkOf(a)}</span>}
            {a.required && <Badge tone="warning">Required to complete the course</Badge>}
          </span>
        }
      />

      {a.description && (
        <Card className="mb-6 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Instructions</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">{a.description}</p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Submitted" value={`${submitted.length}/${rows.length}`} icon={Users} />
        <StatCard label="Graded" value={graded.length} icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Average grade" value={avg === null ? "—" : `${avg.toFixed(1)}/${a.points}`} icon={CheckCircle2} tone="violet" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <SegmentedTabsList>
          <SegmentedTabsTrigger value="all">All ({rows.length})</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="submitted">To grade ({submitted.length - graded.length})</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="graded">Graded ({graded.length})</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="missing">Missing ({rows.length - submitted.length})</SegmentedTabsTrigger>
        </SegmentedTabsList>
      </Tabs>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              `gradebook-${a.title}.csv`,
              ["Student", "Email", "Status", "Submitted at", "Late", "Grade", "Out of", "Result", "Feedback"],
              rows.map((r) => {
                const sub = r.submission;
                const isLate = sub && (toDate(sub.submittedAt)?.getTime() ?? 0) > due;
                return [
                  r.name,
                  r.email,
                  sub ? sub.status : "missing",
                  sub ? formatDateTime(sub.submittedAt) : "",
                  isLate ? "yes" : "",
                  sub?.grade ?? "",
                  a.points,
                  sub?.status === "graded" && passMarkOf(a) > 0 ? (isPassed(a, sub) ? "pass" : "fail") : "",
                  sub?.feedback ?? "",
                ];
              }),
            )
          }
        >
          <Download /> Export grades
        </Button>
      </div>

      {enrollments.loading || submissions.loading ? (
        <Skeleton className="h-48 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} title="Nobody here" description="No students match this filter." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {visible.map((r) => {
              const s = r.submission;
              const late = s && (toDate(s.submittedAt)?.getTime() ?? 0) > due;
              return (
                <li key={r.userId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {s ? `Submitted ${formatDateTime(s.submittedAt)}` : r.email || "No submission"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!s && <Badge tone={now > due ? "danger" : "neutral"}>{now > due ? "Missing" : "Not submitted"}</Badge>}
                    {late && <Badge tone="warning">Late</Badge>}
                    {s?.status === "submitted" && <Badge tone="info" dot>Needs grading</Badge>}
                    {s?.status === "graded" && (
                      <Badge tone={isPassed(a, s) ? "success" : "danger"}>
                        {s.grade}/{a.points}
                        {passMarkOf(a) > 0 && (isPassed(a, s) ? " · Pass" : " · Below pass mark")}
                      </Badge>
                    )}
                    {s && (
                      <a href={safeExternalUrl(s.fileUrl) ?? "#"} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                        View file
                      </a>
                    )}
                    {s && (
                      <Button size="sm" variant={s.status === "graded" ? "outline" : "primary"} onClick={() => setGrading(s)}>
                        {s.status === "graded" ? "Edit grade" : "Grade"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {grading && (
        <GradeDialog key={grading.id} assignment={a} submission={grading} onClose={() => setGrading(null)} />
      )}
    </div>
  );
}
