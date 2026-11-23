import { serverTimestamp, setDoc } from "firebase/firestore";
import { refs } from "./refs";

export function noteId(courseId: string, lessonId: string) {
  return `${courseId}_${lessonId}`;
}

export async function saveNote(uid: string, courseId: string, lessonId: string, content: string) {
  await setDoc(refs.note(uid, noteId(courseId, lessonId)), {
    courseId,
    lessonId,
    content: content.slice(0, 20000),
    updatedAt: serverTimestamp(),
  });
}
