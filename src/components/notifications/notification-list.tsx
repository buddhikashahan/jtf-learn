"use client";

import Link from "next/link";
import {
  Award,
  BellOff,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  Megaphone,
  MessageCircle,
  Trash2,
  UserPlus,
  Video,
} from "lucide-react";
import { useProfile } from "@/components/providers/auth-provider";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { deleteNotification, markNotificationRead } from "@/lib/services/notifications";
import { cn, timeAgo } from "@/lib/utils";
import type { AppNotification, NotificationType, WithId } from "@/types";

export const notificationMeta: Record<NotificationType, { icon: typeof Inbox; tone: string; label: string }> = {
  announcement: { icon: Megaphone, tone: "bg-violet-50 text-violet-600", label: "Announcement" },
  assignment_created: { icon: ClipboardList, tone: "bg-amber-50 text-amber-600", label: "Assignment" },
  assignment_graded: { icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-600", label: "Grade" },
  submission_received: { icon: Inbox, tone: "bg-sky-50 text-sky-600", label: "Submission" },
  live_scheduled: { icon: Video, tone: "bg-red-50 text-red-600", label: "Live class" },
  enrolled: { icon: UserPlus, tone: "bg-brand-50 text-brand-600", label: "Enrolment" },
  discussion: { icon: MessageCircle, tone: "bg-brand-50 text-brand-600", label: "Discussion" },
  course_completed: { icon: Award, tone: "bg-emerald-50 text-emerald-600", label: "Achievement" },
};

export function NotificationItem({
  item,
  onNavigate,
  showActions = false,
}: {
  item: WithId<AppNotification>;
  onNavigate?: () => void;
  showActions?: boolean;
}) {
  const profile = useProfile();
  const meta = notificationMeta[item.type] ?? notificationMeta.discussion;
  const Icon = meta.icon;

  return (
    <div className={cn("group relative flex gap-3 px-4 py-3 transition hover:bg-slate-50", !item.read && "bg-brand-50/40")}>
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
        <Icon className="size-[18px]" />
      </span>
      <Link
        href={item.link}
        onClick={() => {
          if (!item.read) void markNotificationRead(profile.uid, item.id).catch(() => undefined);
          onNavigate?.();
        }}
        className="min-w-0 flex-1 after:absolute after:inset-0"
      >
        <p className={cn("text-sm text-slate-800", !item.read && "font-semibold text-slate-900")}>{item.title}</p>
        {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>}
        <p className="mt-1 text-[11px] text-slate-400">
          {meta.label} · {timeAgo(item.createdAt)}
        </p>
      </Link>
      <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
        {!item.read && <span className="mt-1.5 size-2 rounded-full bg-brand-500" aria-label="Unread" />}
        {showActions && (
          <div className="flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => markNotificationRead(profile.uid, item.id, !item.read)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={item.read ? "Mark as unread" : "Mark as read"}
              title={item.read ? "Mark as unread" : "Mark as read"}
            >
              <CheckCheck className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => deleteNotification(profile.uid, item.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Delete notification"
              title="Delete"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationList({
  items,
  loading,
  onNavigate,
  showActions,
  emptyCompact,
}: {
  items: WithId<AppNotification>[];
  loading: boolean;
  onNavigate?: () => void;
  showActions?: boolean;
  emptyCompact?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="You're all caught up"
        description="New announcements, grades and reminders will appear here."
        className={cn("border-none", emptyCompact && "py-8")}
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((n) => (
        <li key={n.id}>
          <NotificationItem item={n} onNavigate={onNavigate} showActions={showActions} />
        </li>
      ))}
    </ul>
  );
}
