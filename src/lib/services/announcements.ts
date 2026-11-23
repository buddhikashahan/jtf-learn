import { deleteOnServer } from "./server-api";
import { addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Announcement, UserProfile, WithId } from "@/types";
import type { AnnouncementInput } from "@/lib/validation";
import { refs } from "./refs";
import { notifyCourseStudents } from "./notifications";
import { logAudit } from "./audit";

export async function postAnnouncement(course: { id: string; title: string }, input: AnnouncementInput, actor: UserProfile) {
  void logAudit("announcement.posted", { type: "announcement", id: course.id, label: input.title, courseId: course.id }, `Posted announcement “${input.title}” in ${course.title}`);
  await addDoc(refs.announcements(course.id), {
    courseId: course.id,
    courseTitle: course.title,
    title: input.title,
    body: input.body,
    pinned: input.pinned,
    authorId: actor.uid,
    authorName: actor.displayName,
    createdAt: serverTimestamp(),
  });
  await notifyCourseStudents(
    course.id,
    {
      type: "announcement",
      title: `📣 ${input.title}`,
      body: `${course.title}: ${input.body.replace(/[#*_>`]/g, "").slice(0, 160)}`,
      link: `/courses/${course.id}#announcements`,
      courseId: course.id,
    },
    actor,
  );
}

export async function togglePinned(courseId: string, announcement: WithId<Announcement>) {
  await updateDoc(refs.announcement(courseId, announcement.id), { pinned: !announcement.pinned });
}

export async function deleteAnnouncement(courseId: string, id: string) {
  await deleteOnServer("announcement", courseId, id);
}
