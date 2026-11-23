import { arrayRemove, arrayUnion, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { LiveSession, RecordingPart, UserProfile, WithId } from "@/types";
import { readVideoDuration } from "@/lib/media";
import { refs } from "./refs";
import { logAudit } from "./audit";
import { notifyCourseStudents } from "./notifications";
import { buildPath, deleteFile, uploadFile } from "./storage";

/**
 * Live classes run on an external platform (Zoom, Google Meet, Teams). The LMS
 * schedules them, tracks who opened the meeting link, and hosts the recording
 * afterwards — an uploaded video and/or a recording link.
 */

const target = (s: WithId<LiveSession>) => ({ type: "session" as const, id: s.id, label: s.title, courseId: s.courseId });

/** Record that someone opened the meeting link (attendance). Best-effort. */
export async function recordJoin(session: WithId<LiveSession>, user: UserProfile) {
  const ref = refs.attendee(session.courseId, session.id, user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { lastSeenAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        minutes: 0,
        firstJoinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
    }
  } catch {
    /* attendance must never block joining */
  }
}

/** Host: mark the class as ended (so the recording section shows). */
export async function endLiveSession(session: WithId<LiveSession>) {
  await updateDoc(refs.liveSession(session.courseId, session.id), { endedAt: serverTimestamp() });
  await logAudit("session.ended", target(session), `Ended live class “${session.title}”`);
}

async function notifyRecording(session: WithId<LiveSession>, actor: UserProfile) {
  await notifyCourseStudents(
    session.courseId,
    {
      type: "live_scheduled",
      title: `Recording available: ${session.title}`,
      body: `${session.courseTitle} · Watch the class recording any time.`,
      link: `/live/${session.courseId}/${session.id}`,
      courseId: session.courseId,
    },
    actor,
  );
}

/** Host: upload a recording video for the class. */
export async function uploadRecording(
  session: WithId<LiveSession>,
  file: File,
  actor: UserProfile,
  onProgress?: (percent: number) => void,
): Promise<RecordingPart> {
  const seconds = await readVideoDuration(file);
  const result = await uploadFile(buildPath(`courses/${session.courseId}/recordings/${session.id}`, file), file, onProgress);
  const part: RecordingPart = {
    name: result.name,
    url: result.url,
    path: result.path,
    size: result.size,
    seconds: Math.round(seconds ?? 0),
    startedAt: Date.now(),
  };
  await updateDoc(refs.liveSession(session.courseId, session.id), { recordings: arrayUnion(part) });
  await logAudit("session.recording_uploaded", target(session), `Uploaded a recording (${result.name}) to “${session.title}”`);
  await notifyRecording(session, actor);
  return part;
}

/** Host: remove an uploaded recording (the file is deleted from Storage too). */
export async function removeRecording(session: WithId<LiveSession>, part: RecordingPart) {
  await updateDoc(refs.liveSession(session.courseId, session.id), { recordings: arrayRemove(part) });
  await deleteFile(part.path);
  await logAudit("session.recording_removed", target(session), `Removed a recording (${part.name ?? "video"}) from “${session.title}”`);
}

/** Host: set or clear the recording link. Learners are notified when one is added. */
export async function setRecordingLink(session: WithId<LiveSession>, url: string | null, actor: UserProfile) {
  await updateDoc(refs.liveSession(session.courseId, session.id), { recordingUrl: url });
  await logAudit(
    url ? "session.recording_link_set" : "session.recording_link_removed",
    target(session),
    url ? `Added a recording link to “${session.title}”` : `Removed the recording link from “${session.title}”`,
  );
  if (url && url !== session.recordingUrl) await notifyRecording(session, actor);
}
