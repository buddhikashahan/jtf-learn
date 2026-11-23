"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook up an error-reporting service (e.g. Sentry) here.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-[60dvh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="size-7 text-red-600" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">An unexpected error occurred. Please try again.</p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
