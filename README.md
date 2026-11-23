# JTF Learn — Learning Management System

A production-ready LMS for **Jinasena Training Foundation**, built with **Next.js 16 (App Router)**, **Tailwind CSS v4** and **Firebase** (Auth, Firestore, Storage).

It supports four roles:

- **Students** watch tracked video lessons, join live classes, ask an AI tutor about the lesson, complete module coursework and earn certificates.
- **Instructors** build curricula, run and record live classes, set and grade coursework, and follow learner reports.
- **Administrators** manage courses, people (students and instructors) and reports.
- **Super administrators** (the platform owner) do everything admins can, plus grant or revoke admin rights, review the **audit log** of all staff actions and control platform settings.

---

## Features

### Learning experience
- **Tracked video lessons** for uploaded MP4/WebM, YouTube and Vimeo:
  - Resumes where the learner left off.
  - **Skipping ahead is blocked**: seeks past the furthest-watched point snap back.
  - Playback speed is capped at 2×.
  - A watch-requirement bar shows progress.
  - The lesson **auto-completes** when the course's required percentage (default 90%) has been watched.
- **Sequential courses** (optional per course): lessons unlock in order.
- **Lesson player:**
  - Markdown content and downloadable resources.
  - Private autosaving notes.
  - **Q&A discussions** per lesson, with threads, instructor badges and "answered" status.
  - Previous/next navigation and `Alt + ←/→` shortcuts.
- **Module coursework:** each module can have required coursework with a pass mark. **A course can't be completed until every required piece is passed.** Learners who fail can resubmit.
- **Floating AI tutor** (Vertex AI Gemini via Firebase AI Logic): an "Ask AI" button in the lesson player answers questions about the current lesson and video. It knows the lesson text, the transcript and the current video position, and it streams answers.
- **Certificates:** a printable certificate of completion once a course is complete.

### Live classes
- **Scheduled per course, run on Zoom, Google Meet or Microsoft Teams.** Each class has a title, time, duration and meeting link. Learners are notified when a class is scheduled.
- **One-click join:** "Join now" opens the meeting link in a new tab and records attendance (who opened the link, and when), with **CSV export** for hosts.
- **Recordings after the class:** hosts mark the class as ended, then **upload the recording video** (stored in Firebase Storage, up to 2 GB per file, played inside the LMS) and/or **add a recording link** (Zoom cloud recording, YouTube, Drive…). Learners are notified when a recording is added.
- A **"Live now" banner** appears across the app whenever one of your classes is live.
- External Zoom, Meet or Teams links are still supported per session.

### Notifications & communication
- **Notification centre:** a bell with unread count and popover, plus a full page with read/unread, delete and clear.
- **Real-time toasts** and optional **desktop notifications** when the tab is in the background.
- **Events that notify:**
  - New assignments, grades and submissions (to instructors).
  - Live classes scheduled.
  - Enrolment and course completion.
  - Announcements and Q&A replies.
- **Per-category preferences** in Settings.
- **Course announcements** in Markdown, which can be pinned and are shown on the course page and dashboard.

### Teaching & administration
- **Course builder:** modules and lessons (reorder, rename), a Markdown editor with preview, video URL or upload (duration is detected automatically), and resources.
- **Learning rules per course:** video watch requirement (off / 50 / 75 / 90 / 100%) and sequential unlocking.
- **Assignments & coursework:** deadlines, file submissions, per-module required coursework with pass marks, a grading workspace (missing / late / to-grade filters) and a **gradebook CSV export**.
- **Students:** enrol by email, track progress and export the roster as CSV.
- **Reports** (admins and instructors): per course and per learner — **video watching progress** for every video lesson (furthest point watched and %), lesson and course progress, coursework status and **marks**, with CSV export.
- **Admin:** platform statistics, a global activity feed, user management and instructor assignment.
- **Super Admin dashboard:** platform-wide totals, admin management (grant/revoke admin), a searchable and filterable **audit log** of staff actions (courses, curriculum, coursework and grades, enrolments, live classes and recordings, announcements, role changes), and platform settings such as switching the AI assistant on or off.

### Modern UI/UX
- **Dark mode:** light, dark or system, with no flash on load.
- **⌘K / Ctrl+K command palette:** jump to pages and courses, run actions, toggle the theme.
- A **collapsible sidebar** with grouped navigation and tooltips, plus a responsive mobile drawer.
- Skeleton loaders, empty states, toasts, confirmation dialogs and keyboard-friendly Radix primitives.
- Reduced-motion support.

---

## Tech stack

- **Next.js 16** App Router with Cache Components, React 19, TypeScript (strict), and React Compiler lint rules.
- **Tailwind CSS v4.** Semantic design tokens with a dark palette live in `src/app/globals.css`.
- **Firebase 13:** Authentication (email/password and Google), Cloud Firestore, Cloud Storage, and **Firebase AI Logic** with the Vertex AI Gemini API.
- **Forms and validation:** React Hook Form with Zod.
- **UI:** Radix UI primitives, `cmdk`, lucide-react and sonner.
- **Video:** the YouTube IFrame API, `@vimeo/player` and HTML5 video for lessons and class recordings.
- **Server:** a Next.js route handler (`src/app/api/delete`) with the Firebase Admin SDK, for cascading deletes.

---

## Project structure

```
src/
  app/
    (auth)/            login, register, forgot-password
    (app)/             app shell: dashboard, courses, assignments, live, reports, notifications, settings, admin, superadmin
    (focus)/           distraction-free: lesson player (/learn), live class page (/live/[course]/[session]), certificates
  components/
    ui/                design-system primitives (Button, Dialog, Popover, Tooltip, FormField …)
    layout/            AppShell (sidebar, top bar, live banner), command palette
    learn/             lesson player, tracked video player, Q&A, notes, AI assistant
    live/              class page (join, recordings, attendance), recording player, session list & form
    reports/           course/learner reports
    superadmin/        super admin dashboard
    notifications/     bell, list, page
    announcements/  courses/  assignments/  dashboard/  settings/  admin/
    providers/         auth, theme
  hooks/               real-time Firestore hooks (use-firestore, use-lms, use-notifications)
  lib/services/        all reads/writes, one module per domain (incl. audit, ai, platform)
  lib/server/          server-only: Firebase Admin, access checks, cascading deletes
  app/api/delete/      delete a record with everything that belongs to it
  lib/coursework.ts    pass marks and course-completion rules
firestore.rules        ← authoritative access control
storage.rules
tests/rules.test.mjs   security-rules test suite (46 tests)
scripts/set-role.mjs   bootstrap the super administrator
apphosting.yaml        Firebase App Hosting config
```

### Data model (Firestore)

```
users/{uid}                                      profile, role (student|instructor|admin|superadmin), notification prefs
  notes/{courseId_lessonId}                      private lesson notes
  notifications/{id}                             in-app inbox
courses/{courseId}                               metadata, instructors, learning rules, required coursework, counters
  modules/{id}  lessons/{id}                     public outline (incl. hasVideo, videoDurationSeconds)
  lessonContent/{lessonId}                       PROTECTED body, video URL, resources
  enrollments/{uid}                              progress, completed lessons, passed coursework
    lessonProgress/{lessonId}                    video position & furthest point watched
  assignments/{id}                               module, pass mark, required flag
    submissions/{uid}                            one submission per learner
  liveSessions/{id}                              schedule, meeting link, recording link & uploaded recordings
    attendance/{uid}                             who opened the meeting link
  announcements/{id}  discussions/{id}  activity/{id}
auditLogs/{id}                                   append-only staff action log (super admin only)
settings/platform                                platform settings (super admin)
```

---

## Security model

Client-side guards are for UX only. Everything is enforced in **`firestore.rules`** and **`storage.rules`**, and covered by **46 automated tests** (`npm run test:rules`).

- **Roles:** sign-up can only create a student profile, and nobody can change their own role.
  - Admins can only move people between student and instructor. Only a super admin can grant or revoke admin, and no one can create, demote or edit a super admin from the app.
  - **Every role change must be written together with its audit entry.** The rules reject a role change that has no matching audit log in the same batch.
- **Audit log:** entries are append-only (no edits or deletes, even by the super admin), the actor and role must match the caller, and only super admins can read the log.
- **Coursework gating:** only graders can mark coursework as passed on an enrolment, and the rules refuse course completion until every required piece is passed.
- **Content gating:** lesson bodies, video URLs and files are readable only by enrolled learners and course staff.
- **Anti-skip, enforced server-side:**
  - The furthest point watched (`maxWatched`) can only increase, and by at most **2.5× the real time elapsed** since the last save. Skipping can't be faked with API calls.
  - A video lesson can only be marked complete when the learner's saved progress meets the course's watch requirement. The rules check this against the staff-recorded video length.
  - Completions are added one lesson at a time. Progress percentage and "completed" status must be consistent with the lessons actually completed.
- **Notifications:** the actor must be the caller. Links must be internal paths, so no phishing redirects. Learners can only notify their instructors or classmates, and only recipients can read their inbox.
- **Live classes:**
  - Only course staff can schedule classes, mark them ended or add recordings. Meeting and recording links must be `http(s)`.
  - Recording videos can only be uploaded by course staff (video files only, up to 2 GB), and only enrolled learners and staff can watch them.
  - Learners can only record their own attendance.
- **Grading:** students can't grade themselves, can resubmit only after a failing grade, and grades are bounded by the assignment's points.
- **Hardening:**
  - Headers: strict CSP (scoped to Firebase/Google APIs, YouTube and Vimeo), no camera/microphone access, HSTS, frame-ancestors none, nosniff.
  - Sanitised Markdown and `http(s)`-only user links.
  - Forms post via `method="post"`, so credentials never land in URLs.
  - CSV exports neutralise spreadsheet formulas.
  - Open-redirect protection on login.

---

## Deploying to production

### 1. Create and configure the Firebase project

In the [Firebase console](https://console.firebase.google.com/):

1. **Create a project.** Use the **Blaze** plan: Firebase App Hosting requires it, and it provides Storage quotas for video.
2. **Authentication → Sign-in method:** enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorized domains:** add your production domain(s).
4. **Firestore Database:** create the database in **production mode**, in the region closest to your learners.
5. **Storage:** get started (production mode).
6. **Project settings → Your apps:** add a **Web app**. You'll need its config unless you deploy with App Hosting, which injects it automatically.

Then deploy the security rules and indexes from your machine:

```bash
npm install
npx firebase login
npx firebase use --add          # pick your project; writes .firebaserc (commit it)
npm run deploy:rules            # firestore.rules, firestore.indexes.json, storage.rules
```

> Re-run `npm run deploy:rules` whenever you change the rules or indexes. The app relies on them for all access control.

### 2. Host the app

The production build validates its configuration and **fails fast** in two cases:
- the Firebase config is missing;
- a build points at the local emulators.

A misconfigured deployment can't go live.

**Option A — Firebase App Hosting (recommended)**

1. Push this repository to GitHub.
2. Run `npx firebase init apphosting` (or open **Console → App Hosting → Create backend**), then connect the repo and the branch to deploy.
3. App Hosting builds and deploys on every push. `apphosting.yaml` sets the instance limits and public variables. The Firebase web config is injected automatically.
4. Edit `apphosting.yaml` to set `NEXT_PUBLIC_SITE_URL` and, optionally, the App Check key. Then add your custom domain in the App Hosting dashboard.

**Option B — Vercel**

1. Import the repository in Vercel. The framework is detected automatically.
2. Add the environment variables from `.env.example`: all `NEXT_PUBLIC_FIREBASE_*` values from your web app config, plus `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SITE_URL` and `FIREBASE_SERVICE_ACCOUNT` (a service-account JSON key, since Vercel has no built-in Google credentials).
3. Deploy, then add the Vercel domain under **Authentication → Authorized domains**.

**Option C — Any Node.js host (VM, Docker, Cloud Run, …)**

```bash
# with the production env vars set (or in .env.production.local)
npm ci
npm run build
npm start            # serves on PORT (default 3000); put it behind HTTPS
```

### 3. Create the super administrator

Everyone who signs up starts as a **student**; that is a security rule. To bootstrap your own super admin account:

1. Open the deployed site and **register** with your email, or sign in with Google.
2. From your machine, authenticate as a project owner and promote the account:
   ```bash
   gcloud auth application-default login     # or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key
   npm run set-role -- you@example.com superadmin --project <your-firebase-project-id>
   ```
3. Refresh the app; **Super Admin** now appears in the sidebar. From now on, grant admin rights from the Super Admin dashboard, and promote instructors from **Users**. These changes are recorded in the audit log.

> `set-role` runs with admin credentials, so it bypasses the rules and isn't audited. Use it only for the first account or for recovery.

### 4. Go-live checklist

- [ ] Rules and indexes deployed (`npm run deploy:rules`). Indexes show as **Enabled** in the console.
- [ ] Production domain added to **Auth → Authorized domains**.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the public URL.
- [ ] Super admin created; admins and instructors promoted from the app.
- [ ] **Live classes:** schedule a test class, join it, mark it ended and upload a short recording.
- [ ] **AI assistant:** Firebase AI Logic is enabled with the Vertex AI Gemini API (see below), or the assistant is switched off in Super Admin → Settings.
- [ ] **Recommended — App Check:**
  1. Create a reCAPTCHA Enterprise key for your domain.
  2. Set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
  3. Register the app under **App Check** in the console.
  4. Once the metrics show verified traffic, enforce App Check for Firestore, Storage and Auth.
- [ ] **Recommended — budget alerts:** in Google Cloud Billing, especially for Storage egress from video.
- [ ] **Recommended — scheduled Firestore backups:** `gcloud firestore backups schedules create`.
- [ ] Email templates customised (Auth → Templates), and optionally a custom action URL domain.

## Local development

Requires **Java 11+** for the Firebase Emulator Suite. No cloud project is needed.

```bash
cp .env.example .env.local
# in .env.local: NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true,
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-lms, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-lms.appspot.com,
#   and any non-empty placeholder for the other NEXT_PUBLIC_FIREBASE_* values
npm run emulators                                   # terminal 1 — Emulator UI at http://localhost:4000
npm run dev                                         # terminal 2 — http://localhost:3000
npm run set-role:local -- you@example.com superadmin # after registering in the app
```

Emulator data is in-memory and resets when the emulators stop. Production builds refuse to run against the emulators. Use `.env.production.local` with real values for local production builds.

## Live classes (meetings & recordings)

Classes run on your existing meeting platform: **Zoom, Google Meet or Microsoft Teams**. The LMS doesn't host video calls.

1. **Schedule:** in *Live classes → Schedule*, pick the course, time and duration, and paste the meeting link. Enrolled learners are notified.
2. **Join:** learners click **Join now** (on the Live classes page, their dashboard, or the "Live now" banner). The link opens in a new tab, and the LMS records that they joined.
3. **After the class:** open the class page and click **Mark as ended**. Then:
   - **Upload recording video:** MP4, WebM or MOV, up to 2 GB per file. It's stored in Firebase Storage under `courses/{course}/recordings/{session}/` and plays inside the LMS. You can upload several parts.
   - **Recording link:** for recordings kept elsewhere, such as Zoom cloud recordings, YouTube (unlisted) or Google Drive.

   Learners are notified when a recording is added. Hosts can remove an uploaded recording at any time, and the file is deleted from Storage too.
4. **Attendance:** hosts see who opened the meeting link, and when, on the class page, with CSV export.

**Costs:** uploaded recordings use Firebase Storage (storage plus download bandwidth). For long, frequently watched recordings, a link to Zoom/YouTube/Drive costs nothing on your side.

## AI assistant (Vertex AI Gemini)

The floating **Ask AI** tutor uses **Firebase AI Logic** with the **Vertex AI Gemini API**. Requests go from the browser through Firebase, so there are no API keys in the app.

1. Firebase console → **AI Logic** → **Get started** → choose the **Vertex AI Gemini API** (requires the Blaze plan). This enables the required Google Cloud APIs.
2. Optional: set `NEXT_PUBLIC_GEMINI_MODEL` (default `gemini-3.8-flash`) and `NEXT_PUBLIC_AI_LOCATION` (default `global`).
3. Recommended: enable **App Check** (above) and enforce it for AI Logic, so only your app can spend your Gemini quota.

The tutor is given the lesson's text, its transcript (if any) and the learner's current video position. In the lesson editor, instructors can paste a transcript or generate one with Gemini from an uploaded video. The super admin can switch the assistant off platform-wide.

**Troubleshooting** — the assistant shows what's wrong, and the browser console (F12) has the full error:

| Message / error | Fix |
| --- | --- |
| "isn't set up yet" · `genai config not found` | Firebase console → **AI Logic** → **Get started** → **Vertex AI Gemini API**. Wait a few minutes. |
| "requires App Check" · `you must enforce Firebase App Check` | The AI Logic setup enforces App Check. Create a reCAPTCHA Enterprise key, set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and register the web app under **App Check**. For local development, register the debug token printed in the browser console (**App Check → Apps → ⋮ → Manage debug tokens**). |
| "model … isn't available" · `Publisher Model … was not found` | Use a current model (default `gemini-3.8-flash`) with `NEXT_PUBLIC_AI_LOCATION=global`; retired models return this error. |
| "API key can't use AI Logic" · `Requests to this API firebasevertexai.googleapis.com … are blocked` | Google Cloud → **APIs & Services → Credentials** → your Browser key → add **Firebase AI Logic API** to its allowed APIs. |
| "needs the Blaze plan" · quota / billing errors (429) | Upgrade to **Blaze**; check quotas in Google Cloud. |

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run check` | Lint, typecheck and production build |
| `npm run test:rules` | 46 Firestore & Storage security-rules tests (starts the emulators automatically) |
| `npm run deploy:rules` | Deploy Firestore rules/indexes and Storage rules |
| `npm run set-role -- <email> <role> --project <id>` | Set a user's role in production (`student`, `instructor`, `admin`, `superadmin`) |
| `npm run emulators` / `set-role:local` | Local emulators / promote a local user |

## Operational notes

- **Email notifications:** in-app notifications work out of the box, and users' preferences are stored. To also send email, install the *Trigger Email* Firebase Extension and point it at `users/{uid}/notifications`.
- **YouTube & Vimeo lessons:** watch enforcement uses the staff-recorded video length. It's captured automatically for uploaded videos; for YouTube and Vimeo lessons, an instructor should preview each lesson once after adding it.
- **Progress integrity:** the rules make skipping and fake completion impractical. For certification-grade guarantees, move completion to Cloud Functions.
- **Recordings:** class recordings are stored in Cloud Storage. Watch Storage costs, and consider a lifecycle rule for old recordings.
- **Deletes cascade:** every delete runs on the server (`/api/delete`, `src/lib/server/cascade.ts`) and removes everything that belongs to the record:
  - **Course:** all content, enrolments, grades, live classes, learners' notes and every file.
  - **Module or lesson:** lesson videos and files, learners' progress, notes and Q&A. Deleting a module also deletes its coursework.
  - **Coursework:** submissions and their files.
  - **Live class:** attendance and uploaded recording videos.
  - **Removing a learner:** their progress, notes, submissions and files.
  - **Replacing a file:** a replaced course cover or lesson video is deleted too.
  - **Kept on purpose:** audit log entries.
