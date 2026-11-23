"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Lock, Printer } from "lucide-react";
import { useProfile } from "@/components/providers/auth-provider";
import { useCourse, useEnrollment } from "@/hooks/use-lms";
import { Button, buttonVariants } from "@/components/ui/button";
import { FullPageLoader } from "@/components/ui/feedback";
import { StatusScreen } from "@/components/auth/auth-guard";
import { siteConfig } from "@/config/site";
import { formatDate } from "@/lib/utils";

export function CertificateView({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const profile = useProfile();
  const course = useCourse(courseId);
  const enrollment = useEnrollment(courseId, profile.uid);

  if (course.loading || enrollment.loading) return <FullPageLoader label="Loading certificate" />;

  const c = course.data;
  const e = enrollment.data;
  if (!c || !e || e.status !== "completed") {
    return (
      <StatusScreen
        icon={Lock}
        title="Certificate not available yet"
        description="Complete every lesson in the course to unlock your certificate of completion."
        action={
          <Link href={c ? `/learn/${c.id}` : "/courses"} className={buttonVariants()}>
            {c ? "Continue course" : "My courses"}
          </Link>
        }
      />
    );
  }

  // Deterministic, human-readable reference for verification by the training team.
  const reference = `${(c.code || "JTF").replace(/[^A-Z0-9]/gi, "")}-${profile.uid.slice(0, 6).toUpperCase()}`;

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-4xl items-center justify-between">
        <Link href={`/courses/${c.id}`} className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft /> Back to course
        </Link>
        <Button onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>

      <main
        id="main-content"
        className="theme-light mx-auto aspect-[1.414/1] max-w-4xl bg-white p-3 shadow-elevated print:max-w-none print:shadow-none"
      >
        <div className="relative flex h-full flex-col items-center justify-center border-[6px] border-double border-brand-800 px-10 text-center">
          <div className="absolute inset-3 border border-brand-200" aria-hidden />
          <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-50/50">
            <Award className="size-8 text-brand-700" />
          </div>
          <p className="mt-6 text-xs font-semibold tracking-[0.3em] text-brand-700 uppercase">Certificate of completion</p>
          <p className="mt-6 text-sm text-slate-500">This is to certify that</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-slate-900 sm:text-5xl">{profile.displayName}</h1>
          <p className="mt-5 max-w-xl text-sm text-slate-600">has successfully completed all requirements of the course</p>
          <h2 className="mt-2 text-xl font-semibold text-brand-800 sm:text-2xl">{c.title}</h2>
          {c.cohort && <p className="mt-1 text-sm text-slate-500">{c.cohort}</p>}

          <div className="mt-12 grid w-full max-w-2xl grid-cols-3 items-end gap-6 text-xs text-slate-500">
            <div>
              <p className="border-t border-slate-300 pt-2 font-medium text-slate-800">{formatDate(e.completedAt, "MMMM d, yyyy")}</p>
              <p>Date of completion</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{siteConfig.name}</p>
            </div>
            <div>
              <p className="border-t border-slate-300 pt-2 font-medium text-slate-800">
                {c.instructorNames[0] ?? "Course Instructor"}
              </p>
              <p>Instructor</p>
            </div>
          </div>
          <p className="absolute right-6 bottom-5 font-mono text-[10px] text-slate-400">Ref: {reference}</p>
        </div>
      </main>
    </div>
  );
}
