"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ClipboardList, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAssignmentsFor,
  useEnrollmentsFor,
  useNow,
  useStaffCourses,
  useSubmissionsFor,
} from "@/hooks/use-lms";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssignmentFormDialog } from "./assignment-form-dialog";
import { deleteAssignment } from "@/lib/services/assignments";
import { formatDateTime, toDate } from "@/lib/utils";
import type { Assignment, WithId } from "@/types";

export function StaffAssignments() {
  const now = useNow();
  const courses = useStaffCourses();
  const ids = useMemo(() => (courses.loading ? null : courses.data.map((c) => c.id)), [courses.loading, courses.data]);
  const assignments = useAssignmentsFor(ids);
  const submissions = useSubmissionsFor(assignments.loading ? null : assignments.data);
  const enrollments = useEnrollmentsFor(ids);

  const [courseFilter, setCourseFilter] = useState("all");
  const [term, setTerm] = useState("");
  const params = useSearchParams();
  const [editing, setEditing] = useState<WithId<Assignment> | null | "new">(() => (params.get("new") === "1" ? "new" : null));
  const [deleting, setDeleting] = useState<WithId<Assignment> | null>(null);

  const stats = useMemo(() => {
    const perAssignment = new Map<string, { submitted: number; graded: number }>();
    submissions.data.forEach((s) => {
      const cur = perAssignment.get(s.assignmentId) ?? { submitted: 0, graded: 0 };
      cur.submitted += 1;
      if (s.status === "graded") cur.graded += 1;
      perAssignment.set(s.assignmentId, cur);
    });
    const perCourse = new Map<string, number>();
    enrollments.data.forEach((e) => perCourse.set(e.courseId, (perCourse.get(e.courseId) ?? 0) + 1));
    return { perAssignment, perCourse };
  }, [submissions.data, enrollments.data]);

  const rows = assignments.data
    .filter((a) => courseFilter === "all" || a.courseId === courseFilter)
    .filter((a) => !term || a.title.toLowerCase().includes(term.toLowerCase()))
    .sort((a, b) => (toDate(b.dueAt)?.getTime() ?? 0) - (toDate(a.dueAt)?.getTime() ?? 0));

  const loading = courses.loading || assignments.loading;

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Create assignments, review submissions and grade learner work."
        actions={
          <Button onClick={() => setEditing("new")} disabled={courses.data.length === 0}>
            <Plus /> New assignment
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="sm:w-72" aria-label="Filter by course">
          <option value="all">All courses</option>
          {courses.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        <SearchInput value={term} onChange={setTerm} placeholder="Search assignments" className="sm:w-72" />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={assignments.data.length ? "No matching assignments" : "No assignments yet"}
          description={assignments.data.length ? undefined : "Create an assignment for one of your courses."}
          action={
            !assignments.data.length && courses.data.length > 0 ? (
              <Button onClick={() => setEditing("new")}>
                <Plus /> New assignment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Assignment</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3 text-right">Points</th>
                  <th className="px-3 py-3">Submissions</th>
                  <th className="px-5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => {
                  const s = stats.perAssignment.get(a.id) ?? { submitted: 0, graded: 0 };
                  const enrolled = stats.perCourse.get(a.courseId) ?? 0;
                  const toGrade = s.submitted - s.graded;
                  const past = (toDate(a.dueAt)?.getTime() ?? 0) < now;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="max-w-0 px-5 py-3.5">
                        <Link href={`/assignments/${a.courseId}/${a.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                          {a.title}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{a.courseTitle}</p>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className={past ? "text-slate-500" : "text-slate-800"}>{formatDateTime(a.dueAt)}</span>
                        {past && <Badge className="ml-2">Closed</Badge>}
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-700 tabular-nums">{a.points}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-700 tabular-nums">
                            {s.submitted}/{enrolled}
                          </span>
                          {toGrade > 0 ? <Badge tone="warning">{toGrade} to grade</Badge> : s.submitted > 0 ? <Badge tone="success">All graded</Badge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/assignments/${a.courseId}/${a.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                            Review
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.title}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => setEditing(a)}>
                                <Pencil /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem destructive onSelect={() => setDeleting(a)}>
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AssignmentFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        courses={courses.data}
        assignment={editing && editing !== "new" ? editing : undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="All submissions, their files and grades will be permanently deleted."
        confirmLabel="Delete assignment"
        onConfirm={async () => {
          if (deleting) await deleteAssignment(deleting);
          toast.success("Assignment deleted");
        }}
      />
    </div>
  );
}
