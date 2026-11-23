import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact an administrator.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Please choose a stronger password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and retry.",
  "auth/requires-recent-login": "For your security, please sign in again and retry.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "permission-denied": "You don't have permission to perform this action.",
  "unavailable": "The service is temporarily unavailable. Please try again.",
  "not-found": "The requested item could not be found.",
  "storage/unauthorized": "You don't have permission to upload this file.",
  "storage/canceled": "Upload cancelled.",
  "storage/quota-exceeded": "Storage quota exceeded. Contact an administrator.",
};

/** Map any thrown value to a user-safe message (never leak raw internals). */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? MESSAGES[error.code.replace(/^firestore\//, "")] ?? fallback;
  }
  if (error instanceof Error && error.name === "ValidationError") return error.message;
  return fallback;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
