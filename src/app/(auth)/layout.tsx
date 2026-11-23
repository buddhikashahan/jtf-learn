import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { siteConfig } from "@/config/site";

const highlights = [
  "Structured courses with video lessons, notes & resources",
  "Submit assignments and get graded feedback",
  "Join live classes and catch up on recordings",
  "Track your progress and earn certificates",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="theme-light relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-brand-600),transparent_60%),radial-gradient(ellipse_at_bottom_right,var(--color-brand-800),transparent_55%)] opacity-80"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:48px_48px]"
        />
        <div className="relative">
          <div className="theme-light inline-flex rounded-xl bg-white/95 px-3 py-2">
            <Logo />
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white">
            Build real-world skills with {siteConfig.name}.
          </h2>
          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3 text-brand-100">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-300" />
                <span className="text-sm">{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200/70">
          © {siteConfig.name}. All rights reserved.
        </p>
      </aside>

      <main id="main-content" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
