import { serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { refs } from "./refs";

export interface WatchSnapshot {
  position: number;
  maxWatched: number;
  duration: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Persist video progress. Firestore rules only allow `maxWatched` to move
 * forward at ≤2.5× real time, so callers save little and often.
 */
export async function saveLessonProgress(
  courseId: string,
  uid: string,
  lessonId: string,
  snap: WatchSnapshot,
  exists: boolean,
) {
  const duration = Math.max(1, round(snap.duration));
  const maxWatched = Math.min(round(snap.maxWatched), duration);
  const data = {
    position: Math.min(round(snap.position), duration),
    maxWatched,
    duration,
    percent: Math.min(100, Math.round((maxWatched / duration) * 100)),
    updatedAt: serverTimestamp(),
  };
  const ref = refs.lessonProgress(courseId, uid, lessonId);
  if (exists) await updateDoc(ref, data);
  else await setDoc(ref, data);
}

/** Staff tooling: record the authoritative length of a lesson's video. */
export async function recordVideoDuration(courseId: string, lessonId: string, seconds: number) {
  await updateDoc(refs.lesson(courseId, lessonId), {
    hasVideo: true,
    videoDurationSeconds: Math.round(seconds),
  });
}
