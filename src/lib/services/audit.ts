import { addDoc, doc, serverTimestamp, type WriteBatch } from "firebase/firestore";
import type { Role, UserProfile } from "@/types";
import { refs } from "./refs";

/**
 * Audit trail of privileged (staff) actions. Entries are append-only and only
 * readable by super admins (enforced in firestore.rules).
 *
 * Role changes are written atomically with their audit entry — the rules reject
 * a role change without one. Other actions are logged best-effort right after
 * they succeed.
 */

export interface AuditTarget {
  type: "user" | "course" | "module" | "lesson" | "assignment" | "submission" | "session" | "announcement" | "enrollment" | "settings";
  id: string;
  label?: string;
  courseId?: string | null;
}

type Actor = Pick<UserProfile, "uid" | "displayName" | "role">;

let currentActor: Actor | null = null;

/** Called by the auth provider whenever the signed-in profile changes. */
export function setAuditActor(profile: Actor | null) {
  currentActor = profile;
}

const STAFF: Role[] = ["instructor", "admin", "superadmin"];

function entry(actor: Actor, action: string, target: AuditTarget | null, summary: string) {
  return {
    actorId: actor.uid,
    actorName: actor.displayName.slice(0, 80) || "Unknown",
    actorRole: actor.role,
    action: action.slice(0, 60),
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    targetLabel: target?.label?.slice(0, 200) ?? null,
    courseId: target?.courseId ?? (target?.type === "course" ? target.id : null),
    summary: summary.slice(0, 400),
    createdAt: serverTimestamp(),
  };
}

/** Record a staff action. Never throws — auditing must not break the action itself. */
export async function logAudit(action: string, target: AuditTarget | null, summary: string): Promise<void> {
  const actor = currentActor;
  if (!actor || !STAFF.includes(actor.role)) return;
  try {
    await addDoc(refs.auditLogs(), entry(actor, action, target, summary));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Audit log failed", error);
  }
}

/** Add an audit entry to a batch (for actions the rules require to be audited). Returns the entry id. */
export function auditInBatch(
  batch: WriteBatch,
  actor: Actor,
  action: string,
  target: AuditTarget,
  summary: string,
): string {
  const ref = doc(refs.auditLogs());
  batch.set(ref, entry(actor, action, target, summary));
  return ref.id;
}
