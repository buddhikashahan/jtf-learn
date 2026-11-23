"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, UserMinus, UserPlus, Users } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useProfile } from "@/components/providers/auth-provider";
import { useEnrollmentsFor } from "@/hooks/use-lms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { enrollUserByEmail, removeEnrollment } from "@/lib/services/enrollments";
import { getErrorMessage } from "@/lib/errors";
import { enrollByEmailSchema, type EnrollByEmailInput } from "@/lib/validation";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Course, Enrollment, WithId } from "@/types";

export function StudentsPanel({ course }: { course: WithId<Course> }) {
  const profile = useProfile();
  const ids = useMemo(() => [course.id], [course.id]);
  const { data, loading } = useEnrollmentsFor(ids);
  const [term, setTerm] = useState("");
  const [removing, setRemoving] = useState<WithId<Enrollment> | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnrollByEmailInput>({ resolver: zodResolver(enrollByEmailSchema) });

  const onEnroll = handleSubmit(async ({ email }) => {
    try {
      const student = await enrollUserByEmail(course, email, profile);
      toast.success(`${student.displayName} enrolled`);
      reset({ email: "" });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const rows = data
    .filter((e) => !term || `${e.userName} ${e.userEmail}`.toLowerCase().includes(term.toLowerCase()))
    .sort((a, b) => a.userName.localeCompare(b.userName));
  const avg = data.length ? Math.round(data.reduce((s, e) => s + e.progress, 0) / data.length) : 0;
  const completed = data.filter((e) => e.status === "completed").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Enrol a student</CardTitle>
            <CardDescription>The learner must already have an account on the platform.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form method="post" onSubmit={onEnroll} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="student@example.com"
                aria-label="Student email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <Button type="submit" loading={isSubmitting}>
              <UserPlus /> Enrol
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col sm:flex-row sm:items-center">
          <div>
            <CardTitle>Enrolled students</CardTitle>
            <CardDescription>
              {data.length} enrolled · {completed} completed · {avg}% average progress
            </CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <SearchInput value={term} onChange={setTerm} placeholder="Search students" className="flex-1 sm:w-64" />
            <Button
              variant="outline"
              disabled={data.length === 0}
              onClick={() =>
                downloadCsv(
                  `${course.code || course.title}-students.csv`,
                  ["Name", "Email", "Progress %", "Status", "Lessons completed", "Enrolled", "Last active"],
                  rows.map((e) => [
                    e.userName,
                    e.userEmail,
                    e.progress,
                    e.status,
                    e.completedLessonIds.length,
                    formatDate(e.enrolledAt),
                    formatDate(e.updatedAt),
                  ]),
                )
              }
            >
              <Download /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="px-5">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : data.length === 0 ? (
            <div className="px-5">
              <EmptyState icon={Users} title="No students yet" description="Enrol learners by email above." className="py-8" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                    <th className="px-5 py-2.5">Student</th>
                    <th className="w-48 px-3 py-2.5">Progress</th>
                    <th className="px-3 py-2.5">Enrolled</th>
                    <th className="px-3 py-2.5">Last active</th>
                    <th className="px-5 py-2.5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.userName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{e.userName}</p>
                            <p className="truncate text-xs text-slate-500">{e.userEmail}</p>
                          </div>
                          {e.status === "completed" && <Badge tone="success">Completed</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={e.progress} className="h-1.5" />
                          <span className="w-9 text-right text-xs font-medium text-slate-600 tabular-nums">{e.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(e.enrolledAt)}</td>
                      <td className="px-3 py-3 text-slate-600">{timeAgo(e.updatedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="danger-ghost" size="sm" onClick={() => setRemoving(e)}>
                          <UserMinus /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No matching students.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.userName ?? "student"}?`}
        description="They will lose access to this course. Their progress, notes and coursework submissions (with files and grades) will be permanently deleted."
        confirmLabel="Remove student"
        onConfirm={async () => {
          if (removing) await removeEnrollment(course, removing);
          toast.success("Student removed");
        }}
      />
    </div>
  );
}
