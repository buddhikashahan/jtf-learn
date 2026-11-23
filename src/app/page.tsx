import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  ClipboardList,
  PlayCircle,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const features = [
  {
    icon: BookOpen,
    title: "Structured courses",
    body: "Modules and lessons with video, rich reading material and downloadable resources.",
  },
  {
    icon: ClipboardList,
    title: "Assignments & grading",
    body: "Secure file submissions, deadlines, rubric points and written feedback from instructors.",
  },
  {
    icon: Video,
    title: "Live classes",
    body: "Schedule live sessions, join with one click and catch up later with recordings.",
  },
  {
    icon: BarChart3,
    title: "Progress tracking",
    body: "Per-lesson completion, course progress and a personalised dashboard for every learner.",
  },
  {
    icon: Award,
    title: "Certificates",
    body: "Learners receive a printable certificate of completion when they finish a course.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Role-based access for students, instructors and admins enforced by Firebase security rules.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-surface">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
              Sign in
            </Link>
            <Link href="/register" className={buttonVariants()}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-brand-100),transparent)]"
          />
          <div className="mx-auto max-w-4xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface px-3 py-1 text-xs font-medium text-brand-700 shadow-sm">
              <PlayCircle className="size-3.5" /> {siteConfig.name}
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-6xl">
              Hands-on technical training, <span className="text-brand-600">all in one place.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-slate-600">{siteConfig.description}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
                Start learning <ArrowRight />
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Everything a training program needs</h2>
              <p className="mt-3 text-slate-600">
                Designed for learners, instructors and administrators — with the right tools for each role.
              </p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-card">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="theme-light relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center sm:px-12">
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-brand-600),transparent_60%)]"
              />
              <h2 className="relative text-2xl font-semibold text-white sm:text-3xl">Ready to begin?</h2>
              <p className="relative mx-auto mt-3 max-w-xl text-brand-100">
                Create your free account and get access to your enrolled programs instantly.
              </p>
              <Link
                href="/register"
                className={buttonVariants({
                  size: "lg",
                  className: "relative mt-8 bg-surface text-brand-700 hover:bg-brand-50",
                })}
              >
                Create account <ArrowRight />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>© {siteConfig.name}</p>
        </div>
      </footer>
    </div>
  );
}
