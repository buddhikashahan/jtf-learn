import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase is initialised lazily on first use (always in the browser) so that
 * server prerendering never touches the SDK and missing env vars fail loudly
 * at the point of use rather than at build time.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function firebaseApp(): FirebaseApp {
  if (app) return app;
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables (see .env.example and README).",
    );
  }
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  enableAppCheck(app);
  return app;
}

/**
 * Firebase App Check (reCAPTCHA Enterprise): attests that requests come from
 * this web app, blocking abuse of the Firebase backend from scripts/bots.
 * Enabled when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set; enforce it per service
 * in the Firebase console once metrics look healthy.
 */
function enableAppCheck(instance: FirebaseApp) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (typeof window === "undefined" || !siteKey || useEmulators) return;
  // Local development against a project that enforces App Check: register the
  // debug token printed in the browser console (App Check → Apps → Manage debug
  // tokens), or set NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN. Never active in production.
  if (process.env.NODE_ENV !== "production") {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  // Must run before any other Firebase service issues a request.
  try {
    initializeAppCheck(instance, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    /* already initialised (fast refresh) */
  }
}

export function firebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(firebaseApp());
  if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

export function firestore(): Firestore {
  if (db) return db;
  const instance = firebaseApp();
  try {
    db =
      typeof window !== "undefined"
        ? initializeFirestore(instance, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          })
        : getFirestore(instance);
  } catch {
    // Already initialised (e.g. during fast refresh).
    db = getFirestore(instance);
  }
  if (useEmulators) {
    try {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch {
      /* already connected */
    }
  }
  return db;
}

export function firebaseStorage(): FirebaseStorage {
  if (storage) return storage;
  storage = getStorage(firebaseApp());
  if (useEmulators) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return storage;
}
