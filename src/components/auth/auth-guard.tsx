"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ShieldOff, Wrench } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { FullPageLoader } from "@/components/ui/feedback";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/services/auth";
import type { Role } from "@/types";

/**
 * Client-side route guard. This is a UX layer only — all data access is
 * enforced server-side by Firestore & Storage security rules.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, error, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [configured, loading, user, router, pathname]);

  if (!configured) return <SetupRequired />;
  if (loading || !user) return <FullPageLoader label="Loading your workspace" />;
  if (error || !profile) {
    return (
      <StatusScreen
        icon={AlertTriangle}
        title="We couldn't load your profile"
        description="Please check your connection and try again. If the problem persists, contact your administrator."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        }
      />
    );
  }
  return <>{children}</>;
}

/** Renders children only for the allowed roles; shows a 403 otherwise. */
export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) {
    return (
      <StatusScreen
        icon={ShieldOff}
        title="You don't have access to this page"
        description="This area is restricted. If you believe this is a mistake, contact your administrator."
        action={
          <Link href="/dashboard" className={buttonVariants()}>
            Back to dashboard
          </Link>
        }
        inline
      />
    );
  }
  return <>{children}</>;
}

export function StatusScreen({
  icon: Icon,
  title,
  description,
  action,
  inline = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "flex justify-center py-20" : "flex min-h-dvh items-center justify-center p-6"}>
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100">
          <Icon className="size-7 text-slate-500" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        {action && <div className="mt-6 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

function SetupRequired() {
  return (
    <StatusScreen
      icon={Wrench}
      title="Firebase is not configured"
      description="Copy .env.example to .env.local, add your Firebase web app credentials, then restart the dev server. See README.md for full setup steps."
    />
  );
}
