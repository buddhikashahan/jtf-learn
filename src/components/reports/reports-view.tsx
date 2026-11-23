"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  PlayCircle,
  Users,
  XCircle,
} from "lucide-react";
import { useStaffCourses } from "@/hooks/use-lms";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv";
import { passMarkOf } from "@/lib/coursework";
import { cn, formatClock, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { useCourseReport, type StudentReport } from "./report-data";
import type { Course, WithId } from "@/types";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);

function Meter({ value, tone }: { value: number | null; tone?: "brand" | "success" }) {
  if (value === null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-2">
      <ProgressBar value={value} className="h-1.5 w-20" tone={tone ?? (value >= 100 ? "success" : "brand")} />
      <span className="w-9 text-right text-xs font-medium text-slate-700 tabular-nums">{value}%</span>
    </div>
  );
}

// ── Student detail ───────────────────────────────────────────────────────────
function StudentDetail({ course, student, onClose }: { course: WithId<Course>; student: StudentReport; onClose: () => void }) {
  const e = student.enrollment;

  function exportDetail() {
    downloadCsv(
      `${course.code || course.title}-${e.userName}-report.csv`,
      ["Type", "Item", "Status", "Watched %", "Watched", "Length", "Mark", "Out of", "Result", "Last activity"],
      [
        ...student.lessons.map((l) => [
          l.lesson.type === "video" ? "Video lesson" : "Reading",
          l.lesson.title,
          l.completed ? "completed" : "not completed",
          l.watchedPercent ?? "",
          l.lesson.hasVideo ? formatClock(l.watchedSeconds) : "",
          l.lesson.hasVideo ? formatClock(l.lengthSeconds) : "",
          "",
          "",
          "",
          l.lastWatched ? formatDateTime(l.lastWatched) : "",
        ]),
        ...student.coursework.map((c) => [
          c.assignment.required ? "Required coursework" : "Coursework",
          c.assignment.title,
          c.submission ? c.submission.status : "not submitted",
          "",
          "",
          "",
          c.submission?.grade ?? "",
          c.assignment.points,
          c.submission?.status === "graded" ? (c.passed ? "pass" : "fail") : "",
          c.submission ? formatDateTime(c.submission.submittedAt) : "",
        ]),
      ],
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={e.userName}
      description={`${e.userEmail} · ${course.title}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={exportDetail}>
            <Download /> Export CSV
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Course progress", value: `${student.progress}%` },
            { label: "Lessons", value: `${student.lessonsDone}/${student.lessonsTotal}` },
            {
              label: "Video watched",
              value: student.videoPercent === null ? "—" : `${student.videoPercent}%`,
              hint: student.videoSeconds ? `${formatClock(student.watchedSeconds)} of ${formatClock(student.videoSeconds)}` : undefined,
            },
            {
              label: "Average mark",
              value: pct(student.averageMark),
              hint: student.courseworkRequired ? `${student.courseworkPassed}/${student.courseworkRequired} required passed` : undefined,
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{s.value}</p>
              {s.hint && <p className="text-[11px] text-slate-500">{s.hint}</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Enrolled {formatDate(e.enrolledAt)} · Last active {student.lastActive ? timeAgo(student.lastActive) : "never"}
          {e.status === "completed" && e.completedAt ? ` · Completed ${formatDate(e.completedAt)}` : ""}
        </p>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Lessons & video watching</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-2">Lesson</th>
                  <th className="px-3 py-2">Watched</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-4 py-2">Last watched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.lessons.map((l) => (
                  <tr key={l.lesson.id}>
                    <td className="max-w-0 px-4 py-2">
                      <span className="flex items-center gap-2">
                        {l.lesson.type === "video" ? (
                          <PlayCircle className="size-4 shrink-0 text-brand-500" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-emerald-500" />
                        )}
                        <span className="truncate text-slate-800">{l.lesson.title}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{l.watchedPercent === null ? <span className="text-xs text-slate-400">Reading</span> : <Meter value={l.watchedPercent} />}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600 tabular-nums">
                      {l.lesson.hasVideo ? `${formatClock(l.watchedSeconds)} / ${formatClock(l.lengthSeconds)}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {l.completed ? <CheckCircle2 className="size-4 text-emerald-500" aria-label="Completed" /> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{l.lastWatched ? timeAgo(l.lastWatched) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Coursework & marks</h3>
          {student.coursework.length === 0 ? (
            <p className="text-sm text-slate-500">No coursework in this course yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {student.coursework.map((c) => (
                <li key={c.assignment.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {c.assignment.title}
                      {c.assignment.required && <span className="ml-2 text-xs font-normal text-amber-700">Required</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.submission ? `Submitted ${formatDateTime(c.submission.submittedAt)}` : `Due ${formatDateTime(c.assignment.dueAt)}`}
                    </p>
                  </div>
                  {!c.submission ? (
                    <Badge>Not submitted</Badge>
                  ) : c.submission.status !== "graded" ? (
                    <Badge tone="info">Awaiting grade</Badge>
                  ) : (
                    <Badge tone={c.passed || passMarkOf(c.assignment) === 0 ? "success" : "danger"}>
                      {c.submission.grade}/{c.assignment.points} · {c.percent}%
                      {passMarkOf(c.assignment) > 0 && (c.passed ? " · Pass" : " · Fail")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function ReportsView() {
  const courses = useStaffCourses();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("course");
  const courseId = requested && courses.data.some((c) => c.id === requested) ? requested : (courses.data[0]?.id ?? null);
  const course = courses.data.find((c) => c.id === courseId) ?? null;
  const report = useCourseReport(course);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "progress" | "video" | "mark" | "active">("name");

  const students = useMemo(() => {
    const rows = report.students.filter(
      (s) => !term || `${s.enrollment.userName} ${s.enrollment.userEmail}`.toLowerCase().includes(term.toLowerCase()),
    );
    const by: Record<typeof sort, (s: StudentReport) => number | string> = {
      name: (s) => s.enrollment.userName.toLowerCase(),
      progress: (s) => -s.progress,
      video: (s) => -(s.videoPercent ?? -1),
      mark: (s) => -(s.averageMark ?? -1),
      active: (s) => -(s.lastActive?.getTime() ?? 0),
    };
    return [...rows].sort((a, b) => {
      const x = by[sort](a);
      const y = by[sort](b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }, [report.students, term, sort]);

  const selectedStudent = report.students.find((s) => s.enrollment.userId === selected) ?? null;

  function exportStudents() {
    if (!course) return;
    downloadCsv(
      `${course.code || course.title}-student-report.csv`,
      [
        "Student", "Email", "Status", "Course progress %", "Lessons completed", "Lessons total",
        "Video watched %", "Video watched (h:mm:ss)", "Video total (h:mm:ss)", "Required coursework passed",
        "Required coursework total", "Submissions", "Average mark %", "Enrolled", "Last active",
      ],
      report.students.map((s) => [
        s.enrollment.userName,
        s.enrollment.userEmail,
        s.enrollment.status,
        s.progress,
        s.lessonsDone,
        s.lessonsTotal,
        s.videoPercent ?? "",
        formatClock(s.watchedSeconds),
        formatClock(s.videoSeconds),
        s.courseworkPassed,
        s.courseworkRequired,
        s.submitted,
        s.averageMark ?? "",
        formatDate(s.enrollment.enrolledAt),
        s.lastActive ? formatDateTime(s.lastActive) : "",
      ]),
    );
  }

  if (!courses.loading && courses.data.length === 0) {
    return (
      <div>
        <PageHeader title="Reports" description="Learner progress, video watching and marks." />
        <EmptyState icon={BarChart3} title="No courses to report on yet" description="Reports appear once you have courses with enrolled learners." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Course progress, video watching and marks for every learner."
        actions={
          <Button variant="outline" onClick={exportStudents} disabled={report.loading || report.students.length === 0}>
            <Download /> Export student report
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={courseId ?? ""}
          onChange={(e) => router.replace(`${pathname}?course=${e.target.value}`, { scroll: false })}
          className="sm:w-96"
          aria-label="Course"
        >
          {courses.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} — ` : ""}
              {c.title}
            </option>
          ))}
        </Select>
        {course && (
          <p className="text-xs text-slate-500">
            {course.lessonCount} lessons · {report.videoLessonCount} videos · {course.requiredCourseworkIds?.length ?? 0} required coursework
          </p>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Enrolled" value={report.loading ? "–" : report.summary.enrolled} icon={Users} />
        <StatCard label="Completed" value={report.loading ? "–" : report.summary.completed} icon={Award} tone="emerald" />
        <StatCard label="Avg. progress" value={report.loading ? "–" : pct(report.summary.averageProgress)} icon={GraduationCap} tone="violet" />
        <StatCard label="Avg. video watched" value={report.loading ? "–" : pct(report.summary.averageVideo)} icon={PlayCircle} tone="amber" />
        <StatCard label="Avg. mark" value={report.loading ? "–" : pct(report.summary.averageMark)} icon={ClipboardCheck} tone="rose" />
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">
            <Users /> Students
          </TabsTrigger>
          <TabsTrigger value="lessons">
            <PlayCircle /> Lessons & videos
          </TabsTrigger>
          <TabsTrigger value="coursework">
            <ClipboardCheck /> Coursework & marks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput value={term} onChange={setTerm} placeholder="Search students" className="sm:w-72" />
            <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="sm:w-56" aria-label="Sort by">
              <option value="name">Sort: name</option>
              <option value="progress">Sort: course progress</option>
              <option value="video">Sort: video watched</option>
              <option value="mark">Sort: average mark</option>
              <option value="active">Sort: last active</option>
            </Select>
          </div>
          {report.loading ? (
            <Skeleton className="h-72 w-full" />
          ) : students.length === 0 ? (
            <EmptyState icon={Users} title={report.students.length ? "No matching students" : "No learners enrolled yet"} />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-3 py-3">Course progress</th>
                      <th className="px-3 py-3">Lessons</th>
                      <th className="px-3 py-3">Video watched</th>
                      <th className="px-3 py-3">Coursework</th>
                      <th className="px-3 py-3">Avg. mark</th>
                      <th className="px-5 py-3">Last active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => (
                      <tr
                        key={s.enrollment.userId}
                        onClick={() => setSelected(s.enrollment.userId)}
                        className="cursor-pointer hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.enrollment.userName} size="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSelected(s.enrollment.userId);
                                }}
                                className="block truncate text-left font-medium text-slate-900 hover:text-brand-700"
                              >
                                {s.enrollment.userName}
                              </button>
                              <p className="truncate text-xs text-slate-500">{s.enrollment.userEmail}</p>
                            </div>
                            {s.enrollment.status === "completed" && <Badge tone="success">Completed</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Meter value={s.progress} />
                        </td>
                        <td className="px-3 py-3 text-slate-700 tabular-nums">
                          {s.lessonsDone}/{s.lessonsTotal}
                        </td>
                        <td className="px-3 py-3">
                          <Meter value={s.videoPercent} />
                          {s.videoSeconds > 0 && (
                            <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                              {formatClock(s.watchedSeconds)} / {formatClock(s.videoSeconds)}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {s.courseworkRequired > 0 ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                s.courseworkPassed >= s.courseworkRequired ? "text-emerald-700" : "text-amber-700",
                              )}
                            >
                              {s.courseworkPassed >= s.courseworkRequired ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                              {s.courseworkPassed}/{s.courseworkRequired} passed
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">{s.submitted} submitted</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800 tabular-nums">{pct(s.averageMark)}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{s.lastActive ? timeAgo(s.lastActive) : "Never"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lessons">
          {report.loading ? (
            <Skeleton className="h-72 w-full" />
          ) : report.lessons.length === 0 ? (
            <EmptyState icon={BookOpen} title="No lessons yet" />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex justify-end border-b border-slate-100 px-5 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    course &&
                    downloadCsv(
                      `${course.code || course.title}-lesson-report.csv`,
                      ["Module", "Lesson", "Type", "Completed by", "Started by", "Average watched %", "Enrolled"],
                      report.lessons.map((l) => [
                        l.moduleTitle,
                        l.lesson.title,
                        l.lesson.type,
                        l.completedBy,
                        l.startedBy,
                        l.averageWatched ?? "",
                        report.summary.enrolled,
                      ]),
                    )
                  }
                >
                  <Download /> Export
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                      <th className="px-5 py-3">Lesson</th>
                      <th className="px-3 py-3">Completed by</th>
                      <th className="px-3 py-3">Watching started</th>
                      <th className="px-5 py-3">Average watched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.lessons.map((l) => (
                      <tr key={l.lesson.id}>
                        <td className="max-w-0 px-5 py-3">
                          <span className="flex items-center gap-2">
                            {l.lesson.type === "video" ? <PlayCircle className="size-4 shrink-0 text-brand-500" /> : <FileText className="size-4 shrink-0 text-emerald-500" />}
                            <span className="truncate font-medium text-slate-800">{l.lesson.title}</span>
                          </span>
                          <p className="truncate pl-6 text-xs text-slate-500">{l.moduleTitle}</p>
                        </td>
                        <td className="px-3 py-3">
                          <Meter value={report.summary.enrolled ? Math.round((l.completedBy / report.summary.enrolled) * 100) : null} tone="success" />
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {l.completedBy}/{report.summary.enrolled} learners
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{l.lesson.hasVideo ? `${l.startedBy} learners` : "—"}</td>
                        <td className="px-5 py-3">{l.lesson.hasVideo ? <Meter value={l.averageWatched} /> : <span className="text-xs text-slate-400">Reading</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="coursework">
          {report.loading ? (
            <Skeleton className="h-72 w-full" />
          ) : report.coursework.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No coursework yet" description="Add coursework to modules from the course's curriculum." />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex justify-end border-b border-slate-100 px-5 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    course &&
                    downloadCsv(
                      `${course.code || course.title}-marks.csv`,
                      ["Student", "Email", ...report.coursework.map((c) => `${c.assignment.title} (/${c.assignment.points})`), "Average %"],
                      report.students.map((s) => [
                        s.enrollment.userName,
                        s.enrollment.userEmail,
                        ...s.coursework.map((c) => (c.submission?.status === "graded" ? (c.submission.grade ?? "") : c.submission ? "submitted" : "")),
                        s.averageMark ?? "",
                      ]),
                    )
                  }
                >
                  <Download /> Export gradebook
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                      <th className="px-5 py-3">Coursework</th>
                      <th className="px-3 py-3">Submitted</th>
                      <th className="px-3 py-3">Graded</th>
                      <th className="px-3 py-3">Average mark</th>
                      <th className="px-5 py-3">Pass rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.coursework.map((c) => (
                      <tr key={c.assignment.id}>
                        <td className="max-w-0 px-5 py-3">
                          <p className="truncate font-medium text-slate-800">{c.assignment.title}</p>
                          <p className="text-xs text-slate-500">
                            {c.assignment.points} pts{passMarkOf(c.assignment) > 0 ? ` · pass ${passMarkOf(c.assignment)}` : ""}
                            {c.assignment.required ? " · Required" : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-700 tabular-nums">
                          {c.submitted}/{report.summary.enrolled}
                        </td>
                        <td className="px-3 py-3 text-slate-700 tabular-nums">{c.graded}</td>
                        <td className="px-3 py-3">
                          <Meter value={c.averageMark} />
                        </td>
                        <td className="px-5 py-3">{passMarkOf(c.assignment) > 0 ? <Meter value={c.passRate} tone="success" /> : <span className="text-xs text-slate-400">No pass mark</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selectedStudent && course && <StudentDetail course={course} student={selectedStudent} onClose={() => setSelected(null)} />}
    </div>
  );
}
