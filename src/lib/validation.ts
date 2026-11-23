import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

const strongPassword = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "At most 128 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Enter a valid http(s) URL");

// ── Auth ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter your full name").max(80),
    email,
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ── Settings ─────────────────────────────────────────────────────────────────
export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || /^\+?[\d\s\-()]{7,30}$/.test(v), "Enter a valid phone number"),
  bio: z.string().trim().max(500, "At most 500 characters"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current one",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Courses ──────────────────────────────────────────────────────────────────
export const courseSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(120),
  code: z.string().trim().max(24),
  description: z.string().trim().max(5000),
  category: z.string().trim().max(60),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  status: z.enum(["draft", "published", "archived"]),
  cohort: z.string().trim().max(80),
  startDate: z.string(),
  allowSelfEnroll: z.boolean(),
  requiredWatchPercent: z.number().int().min(0).max(100),
  sequential: z.boolean(),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const moduleSchema = z.object({
  title: z.string().trim().min(1, "Module title is required").max(160),
});
export type ModuleInput = z.infer<typeof moduleSchema>;

export const lessonSchema = z.object({
  title: z.string().trim().min(1, "Lesson title is required").max(200),
  type: z.enum(["video", "article"]),
  durationMinutes: z.number({ error: "Enter a duration" }).int().min(0).max(1000),
  videoUrl: optionalUrl,
  body: z.string().max(100_000),
  transcript: z.string().max(200_000),
  videoDurationSeconds: z.number().min(0).max(86400).optional(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const enrollByEmailSchema = z.object({ email });
export type EnrollByEmailInput = z.infer<typeof enrollByEmailSchema>;

// ── Assignments ──────────────────────────────────────────────────────────────
export const assignmentSchema = z.object({
  courseId: z.string().min(1, "Select a course"),
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  description: z.string().trim().max(10_000),
  dueAt: z.string().min(1, "Choose a due date"),
  points: z.number({ error: "Enter points" }).int().min(1).max(1000),
  /** "" = whole-course assignment; otherwise the module this coursework belongs to. */
  moduleId: z.string(),
  required: z.boolean(),
  passMark: z.number({ error: "Enter a pass mark" }).min(0).max(1000),
}).refine((d) => d.passMark <= d.points, {
  path: ["passMark"],
  message: "Pass mark can't exceed the total points",
}).refine((d) => !d.required || d.passMark > 0, {
  path: ["passMark"],
  message: "Required coursework needs a pass mark above 0",
});
export type AssignmentInput = z.infer<typeof assignmentSchema>;

export const gradeSchema = (maxPoints: number) =>
  z.object({
    grade: z
      .number({ error: "Enter a grade" })
      .min(0, "Cannot be negative")
      .max(maxPoints, `Cannot exceed ${maxPoints}`),
    feedback: z.string().trim().max(5000),
  });
export type GradeInput = z.infer<ReturnType<typeof gradeSchema>>;

// ── Live sessions ────────────────────────────────────────────────────────────
export const liveSessionSchema = z.object({
  courseId: z.string().min(1, "Select a course"),
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  description: z.string().trim().max(2000),
  startAt: z.string().min(1, "Choose a start time"),
  durationMinutes: z.number({ error: "Enter a duration" }).int().min(5).max(600),
  meetingUrl: optionalUrl,
  recordingUrl: optionalUrl,
}).refine((d) => Boolean(d.meetingUrl), {
  path: ["meetingUrl"],
  message: "Add the Zoom, Google Meet or Teams link",
});
export type LiveSessionInput = z.infer<typeof liveSessionSchema>;

// ── Uploads ──────────────────────────────────────────────────────────────────
export const UPLOAD_LIMITS = {
  avatar: { maxBytes: 2 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp"] },
  cover: { maxBytes: 5 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp"] },
  submission: {
    maxBytes: 20 * 1024 * 1024,
    types: [
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "image/png",
      "image/jpeg",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  lessonResource: {
    maxBytes: 500 * 1024 * 1024,
    types: [
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "video/mp4",
      "video/webm",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ],
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

export function validateFile(file: File, kind: UploadKind): string | null {
  const limit = UPLOAD_LIMITS[kind];
  if (!(limit.types as readonly string[]).includes(file.type)) return "This file type is not allowed.";
  if (file.size > limit.maxBytes) return `File is too large (max ${Math.round(limit.maxBytes / 1024 / 1024)} MB).`;
  return null;
}

// ── Announcements & discussions ──────────────────────────────────────────────
export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  body: z.string().trim().min(1, "Write a message").max(10_000),
  pinned: z.boolean(),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
