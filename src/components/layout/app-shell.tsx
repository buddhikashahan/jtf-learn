"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  MailWarning,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/providers/theme";
import { navFor, navGroupLabels, roleLabels, type NavItem } from "@/config/site";
import { useAccessibleCourses, useLiveSessionsFor, useNow } from "@/hooks/use-lms";
import { useNotifications } from "@/hooks/use-notifications";
import { Logo } from "./logo";
import { CommandPalette, SearchTrigger } from "./command-palette";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resendVerificationEmail, signOut } from "@/lib/services/auth";
import { getErrorMessage } from "@/lib/errors";
import { cn, liveStatus, safeExternalUrl } from "@/lib/utils";
import { JoinMeetingLink } from "@/components/live/session-row";

const COLLAPSE_KEY = "sidebar-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const profile = useProfile();
  const pathname = usePathname();
  const { unread } = useNotifications(30);
  const items = navFor(profile.role);
  const groups = (Object.keys(navGroupLabels) as NavItem["group"][])
    .map((g) => ({ key: g, label: navGroupLabels[g], items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav aria-label="Main" className="flex-1 space-y-5 px-3">
      {groups.map((group) => (
        <div key={group.key}>
          {group.label &&
            (collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-slate-200" aria-hidden />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{group.label}</p>
            ))}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.href === "/notifications" ? unread : 0;
              return (
                <li key={item.href}>
                  <Tooltip content={item.label} disabled={!collapsed}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition",
                        collapsed ? "justify-center px-0" : "px-3",
                        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      {active && (
                        <span className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r-full bg-brand-600" aria-hidden />
                      )}
                      <item.icon
                        className={cn(
                          "size-[18px] shrink-0",
                          active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-500",
                        )}
                      />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {count > 0 &&
                        (collapsed ? (
                          <span className="absolute top-1 right-2 size-2 rounded-full bg-red-500" aria-hidden />
                        ) : (
                          <span className="rounded-full bg-danger px-1.5 text-[10px] leading-4 font-semibold text-white">
                            {count > 9 ? "9+" : count}
                          </span>
                        ))}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  const profile = useProfile();
  if (collapsed) {
    return (
      <div className="flex justify-center p-3">
        <Tooltip content={`${profile.displayName} · ${roleLabels[profile.role]}`}>
          <Link href="/settings" aria-label="Your profile">
            <Avatar name={profile.displayName} src={profile.photoURL} size="sm" />
          </Link>
        </Tooltip>
      </div>
    );
  }
  return (
    <Link
      href="/settings"
      className="m-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300"
    >
      <Avatar name={profile.displayName} src={profile.photoURL} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{profile.displayName}</p>
        <p className="truncate text-xs text-slate-500">{roleLabels[profile.role]}</p>
      </div>
    </Link>
  );
}

// ── Top bar pieces ───────────────────────────────────────────────────────────
function UserMenu() {
  const profile = useProfile();
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
      router.replace("/login");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100"
        aria-label="Account menu"
      >
        <Avatar name={profile.displayName} src={profile.photoURL} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <span className="flex items-center gap-3">
            <Avatar name={profile.displayName} src={profile.photoURL} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{profile.displayName}</span>
              <span className="block truncate">{profile.email}</span>
            </span>
          </span>
        </DropdownMenuLabel>
        <div className="px-2.5 pb-2">
          <Badge tone={profile.role === "student" ? "brand" : profile.role === "instructor" ? "success" : "danger"} dot>
            {roleLabels[profile.role]}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings?tab=security")}>
          <Settings /> Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VerifyEmailBanner() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const needsVerification =
    user && !user.emailVerified && user.providerData.some((p) => p.providerId === "password");
  if (!needsVerification) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <MailWarning className="size-4 text-amber-600" />
      <span>Please verify your email address to secure your account.</span>
      <button
        type="button"
        disabled={sent}
        onClick={async () => {
          try {
            await resendVerificationEmail();
            setSent(true);
            toast.success("Verification email sent.");
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
        className="font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-70"
      >
        {sent ? "Email sent" : "Resend email"}
      </button>
    </div>
  );
}

/** Site-wide banner whenever a class the user belongs to is live right now. */
function LiveNowBanner() {
  const pathname = usePathname();
  const now = useNow(20_000);
  const { courses, loading } = useAccessibleCourses();
  const ids = useMemo(() => (loading ? null : courses.map((c) => c.id)), [loading, courses]);
  const sessions = useLiveSessionsFor(ids);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const live = sessions.data.find((s) => liveStatus(s, now) === "live");
  if (!live || dismissed === live.id || pathname.startsWith("/live/")) return null;

  return (
    <div className="flex items-center gap-3 border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 sm:px-6 lg:px-8">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
      </span>
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">Live now:</span> {live.title}
        <span className="hidden opacity-75 sm:inline"> · {live.courseTitle}</span>
      </p>
      {safeExternalUrl(live.meetingUrl) ? (
        <JoinMeetingLink
          session={live}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-danger px-3 py-1 text-xs font-semibold text-white hover:bg-danger-hover"
        >
          <Radio className="size-3.5" /> Join
        </JoinMeetingLink>
      ) : (
        <Link
          href={`/live/${live.courseId}/${live.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-danger px-3 py-1 text-xs font-semibold text-white hover:bg-danger-hover"
        >
          <Radio className="size-3.5" /> Details
        </Link>
      )}
      <button
        type="button"
        onClick={() => setDismissed(live.id)}
        className="rounded p-1 opacity-70 hover:bg-red-100 hover:opacity-100"
        aria-label="Dismiss live class banner"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The shell only renders on the client (behind AuthGuard), so reading
  // localStorage in the initializer cannot cause a hydration mismatch.
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-dvh">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-surface transition-[width] duration-200 lg:flex",
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "px-6")}>
            <Logo href="/dashboard" compact={collapsed} />
          </div>
          <div className="scrollbar-thin mt-2 flex flex-1 flex-col overflow-y-auto">
            <SidebarNav collapsed={collapsed} />
          </div>
          <div className={cn("px-3", collapsed && "flex justify-center")}>
            <Tooltip content="Expand sidebar" disabled={!collapsed}>
              <button
                type="button"
                onClick={toggleCollapsed}
                className={cn(
                  "flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800",
                  collapsed ? "justify-center px-2.5" : "w-full px-3",
                )}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
                {!collapsed && "Collapse"}
              </button>
            </Tooltip>
          </div>
          <SidebarFooter collapsed={collapsed} />
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="Navigation">
          <div className="flex h-16 items-center px-5">
            <Logo href="/dashboard" />
          </div>
          <div className="mt-2 flex flex-1 flex-col overflow-y-auto">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
          <SidebarFooter />
        </Sheet>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
            <VerifyEmailBanner />
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="-ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </button>
              <div className="lg:hidden">
                <Logo href="/dashboard" compact />
              </div>
              <div className="hidden flex-1 md:block">
                <SearchTrigger onOpen={() => setPaletteOpen(true)} />
              </div>
              <div className="ml-auto flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
                  aria-label="Search"
                >
                  <Search className="size-5" />
                </button>
                <ThemeToggle />
                <NotificationBell />
                <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
                <UserMenu />
              </div>
            </div>
            <LiveNowBanner />
          </header>
          <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
