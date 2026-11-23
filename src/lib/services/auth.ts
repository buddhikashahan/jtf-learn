import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { ensureUserProfile, setPendingDisplayName } from "./users";

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signUp(displayName: string, email: string, password: string) {
  setPendingDisplayName(displayName);
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  await updateProfile(cred.user, { displayName });
  await ensureUserProfile(cred.user);
  // Verification is encouraged but not blocking; failures should not abort sign-up.
  sendEmailVerification(cred.user).catch(() => undefined);
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(firebaseAuth(), provider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export function signOut() {
  return firebaseSignOut(firebaseAuth());
}

export function requestPasswordReset(email: string) {
  return sendPasswordResetEmail(firebaseAuth(), email);
}

export async function resendVerificationEmail() {
  const user = firebaseAuth().currentUser;
  if (user) await sendEmailVerification(user);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = firebaseAuth().currentUser;
  if (!user?.email) throw new Error("Not signed in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function hasPasswordProvider(): boolean {
  return Boolean(firebaseAuth().currentUser?.providerData.some((p) => p.providerId === "password"));
}
