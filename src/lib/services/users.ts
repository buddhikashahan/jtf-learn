import { updateProfile as updateAuthProfile, type User } from "firebase/auth";
import {
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import type { NotificationPrefs, Role, UserProfile, WithId } from "@/types";
import type { ProfileInput } from "@/lib/validation";
import { refs } from "./refs";
import { auditInBatch } from "./audit";
import { buildPath, deleteFile, uploadFile } from "./storage";

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  assignments: true,
  liveClasses: true,
  grades: true,
  announcements: true,
};

let pendingDisplayName: string | null = null;
/** Used during sign-up so the profile is created with the user's real name. */
export function setPendingDisplayName(name: string | null) {
  pendingDisplayName = name;
}

const inflight = new Map<string, Promise<void>>();

/** Create the Firestore profile for a newly authenticated user (idempotent). */
export function ensureUserProfile(user: User): Promise<void> {
  const existing = inflight.get(user.uid);
  if (existing) return existing;

  const task = (async () => {
    const ref = refs.user(user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? "",
      displayName: (user.displayName || pendingDisplayName || user.email?.split("@")[0] || "Learner").slice(0, 80),
      photoURL: user.photoURL ?? null,
      phone: null,
      bio: "",
      role: "student",
      notifications: DEFAULT_NOTIFICATIONS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  })().finally(() => {
    inflight.delete(user.uid);
    pendingDisplayName = null;
  });

  inflight.set(user.uid, task);
  return task;
}

export async function updateUserProfile(uid: string, input: ProfileInput): Promise<void> {
  await updateDoc(refs.user(uid), {
    displayName: input.displayName,
    phone: input.phone || null,
    bio: input.bio,
    updatedAt: serverTimestamp(),
  });
  const current = firebaseAuth().currentUser;
  if (current && current.uid === uid) {
    await updateAuthProfile(current, { displayName: input.displayName });
  }
}

export async function updateNotificationPrefs(uid: string, notifications: NotificationPrefs): Promise<void> {
  await updateDoc(refs.user(uid), { notifications, updatedAt: serverTimestamp() });
}

export async function uploadAvatar(
  profile: Pick<UserProfile, "uid" | "photoURL">,
  file: File,
  onProgress?: (p: number) => void,
): Promise<string> {
  const result = await uploadFile(buildPath(`avatars/${profile.uid}`, file), file, onProgress);
  await updateDoc(refs.user(profile.uid), { photoURL: result.url, updatedAt: serverTimestamp() });
  const current = firebaseAuth().currentUser;
  if (current) await updateAuthProfile(current, { photoURL: result.url });
  // Remove the previous avatar if it was stored in our bucket.
  const previousPath = storagePathFromUrl(profile.photoURL);
  if (previousPath?.startsWith(`avatars/${profile.uid}/`)) await deleteFile(previousPath);
  return result.url;
}

/**
 * Change a user's role. The security rules only accept the change when it is
 * committed together with its audit-log entry, so the two are batched.
 */
export async function setUserRole(
  target: Pick<UserProfile, "uid" | "displayName" | "email" | "role">,
  role: Role,
  actor: UserProfile,
): Promise<void> {
  const batch = writeBatch(firestore());
  const auditId = auditInBatch(
    batch,
    actor,
    "user.role_changed",
    { type: "user", id: target.uid, label: `${target.displayName} <${target.email}>` },
    `Changed ${target.displayName}'s role from ${target.role} to ${role}`,
  );
  batch.update(refs.user(target.uid), { role, updatedAt: serverTimestamp(), lastAuditId: auditId });
  await batch.commit();
}

export async function findUserByEmail(email: string): Promise<WithId<UserProfile> | null> {
  const snap = await getDocs(query(refs.users(), where("email", "==", email.trim().toLowerCase()), limit(1)));
  const d = snap.docs[0];
  return d ? { id: d.id, ...(d.data() as UserProfile) } : null;
}

function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
