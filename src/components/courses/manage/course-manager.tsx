"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Eye, Info, Lock, Megaphone, Users } from "lucide-react";
import { CourseAnnouncements } from "@/components/announcements/announcements";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { useCourse } from "@/hooks/use-lms";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusTone } from "../course-card";
import { DetailsPanel } from "./details-panel";
import { CurriculumEditor } from "./curriculum-editor";
import { StudentsPanel } from "./students-panel";

const TABS = ["details", "curriculum", "students", "announcements"] as const;
type Tab = (typeof TABS)[number];

export function CourseManager({ routeParams }: { routeParams: Promise<{ courseId: string }> }) {
  const { courseId } = use(routeParams);
  const profile = useProfile();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const course = useCourse(courseId);
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "curriculum");

  if (course.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const c = course.data;
  const canManage = c && (isAdmin || (profile.role === "instructor" && c.instructorIds.includes(profile.uid)));
  if (!c || !canManage) {
    return (
      <EmptyState
        icon={Lock}
        title="You can't manage this course"
        description="It doesn't exist, or you're not assigned as an instructor."
        action={
          <Link href="/courses" className={buttonVariants()}>
            Back to courses
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/courses", label: "All courses" }}
        eyebrow={
          <div className="flex items-center gap-2">
            {c.code && <span className="font-mono text-xs font-semibold text-slate-500">{c.code}</span>}
            <Badge tone={statusTone[c.status]} dot className="capitalize">
              {c.status}
            </Badge>
          </div>
        }
        title={c.title}
        actions={
          <Link href={`/courses/${c.id}`} className={buttonVariants({ variant: "outline" })}>
            <Eye /> View as learner
          </Link>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          router.replace(`${pathname}?tab=${v}`, { scroll: false });
        }}
      >
        <TabsList>
          <TabsTrigger value="curriculum">
            <BookOpen /> Curriculum
          </TabsTrigger>
          <TabsTrigger value="details">
            <Info /> Details
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users /> Students
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Megaphone /> Announcements
          </TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum">
          <CurriculumEditor course={c} />
        </TabsContent>
        <TabsContent value="details">
          <DetailsPanel course={c} />
        </TabsContent>
        <TabsContent value="students">
          <StudentsPanel course={c} />
        </TabsContent>
        <TabsContent value="announcements" className="max-w-3xl">
          <CourseAnnouncements course={c} canManage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
