"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { query, where } from "firebase/firestore";
import { ImageUp, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { useCollection } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Avatar } from "@/components/ui/avatar";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CourseForm } from "../course-form-dialog";
import { CourseCover } from "../course-card";
import { deleteCourse, setCourseInstructors, uploadCourseCover } from "@/lib/services/courses";
import { getErrorMessage } from "@/lib/errors";
import type { Course, UserProfile, WithId } from "@/types";

function CoverCard({ course }: { course: WithId<Course> }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload() {
    if (!file) return;
    setProgress(0);
    try {
      await uploadCourseCover(course.id, file, setProgress, course.coverImageUrl);
      toast.success("Cover image updated");
      setFile(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cover image</CardTitle>
          <CardDescription>Shown on course cards. Recommended 1600×600, max 5 MB.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CourseCover course={course} className="aspect-[21/8] rounded-lg" />
        <FileDropzone kind="cover" file={file} onFileChange={setFile} progress={progress} disabled={progress !== null} hint="PNG, JPG or WEBP up to 5 MB" />
        {file && (
          <Button onClick={upload} loading={progress !== null} className="w-full">
            <ImageUp /> Upload cover
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function InstructorsCard({ course }: { course: WithId<Course> }) {
  const q = useMemo(() => query(refs.users(), where("role", "in", ["instructor", "admin"])), []);
  const staff = useCollection<UserProfile>(q);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  const current = course.instructorIds.map((id, i) => ({ uid: id, displayName: course.instructorNames[i] ?? "Unknown" }));
  const available = staff.data.filter((u) => !course.instructorIds.includes(u.uid) && u.role === "instructor");

  async function save(next: { uid: string; displayName: string }[]) {
    setBusy(true);
    try {
      await setCourseInstructors(course.id, next);
      toast.success("Instructors updated");
      setSelected("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Instructors</CardTitle>
          <CardDescription>Instructors can edit content, grade work and run live classes.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {current.map((i) => (
            <li key={i.uid} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <Avatar name={i.displayName} size="sm" />
              <span className="flex-1 truncate text-sm font-medium text-slate-800">{i.displayName}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${i.displayName}`}
                disabled={busy}
                onClick={() => save(current.filter((x) => x.uid !== i.uid))}
              >
                <X />
              </Button>
            </li>
          ))}
          {current.length === 0 && <li className="text-sm text-slate-500">No instructors assigned.</li>}
        </ul>
        <div className="flex gap-2">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Select instructor">
            <option value="">{staff.loading ? "Loading…" : available.length ? "Select an instructor" : "No more instructors"}</option>
            {available.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            disabled={!selected}
            loading={busy}
            onClick={() => {
              const u = available.find((x) => x.uid === selected);
              if (u) save([...current, { uid: u.uid, displayName: u.displayName }]);
            }}
          >
            <UserPlus /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DangerZone({ course }: { course: WithId<Course> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-red-200">
      <CardHeader>
        <div>
          <CardTitle className="text-red-700">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete this course, its curriculum, enrolments, assignments and submissions.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 /> Delete course
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={`Delete “${course.title}”?`}
          description="This permanently deletes the course with all lessons, videos and files, coursework and grades, live classes and their recordings, and every learner's progress and notes. It cannot be undone — consider archiving the course instead to keep learner records."
          confirmLabel="Delete permanently"
          onConfirm={async () => {
            await deleteCourse(course.id);
            toast.success("Course deleted");
            router.replace("/courses");
          }}
        />
      </CardContent>
    </Card>
  );
}

export function DetailsPanel({ course }: { course: WithId<Course> }) {
  const { isAdmin } = useAuth();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Course details</CardTitle>
            <CardDescription>Publish the course to make it visible in the catalog.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CourseForm course={course} />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <CoverCard course={course} />
        {isAdmin && <InstructorsCard course={course} />}
        {isAdmin && <DangerZone course={course} />}
      </div>
    </div>
  );
}
