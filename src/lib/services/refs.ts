import { collection, doc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

/** Centralised Firestore paths — keep in sync with firestore.rules. */
export const refs = {
  users: () => collection(firestore(), "users"),
  user: (uid: string) => doc(firestore(), "users", uid),
  note: (uid: string, noteId: string) => doc(firestore(), "users", uid, "notes", noteId),

  courses: () => collection(firestore(), "courses"),
  course: (courseId: string) => doc(firestore(), "courses", courseId),

  modules: (courseId: string) => collection(firestore(), "courses", courseId, "modules"),
  module: (courseId: string, moduleId: string) => doc(firestore(), "courses", courseId, "modules", moduleId),

  lessons: (courseId: string) => collection(firestore(), "courses", courseId, "lessons"),
  lesson: (courseId: string, lessonId: string) => doc(firestore(), "courses", courseId, "lessons", lessonId),
  lessonContents: (courseId: string) => collection(firestore(), "courses", courseId, "lessonContent"),
  lessonContent: (courseId: string, lessonId: string) =>
    doc(firestore(), "courses", courseId, "lessonContent", lessonId),

  enrollments: (courseId: string) => collection(firestore(), "courses", courseId, "enrollments"),
  enrollment: (courseId: string, userId: string) =>
    doc(firestore(), "courses", courseId, "enrollments", userId),

  assignments: (courseId: string) => collection(firestore(), "courses", courseId, "assignments"),
  assignment: (courseId: string, assignmentId: string) =>
    doc(firestore(), "courses", courseId, "assignments", assignmentId),
  submissions: (courseId: string, assignmentId: string) =>
    collection(firestore(), "courses", courseId, "assignments", assignmentId, "submissions"),
  submission: (courseId: string, assignmentId: string, userId: string) =>
    doc(firestore(), "courses", courseId, "assignments", assignmentId, "submissions", userId),

  liveSessions: (courseId: string) => collection(firestore(), "courses", courseId, "liveSessions"),
  liveSession: (courseId: string, sessionId: string) =>
    doc(firestore(), "courses", courseId, "liveSessions", sessionId),

  activity: (courseId: string) => collection(firestore(), "courses", courseId, "activity"),

  auditLogs: () => collection(firestore(), "auditLogs"),
  platformSettings: () => doc(firestore(), "settings", "platform"),

  peers: (courseId: string, sessionId: string) =>
    collection(firestore(), "courses", courseId, "liveSessions", sessionId, "peers"),
  peer: (courseId: string, sessionId: string, uid: string) =>
    doc(firestore(), "courses", courseId, "liveSessions", sessionId, "peers", uid),
  signals: (courseId: string, sessionId: string) =>
    collection(firestore(), "courses", courseId, "liveSessions", sessionId, "signals"),

  notifications: (uid: string) => collection(firestore(), "users", uid, "notifications"),
  notification: (uid: string, id: string) => doc(firestore(), "users", uid, "notifications", id),

  lessonProgress: (courseId: string, uid: string, lessonId: string) =>
    doc(firestore(), "courses", courseId, "enrollments", uid, "lessonProgress", lessonId),
  lessonProgressAll: (courseId: string, uid: string) =>
    collection(firestore(), "courses", courseId, "enrollments", uid, "lessonProgress"),

  announcements: (courseId: string) => collection(firestore(), "courses", courseId, "announcements"),
  announcement: (courseId: string, id: string) => doc(firestore(), "courses", courseId, "announcements", id),

  discussions: (courseId: string) => collection(firestore(), "courses", courseId, "discussions"),
  discussion: (courseId: string, id: string) => doc(firestore(), "courses", courseId, "discussions", id),

  attendance: (courseId: string, sessionId: string) =>
    collection(firestore(), "courses", courseId, "liveSessions", sessionId, "attendance"),
  attendee: (courseId: string, sessionId: string, uid: string) =>
    doc(firestore(), "courses", courseId, "liveSessions", sessionId, "attendance", uid),
};
