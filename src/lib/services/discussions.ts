import { deleteOnServer } from "./server-api";
import { addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Course, DiscussionPost, UserProfile, WithId } from "@/types";
import { refs } from "./refs";
import { notify } from "./notifications";

interface PostParams {
  course: WithId<Course>;
  lessonId: string;
  lessonTitle: string;
  body: string;
  author: UserProfile;
  parent?: WithId<DiscussionPost> | null;
}

export async function postDiscussion({ course, lessonId, lessonTitle, body, author, parent = null }: PostParams) {
  await addDoc(refs.discussions(course.id), {
    lessonId,
    parentId: parent?.id ?? null,
    authorId: author.uid,
    authorName: author.displayName,
    authorRole: author.role,
    body: body.trim(),
    resolved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const link = `/learn/${course.id}/${lessonId}?tab=discussion`;
  const snippet = body.trim().slice(0, 160);
  if (parent) {
    // Reply → notify the thread author.
    await notify(
      [parent.authorId],
      { type: "discussion", title: `${author.displayName} replied to your question`, body: snippet, link, courseId: course.id },
      author,
    );
  } else if (author.role === "student") {
    // New learner question → notify the course instructors.
    await notify(
      course.instructorIds,
      { type: "discussion", title: `New question on “${lessonTitle}”`, body: snippet, link, courseId: course.id },
      author,
    );
  }
}

export async function editDiscussion(courseId: string, id: string, body: string) {
  await updateDoc(refs.discussion(courseId, id), { body: body.trim(), updatedAt: serverTimestamp() });
}

export async function setResolved(courseId: string, id: string, resolved: boolean) {
  await updateDoc(refs.discussion(courseId, id), { resolved, updatedAt: serverTimestamp() });
}

/** Delete a Q&A post and its replies. */
export async function deleteDiscussion(courseId: string, id: string) {
  await deleteOnServer("discussion", courseId, id);
}
