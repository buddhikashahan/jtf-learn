import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin SDK for route handlers. It bypasses the security rules, so
 * every handler must check access itself (see ./live-access.ts).
 *
 * Credentials:
 *  • Firebase App Hosting / Cloud Run: picked up automatically.
 *  • Other hosts: FIREBASE_SERVICE_ACCOUNT = the service-account JSON.
 *  • Local: `gcloud auth application-default login`, or the emulators.
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (useEmulators) {
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
  }
  // Service-account JSON, raw or base64-encoded (one line fits .env files).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const serviceAccount = raw ? JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : null;
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ...(serviceAccount && !useEmulators ? { credential: cert(serviceAccount) } : {}),
  });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
export const adminBucket = () => getStorage(app()).bucket();

/** Public download URL for a Storage object, in the same format the web SDK produces. */
export function downloadUrl(bucket: string, path: string, token: string) {
  const host = useEmulators ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
