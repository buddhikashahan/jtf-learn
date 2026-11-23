import type { Timestamp } from "firebase/firestore";

/** Firestore documents are returned with their id merged in. */
export type WithId<T> = T & { id: string };

export type Role = "student" | "instructor" | "admin" | "superadmin";

export interface NotificationPrefs {
  assignments: boolean;
  liveClasses: boolean;
  grades: boolean;
  announcements: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phone: string | null;
  bio: string;
  role: Role;
  notifications: NotificationPrefs;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type CourseStatus = "draft" | "published" | "archived";
export type CourseLevel = "beginner" | "intermediate" | "advanced";

export interface Course {
  title: string;
  code: string;
  description: string;
  category: string;
  level: CourseLevel;
  status: CourseStatus;
  coverImageUrl: string | null;
  cohort: string | null;
  startDate: Timestamp | null;
  allowSelfEnroll: boolean;
  /** Minimum % of a video that must be watched before it can be completed (0 = off). */
  requiredWatchPercent?: number;
  /** Lock lessons until the previous one is completed. */
  sequential?: boolean;
  /** Ids of required coursework (assignments) that must be passed to complete the course. */
  requiredCourseworkIds?: string[];
  instructorIds: string[];
  instructorNames: string[];
  moduleCount: number;
  lessonCount: number;
  totalMinutes: number;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Module {
  title: string;
  order: number;
  createdAt: Timestamp | null;
}

export type LessonType = "video" | "article";

/** Public lesson outline (visible on the course syllabus). */
export interface Lesson {
  moduleId: string;
  title: string;
  type: LessonType;
  order: number;
  durationMinutes: number;
  /** True when the lesson has a playable video (drives watch-tracking rules). */
  hasVideo?: boolean;
  /** Authoritative video length captured by staff tooling. */
  videoDurationSeconds?: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Per-learner video progress: courses/{c}/enrollments/{uid}/lessonProgress/{lessonId} */
export interface LessonProgress {
  position: number;
  maxWatched: number;
  duration: number;
  percent: number;
  updatedAt: Timestamp | null;
}

export interface LessonResource {
  name: string;
  url: string;
  path: string | null;
  size: number;
}

/** Protected lesson body — readable only by enrolled learners & staff. */
export interface LessonContent {
  body: string;
  videoUrl: string | null;
  /** Video transcript / notes used by the AI study assistant. */
  transcript?: string | null;
  resources: LessonResource[];
  updatedAt: Timestamp | null;
}

export type EnrollmentStatus = "active" | "completed";

export interface Enrollment {
  userId: string;
  courseId: string;
  userName: string;
  userEmail: string;
  status: EnrollmentStatus;
  progress: number;
  completedLessonIds: string[];
  /** Required coursework this learner has passed — written by graders only. */
  passedCourseworkIds?: string[];
  lastLessonId: string | null;
  lastCompletedLessonId?: string | null;
  enrolledBy: string;
  enrolledAt: Timestamp | null;
  updatedAt: Timestamp | null;
  completedAt: Timestamp | null;
}

export interface Assignment {
  courseId: string;
  courseTitle: string;
  title: string;
  description: string;
  dueAt: Timestamp;
  points: number;
  /** Module this coursework belongs to (null = whole course). */
  moduleId?: string | null;
  /** Must be passed before the course can be completed. */
  required?: boolean;
  /** Minimum grade (in points) that counts as a pass. */
  passMark?: number;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type SubmissionStatus = "submitted" | "graded";

export interface Submission {
  userId: string;
  userName: string;
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  status: SubmissionStatus;
  grade: number | null;
  feedback: string | null;
  submittedAt: Timestamp | null;
  gradedAt: Timestamp | null;
  gradedBy: string | null;
  gradedByName: string | null;
}

export interface LiveSession {
  courseId: string;
  courseTitle: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  startAt: Timestamp;
  durationMinutes: number;
  /** Always "external" now (Zoom/Meet/Teams). "in_app" only on old sessions. */
  mode?: LiveMode;
  /** Zoom / Google Meet / Teams link. */
  meetingUrl: string | null;
  /** Recording link added after the class (e.g. Zoom cloud recording, YouTube, Drive). */
  recordingUrl: string | null;
  /** Recording files uploaded after the class, in order. */
  recordings?: RecordingPart[];
  /** Set when the host ends the class early. */
  endedAt?: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface RecordingPart {
  /** Original file name (uploaded recordings). */
  name?: string;
  url: string;
  path: string;
  size: number;
  seconds: number;
  startedAt: number;
}

export interface AuditLog {
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  courseId: string | null;
  summary: string;
  createdAt: Timestamp | null;
}

export interface PlatformSettings {
  aiAssistantEnabled: boolean;
  updatedAt?: Timestamp | null;
  updatedBy?: string | null;
}

export type LiveMode = "in_app" | "external";
export type LiveStatus = "live" | "upcoming" | "ended";

export interface Attendance {
  userId: string;
  userName: string;
  role: Role;
  firstJoinedAt: Timestamp | null;
  lastSeenAt: Timestamp | null;
  minutes: number;
}

export type NotificationType =
  | "announcement"
  | "assignment_created"
  | "assignment_graded"
  | "submission_received"
  | "live_scheduled"
  | "enrolled"
  | "discussion"
  | "course_completed";

export interface AppNotification {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  courseId: string | null;
  actorId: string;
  actorName: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface Announcement {
  courseId?: string;
  courseTitle?: string;
  title: string;
  body: string;
  pinned: boolean;
  authorId: string;
  authorName: string;
  createdAt: Timestamp | null;
}

export interface DiscussionPost {
  lessonId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  resolved: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type ActivityType =
  | "enrolled"
  | "submitted"
  | "graded"
  | "lesson_completed"
  | "course_completed"
  | "session_scheduled"
  | "assignment_created"
  | "course_published";

export interface ActivityItem {
  courseId: string;
  courseTitle: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  message: string;
  createdAt: Timestamp | null;
}

export interface LessonNote {
  courseId: string;
  lessonId: string;
  content: string;
  updatedAt: Timestamp | null;
}
