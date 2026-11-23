"use client";

import { useMemo } from "react";
import { limit, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/components/providers/auth-provider";
import { refs } from "@/lib/services/refs";
import { useCollection } from "./use-firestore";
import type { AppNotification, NotificationPrefs, NotificationType } from "@/types";

/** Which preference category controls each notification type (null = always on). */
export const notificationCategory: Record<NotificationType, keyof NotificationPrefs | null> = {
  assignment_created: "assignments",
  submission_received: "assignments",
  assignment_graded: "grades",
  live_scheduled: "liveClasses",
  announcement: "announcements",
  discussion: null,
  enrolled: null,
  course_completed: null,
};

export function isEnabled(type: NotificationType, prefs: NotificationPrefs | undefined) {
  const cat = notificationCategory[type];
  return !cat || !prefs || prefs[cat] !== false;
}

/** Real-time notification inbox for the signed-in user, respecting preferences. */
export function useNotifications(max = 50) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const q = useMemo(
    () => (uid ? query(refs.notifications(uid), orderBy("createdAt", "desc"), limit(max)) : null),
    [uid, max],
  );
  const result = useCollection<AppNotification>(q);
  const prefs = profile?.notifications;
  return useMemo(() => {
    const items = result.data.filter((n) => isEnabled(n.type, prefs));
    return { ...result, data: items, unread: items.filter((n) => !n.read).length };
  }, [result, prefs]);
}
