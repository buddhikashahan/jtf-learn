import { addDoc, serverTimestamp } from "firebase/firestore";
import type { ActivityType } from "@/types";
import { refs } from "./refs";

interface Actor {
  uid: string;
  displayName: string;
}

/**
 * Append an entry to a course's activity feed. Activity is non-critical, so
 * failures are swallowed rather than surfaced to the user.
 */
export async function logActivity(
  course: { id: string; title: string },
  actor: Actor,
  type: ActivityType,
  message: string,
): Promise<void> {
  try {
    await addDoc(refs.activity(course.id), {
      courseId: course.id,
      courseTitle: course.title,
      actorId: actor.uid,
      actorName: actor.displayName,
      type,
      message: message.slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Activity log failed", error);
  }
}
