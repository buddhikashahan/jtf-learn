"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/components/providers/auth-provider";
import { useNotifications } from "@/hooks/use-notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead } from "@/lib/services/notifications";
import { toDate } from "@/lib/utils";
import { NotificationList } from "./notification-list";

export const DESKTOP_NOTIFICATIONS_KEY = "desktop-notifications";

function desktopEnabled() {
  try {
    return (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY) === "on"
    );
  } catch {
    return false;
  }
}

export function NotificationBell() {
  const profile = useProfile();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, loading, unread } = useNotifications(30);
  const mountedAt = useRef<number | null>(null);
  const seen = useRef(new Set<string>());

  // Pop a toast (and a desktop notification when the tab is hidden) for
  // notifications that arrive while the app is open.
  useEffect(() => {
    if (loading) return;
    if (mountedAt.current === null) {
      mountedAt.current = Date.now();
      data.forEach((n) => seen.current.add(n.id));
      return;
    }
    for (const n of data) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      const created = toDate(n.createdAt)?.getTime() ?? Date.now();
      if (n.read || created < mountedAt.current - 5_000) continue;
      toast(n.title, {
        description: n.body || undefined,
        action: { label: "View", onClick: () => router.push(n.link) },
      });
      if (document.hidden && desktopEnabled()) {
        try {
          const desktop = new Notification(n.title, { body: n.body, tag: n.id, icon: "/favicon.ico" });
          desktop.onclick = () => {
            window.focus();
            router.push(n.link);
          };
        } catch {
          /* ignore */
        }
      }
    }
  }, [data, loading, router]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <p className="text-xs text-slate-500">{unread ? `${unread} unread` : "No unread notifications"}</p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllNotificationsRead(profile.uid)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="scrollbar-thin max-h-[min(28rem,70vh)] overflow-y-auto">
          <NotificationList items={data.slice(0, 8)} loading={loading} onNavigate={() => setOpen(false)} emptyCompact />
        </div>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
