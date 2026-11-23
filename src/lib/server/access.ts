import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "./admin";
import type { Course, UserProfile } from "@/types";

/**
 * Shared plumbing for /api/* route handlers. The Admin SDK bypasses the
 * security rules, so the access checks here mirror firestore.rules:
 *  • admin      = admin or superadmin
 *  • course staff = admin, or an instructor of the course
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wrap a handler: JSON errors, no stack traces leaked to clients. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (error) {
      if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
      if (error instanceof z.ZodError) return Response.json({ error: "Invalid request." }, { status: 400 });
      console.error("[api]", error);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "Invalid request.");
  });
  return schema.parse(body);
}

export interface Caller {
  uid: string;
  profile: UserProfile;
}

/** Verify the Firebase ID token sent as `Authorization: Bearer <token>`. */
export async function requireUser(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Please sign in again.");
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token, true)).uid;
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "";
    // Token problems are the user's; anything else means the server can't reach Firebase.
    if (/^auth\/(id-token-expired|id-token-revoked|argument-error|invalid-id-token|user-disabled|user-not-found)/.test(code)) {
      throw new HttpError(401, "Your session has expired. Please sign in again.");
    }
    console.error(
      "[api] Firebase Admin couldn't verify the sign-in — the server has no Google credentials.\n" +
        "  Locally: set FIREBASE_SERVICE_ACCOUNT in .env.local, or run `gcloud auth application-default login`.\n" +
        "  Firebase App Hosting / Cloud Run: credentials are automatic.",
      error,
    );
    throw new HttpError(500, "The server isn't connected to Firebase yet. Ask an administrator to configure its credentials.");
  }
  const snap = await adminDb().doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpError(403, "Your profile is missing.");
  return { uid, profile: snap.data() as UserProfile };
}

/** Load a course and work out the caller's standing in it (mirrors isCourseStaff / isAdmin). */
export async function requireCourse(caller: Caller, courseId: string) {
  const snap = await adminDb().doc(`courses/${courseId}`).get();
  if (!snap.exists) throw new HttpError(404, "This course doesn't exist.");
  const course = snap.data() as Course;
  const role = caller.profile.role;
  const isAdmin = role === "admin" || role === "superadmin";
  const isStaff = isAdmin || (role === "instructor" && (course.instructorIds ?? []).includes(caller.uid));
  return { course, isAdmin, isStaff };
}

/** Server-side audit entry (same shape the client writes). */
export async function audit(
  actor: Caller,
  action: string,
  target: { type: string; id: string; label?: string; courseId?: string | null },
  summary: string,
) {
  try {
    await adminDb()
      .collection("auditLogs")
      .add({
        actorId: actor.uid,
        actorName: (actor.profile.displayName || "Unknown").slice(0, 80),
        actorRole: actor.profile.role,
        action: action.slice(0, 60),
        targetType: target.type,
        targetId: target.id,
        targetLabel: target.label?.slice(0, 200) ?? null,
        courseId: target.courseId ?? null,
        summary: summary.slice(0, 400),
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("[audit]", error);
  }
}
