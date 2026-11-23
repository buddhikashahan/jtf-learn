#!/usr/bin/env node
/**
 * Promote / demote a user — used to bootstrap the first administrator.
 * After that, admins manage roles from the in-app Users page.
 *
 *   Production:  npm run set-role -- <email> <student|instructor|admin|superadmin> --project <firebase-project-id>
 *   Emulators:   npm run set-role:local -- <email> <student|instructor|admin>
 *
 * Credentials (production): either run `gcloud auth application-default login`
 * with an account that has access to the project, or set
 * GOOGLE_APPLICATION_CREDENTIALS to a service-account key file (never commit it).
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ROLES = ["student", "instructor", "admin", "superadmin"];
const args = process.argv.slice(2);
const positional = [];
let projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--project") projectId = args[++i];
  else if (args[i].startsWith("--project=")) projectId = args[i].slice("--project=".length);
  else positional.push(args[i]);
}
const [email, role] = positional;

if (!email || !ROLES.includes(role) || !projectId) {
  console.error("Usage: npm run set-role -- <email> <student|instructor|admin|superadmin> --project <firebase-project-id>");
  process.exit(1);
}

const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
initializeApp({ projectId, ...(usingEmulators ? {} : { credential: applicationDefault() }) });

try {
  const user = await getAuth().getUserByEmail(email.trim().toLowerCase());
  const ref = getFirestore().doc(`users/${user.uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✖ ${email} has an account but no profile yet. Ask them to sign in to the app once, then retry.`);
    process.exit(1);
  }
  await ref.update({ role, updatedAt: FieldValue.serverTimestamp() });
  console.log(`✔ ${email} is now ${role} on project "${projectId}"${usingEmulators ? " (emulator)" : ""}.`);
} catch (error) {
  if (/default credentials|access token/i.test(error.message)) {
    console.error(
      [
        "✖ No Google credentials found. Either:",
        "  • run `gcloud auth application-default login` (requires the Google Cloud CLI), or",
        "  • download a key: Firebase console → Project settings → Service accounts → Generate new private key,",
        "    save it OUTSIDE the project, then (PowerShell):",
        '      $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\keys\\your-key.json"',
        "    and re-run this command. Delete/revoke the key afterwards.",
        "  • or simply edit the user's `role` field to \"admin\" in Firestore (Firebase console → Firestore → users).",
      ].join("\n"),
    );
  } else {
    console.error(`✖ ${error.message}`);
  }
  process.exit(1);
}
