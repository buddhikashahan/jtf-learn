import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50">
          <Compass className="size-7 text-brand-600" />
        </div>
        <p className="mt-5 text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
