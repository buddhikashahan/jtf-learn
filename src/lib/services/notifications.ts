import { doc, getDocs, serverTimestamp, updateDoc, deleteDoc, writeBatch, query, where, limit } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { NotificationType, UserProfile } from "@/types";
import { refs } from "./refs";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  link: string;
  courseId: string | null;
}

type Actor = Pick<UserProfile, "uid" | "displayName">;

const BATCH_SIZE = 200;

/**
 * Fan-out an in-app notification to recipients (written by the actor; access
 * is constrained by firestore.rules → canNotify). Never notifies the actor.
 * Notifications are best-effort: failures never break the primary action.
 */
export async function notify(
  recipientIds: string[],
  input: NotificationInput,
  actor: Actor,
  { includeSelf = false }: { includeSelf?: boolean } = {},
): Promise<void> {
  const recipients = [...new Set(recipientIds)].filter((id) => id && (includeSelf || id !== actor.uid));
  if (recipients.length === 0) return;
  const payload = {
    type: input.type,
    title: input.title.slice(0, 140),
    body: (input.body ?? "").slice(0, 500),
    link: input.link.startsWith("/") && !input.link.startsWith("//") ? input.link.slice(0, 300) : "/notifications",
    courseId: input.courseId,
    actorId: actor.uid,
    actorName: actor.displayName.slice(0, 80),
    read: false,
    createdAt: serverTimestamp(),
  };
  try {
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore());
      recipients.slice(i, i + BATCH_SIZE).forEach((uid) => batch.set(doc(refs.notifications(uid)), payload));
      await batch.commit();
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Notification fan-out failed", error);
  }
}

/** Staff only: ids of every learner enrolled in a course. */
export async function courseStudentIds(courseId: string): Promise<string[]> {
  try {
    const snap = await getDocs(refs.enrollments(courseId));
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

export async function notifyCourseStudents(courseId: string, input: NotificationInput, actor: Actor) {
  await notify(await courseStudentIds(courseId), input, actor);
}

export async function markNotificationRead(uid: string, id: string, read = true) {
  await updateDoc(refs.notification(uid, id), { read });
}

export async function markAllNotificationsRead(uid: string) {
  const snap = await getDocs(query(refs.notifications(uid), where("read", "==", false), limit(400)));
  if (snap.empty) return;
  const batch = writeBatch(firestore());
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function deleteNotification(uid: string, id: string) {
  await deleteDoc(refs.notification(uid, id));
}

export async function clearReadNotifications(uid: string) {
  const snap = await getDocs(query(refs.notifications(uid), where("read", "==", true), limit(400)));
  if (snap.empty) return;
  const batch = writeBatch(firestore());
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
