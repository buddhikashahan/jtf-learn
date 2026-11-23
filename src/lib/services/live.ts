import { deleteOnServer } from "./server-api";
import { addDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import type { LiveSession, UserProfile, WithId } from "@/types";
import type { LiveSessionInput } from "@/lib/validation";
import { formatDateTime } from "@/lib/utils";
import { refs } from "./refs";
import { logActivity } from "./activity";
import { logAudit } from "./audit";
import { notifyCourseStudents } from "./notifications";

function sessionFields(input: LiveSessionInput) {
  return {
    title: input.title,
    description: input.description,
    startAt: Timestamp.fromDate(new Date(input.startAt)),
    durationMinutes: input.durationMinutes,
    mode: "external" as const,
    meetingUrl: input.meetingUrl || null,
    recordingUrl: input.recordingUrl || null,
  };
}

export async function createLiveSession(
  input: LiveSessionInput,
  course: { id: string; title: string },
  host: UserProfile,
) {
  const ref = await addDoc(refs.liveSessions(course.id), {
    ...sessionFields(input),
    endedAt: null,
    courseId: course.id,
    courseTitle: course.title,
    hostId: host.uid,
    hostName: host.displayName,
    createdAt: serverTimestamp(),
  });
  await logActivity(course, host, "session_scheduled", `scheduled a live class: ${input.title}`);
  await logAudit(
    "session.created",
    { type: "session", id: ref.id, label: input.title, courseId: course.id },
    `Scheduled live class “${input.title}” for ${formatDateTime(new Date(input.startAt))}`,
  );
  await notifyCourseStudents(
    course.id,
    {
      type: "live_scheduled",
      title: `Live class scheduled: ${input.title}`,
      body: `${course.title} · ${formatDateTime(new Date(input.startAt))} · ${input.durationMinutes} min`,
      link: `/live/${course.id}/${ref.id}`,
      courseId: course.id,
    },
    host,
  );
}

export async function updateLiveSession(session: WithId<LiveSession>, input: LiveSessionInput) {
  void logAudit(
    "session.updated",
    { type: "session", id: session.id, label: input.title, courseId: session.courseId },
    `Updated live class “${input.title}”`,
  );
  await updateDoc(refs.liveSession(session.courseId, session.id), sessionFields(input));
}

/** Delete a live class with its attendance and uploaded recording files. */
export async function deleteLiveSession(session: WithId<LiveSession>) {
  await deleteOnServer("session", session.courseId, session.id);
}
