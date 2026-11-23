/**
 * Security-rules test suite. Runs against the Firebase emulators:
 *   npm run test:rules
 *
 * Fixtures are written with the Admin SDK (bypasses rules); every assertion
 * then uses the client SDK authenticated as a specific role.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import {
  collectionGroup,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  query,
  serverTimestamp,
  setDoc,
  addDoc,
  collection,
  Timestamp,
  updateDoc,
  writeBatch,
  where,
  terminate,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, ref, uploadBytes } from "firebase/storage";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getFirestore as adminFirestore, Timestamp as AdminTimestamp } from "firebase-admin/firestore";

const PROJECT = process.env.GCLOUD_PROJECT || "demo-lms";
const [FS_HOST, FS_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const [ST_HOST, ST_PORT] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199").split(":");
const BUCKET = `${PROJECT}.appspot.com`;

initAdmin({ projectId: PROJECT });
const admin = adminFirestore();

const USERS = {
  superadmin: { uid: "u-super", email: "super@test.dev", role: "superadmin" },
  admin: { uid: "u-admin", email: "admin@test.dev", role: "admin" },
  instructor: { uid: "u-inst", email: "inst@test.dev", role: "instructor" },
  otherInstructor: { uid: "u-inst2", email: "inst2@test.dev", role: "instructor" },
  student: { uid: "u-student", email: "student@test.dev", role: "student" },
  outsider: { uid: "u-outsider", email: "outsider@test.dev", role: "student" },
};

const apps = [];
function clientFor(user) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "fake-key", storageBucket: BUCKET }, `app-${user?.uid ?? "anon"}-${apps.length}`);
  apps.push(app);
  const db = initializeFirestore(app, {});
  const token = user ? { sub: user.uid, user_id: user.uid, email: user.email } : undefined;
  connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT), token ? { mockUserToken: token } : undefined);
  const storage = getStorage(app);
  connectStorageEmulator(storage, ST_HOST, Number(ST_PORT), token ? { mockUserToken: token } : undefined);
  return { db, storage };
}

async function allowed(promise) {
  await assert.doesNotReject(promise);
}
async function denied(promise) {
  await assert.rejects(promise, (err) => {
    const code = String(err?.code ?? "");
    assert.ok(code.includes("permission-denied") || code.includes("unauthorized"), `Expected denial, got ${code}: ${err?.message}`);
    return true;
  });
}

const profileFor = (u, role = "student") => ({
  uid: u.uid,
  email: u.email,
  displayName: "Test User",
  photoURL: null,
  phone: null,
  bio: "",
  role,
  notifications: { assignments: true, liveClasses: true, grades: true, announcements: false },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const COURSE = "c-published";
const DRAFT = "c-draft";
const OPEN = "c-open";

before(async () => {
  await fetch(`http://${FS_HOST}:${FS_PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });

  for (const u of Object.values(USERS)) {
    if (u === USERS.outsider) continue; // outsider creates their own profile in a test
    await admin.doc(`users/${u.uid}`).set({ ...profileFor(u, u.role), createdAt: AdminTimestamp.now(), updatedAt: AdminTimestamp.now() });
  }

  const course = (status, allowSelfEnroll) => ({
    title: "Test Course",
    code: "T-1",
    description: "",
    category: "",
    level: "beginner",
    status,
    coverImageUrl: null,
    cohort: null,
    startDate: null,
    allowSelfEnroll,
    instructorIds: [USERS.instructor.uid],
    instructorNames: ["Inst"],
    moduleCount: 1,
    lessonCount: 2,
    totalMinutes: 10,
    createdBy: USERS.admin.uid,
    createdAt: AdminTimestamp.now(),
    updatedAt: AdminTimestamp.now(),
  });
  await admin.doc(`courses/${COURSE}`).set(course("published", false));
  await admin.doc(`courses/${DRAFT}`).set(course("draft", true));
  await admin.doc(`courses/${OPEN}`).set(course("published", true));

  await admin.doc(`courses/${COURSE}/lessons/l1`).set({ moduleId: "m1", title: "L1", type: "article", order: 0, durationMinutes: 10 });
  await admin.doc(`courses/${COURSE}/lessonContent/l1`).set({ body: "secret", videoUrl: null, resources: [] });
  await admin.doc(`courses/${COURSE}/lessons/l2`).set({ moduleId: "m1", title: "Video", type: "video", order: 1, durationMinutes: 2, hasVideo: true, videoDurationSeconds: 100 });
  await admin.doc(`courses/${COURSE}/enrollments/${USERS.student.uid}`).set({
    userId: USERS.student.uid,
    courseId: COURSE,
    userName: "Student",
    userEmail: USERS.student.email,
    status: "active",
    progress: 0,
    completedLessonIds: [],
    lastLessonId: null,
    enrolledBy: USERS.admin.uid,
    enrolledAt: AdminTimestamp.now(),
    updatedAt: AdminTimestamp.now(),
    completedAt: null,
  });
  await admin.doc(`courses/${COURSE}/assignments/a1`).set({
    courseId: COURSE,
    courseTitle: "Test Course",
    title: "Assignment 1",
    description: "",
    dueAt: AdminTimestamp.fromMillis(Date.now() + 86_400_000),
    points: 20,
    createdBy: USERS.instructor.uid,
  });
});

after(async () => {
  await Promise.all(apps.map(async (a) => {
    try { await terminate(initializeFirestore(a, {})); } catch { /* already initialised */ }
    await deleteApp(a);
  }));
});

const submissionData = (overrides = {}) => ({
  userId: USERS.student.uid,
  userName: "Student",
  courseId: COURSE,
  assignmentId: "a1",
  assignmentTitle: "Assignment 1",
  fileName: "work.pdf",
  filePath: `submissions/${COURSE}/a1/${USERS.student.uid}/work.pdf`,
  fileUrl: "https://example.com/x",
  fileSize: 100,
  note: null,
  status: "submitted",
  grade: null,
  feedback: null,
  submittedAt: serverTimestamp(),
  gradedAt: null,
  gradedBy: null,
  gradedByName: null,
  ...overrides,
});

describe("users", () => {
  test("new users can only create a student profile for themselves", async () => {
    const { db } = clientFor(USERS.outsider);
    await denied(setDoc(doc(db, "users", USERS.outsider.uid), profileFor(USERS.outsider, "admin")));
    await denied(setDoc(doc(db, "users", USERS.student.uid), profileFor(USERS.outsider)));
    await allowed(setDoc(doc(db, "users", USERS.outsider.uid), profileFor(USERS.outsider)));
  });

  test("users cannot escalate their own role", async () => {
    const { db } = clientFor(USERS.student);
    await denied(updateDoc(doc(db, "users", USERS.student.uid), { role: "admin" }));
    await allowed(updateDoc(doc(db, "users", USERS.student.uid), { displayName: "New Name", updatedAt: serverTimestamp() }));
  });

  test("students cannot read other profiles; staff can", async () => {
    await denied(getDoc(doc(clientFor(USERS.student).db, "users", USERS.instructor.uid)));
    await allowed(getDoc(doc(clientFor(USERS.instructor).db, "users", USERS.student.uid)));
  });
});

describe("courses", () => {
  test("published courses are visible to signed-in users only", async () => {
    await allowed(getDoc(doc(clientFor(USERS.outsider).db, "courses", COURSE)));
    await denied(getDoc(doc(clientFor(null).db, "courses", COURSE)));
  });

  test("drafts are hidden from students but visible to their instructor", async () => {
    await denied(getDoc(doc(clientFor(USERS.student).db, "courses", DRAFT)));
    await allowed(getDoc(doc(clientFor(USERS.instructor).db, "courses", DRAFT)));
    await denied(getDoc(doc(clientFor(USERS.otherInstructor).db, "courses", DRAFT)));
  });

  test("catalog query for published courses is allowed", async () => {
    const { db } = clientFor(USERS.outsider);
    await allowed(getDocs(query(collection(db, "courses"), where("status", "==", "published"))));
  });

  test("students cannot create courses; instructors only as themselves", async () => {
    const base = {
      title: "New Course", code: "", description: "", category: "", level: "beginner", status: "draft",
      coverImageUrl: null, cohort: null, startDate: null, allowSelfEnroll: false, instructorNames: ["x"],
      moduleCount: 0, lessonCount: 0, totalMinutes: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await denied(addDoc(collection(clientFor(USERS.student).db, "courses"), { ...base, instructorIds: [USERS.student.uid], createdBy: USERS.student.uid }));
    const inst = clientFor(USERS.instructor).db;
    await denied(addDoc(collection(inst, "courses"), { ...base, instructorIds: [USERS.otherInstructor.uid], createdBy: USERS.instructor.uid }));
    await allowed(addDoc(collection(inst, "courses"), { ...base, instructorIds: [USERS.instructor.uid], createdBy: USERS.instructor.uid }));
  });

  test("instructors cannot change the instructor list; admins can", async () => {
    await denied(updateDoc(doc(clientFor(USERS.instructor).db, "courses", OPEN), { instructorIds: [USERS.instructor.uid, USERS.otherInstructor.uid], instructorNames: ["a", "b"] }));
    await allowed(updateDoc(doc(clientFor(USERS.instructor).db, "courses", OPEN), { description: "Updated" }));
    await allowed(updateDoc(doc(clientFor(USERS.admin).db, "courses", OPEN), { instructorIds: [USERS.instructor.uid, USERS.otherInstructor.uid], instructorNames: ["a", "b"] }));
  });
});

describe("lesson content", () => {
  test("syllabus is public to signed-in users, content requires enrolment", async () => {
    const outsider = clientFor(USERS.outsider).db;
    await allowed(getDoc(doc(outsider, "courses", COURSE, "lessons", "l1")));
    await denied(getDoc(doc(outsider, "courses", COURSE, "lessonContent", "l1")));
    await allowed(getDoc(doc(clientFor(USERS.student).db, "courses", COURSE, "lessonContent", "l1")));
    await allowed(getDoc(doc(clientFor(USERS.instructor).db, "courses", COURSE, "lessonContent", "l1")));
  });

  test("students cannot edit lessons", async () => {
    await denied(updateDoc(doc(clientFor(USERS.student).db, "courses", COURSE, "lessonContent", "l1"), { body: "hacked" }));
  });
});

describe("enrolments", () => {
  const fresh = (u, courseId) => ({
    userId: u.uid, courseId, userName: "x", userEmail: u.email, status: "active", progress: 0,
    completedLessonIds: [], lastLessonId: null, enrolledBy: u.uid, enrolledAt: serverTimestamp(),
    updatedAt: serverTimestamp(), completedAt: null,
  });

  test("self-enrolment only when the course allows it", async () => {
    const { db } = clientFor(USERS.outsider);
    await denied(setDoc(doc(db, "courses", COURSE, "enrollments", USERS.outsider.uid), fresh(USERS.outsider, COURSE)));
    await denied(setDoc(doc(db, "courses", DRAFT, "enrollments", USERS.outsider.uid), fresh(USERS.outsider, DRAFT)));
    await allowed(setDoc(doc(db, "courses", OPEN, "enrollments", USERS.outsider.uid), fresh(USERS.outsider, OPEN)));
  });

  test("cannot self-enrol with pre-filled progress", async () => {
    const { db } = clientFor(USERS.student);
    await denied(setDoc(doc(db, "courses", OPEN, "enrollments", USERS.student.uid), { ...fresh(USERS.student, OPEN), progress: 100 }));
  });

  test("students may only update progress fields", async () => {
    const ref = (db) => doc(db, "courses", COURSE, "enrollments", USERS.student.uid);
    const { db } = clientFor(USERS.student);
    await allowed(updateDoc(ref(db), { completedLessonIds: ["l1"], lastCompletedLessonId: "l1", progress: 50, status: "active", updatedAt: serverTimestamp() }));
    await denied(updateDoc(ref(db), { progress: 100, updatedAt: serverTimestamp() }));
    await denied(updateDoc(ref(db), { status: "completed", updatedAt: serverTimestamp() }));
    await denied(updateDoc(ref(db), { enrolledBy: USERS.student.uid }));
    await denied(updateDoc(ref(clientFor(USERS.outsider).db), { progress: 50 }));
  });

  test("collection-group query of own enrolments is allowed, others' is not", async () => {
    const { db } = clientFor(USERS.student);
    await allowed(getDocs(query(collectionGroup(db, "enrollments"), where("userId", "==", USERS.student.uid))));
    await denied(getDocs(query(collectionGroup(db, "enrollments"), where("userId", "==", USERS.outsider.uid))));
  });
});

describe("submissions & grading", () => {
  const subRef = (db, uid = USERS.student.uid) => doc(db, "courses", COURSE, "assignments", "a1", "submissions", uid);

  test("students cannot pre-grade or submit for others", async () => {
    const { db } = clientFor(USERS.student);
    await denied(setDoc(subRef(db), submissionData({ grade: 20, status: "graded" })));
    await denied(setDoc(subRef(db, USERS.outsider.uid), submissionData({ userId: USERS.outsider.uid })));
  });

  test("non-enrolled users cannot submit", async () => {
    const { db } = clientFor(USERS.outsider);
    await denied(setDoc(subRef(db, USERS.outsider.uid), submissionData({ userId: USERS.outsider.uid })));
  });

  test("enrolled students can submit", async () => {
    await allowed(setDoc(subRef(clientFor(USERS.student).db), submissionData()));
  });

  test("students cannot grade; instructors grade within the point range", async () => {
    const gradeUpdate = (grade) => ({ grade, feedback: "ok", status: "graded", gradedAt: serverTimestamp(), gradedBy: "x", gradedByName: "x" });
    await denied(updateDoc(subRef(clientFor(USERS.student).db), gradeUpdate(20)));
    await denied(updateDoc(subRef(clientFor(USERS.otherInstructor).db), gradeUpdate(10)));
    await denied(updateDoc(subRef(clientFor(USERS.instructor).db), gradeUpdate(25)));
    await allowed(updateDoc(subRef(clientFor(USERS.instructor).db), gradeUpdate(18)));
  });

  test("students cannot resubmit after grading", async () => {
    await denied(updateDoc(subRef(clientFor(USERS.student).db), { fileName: "v2.pdf", submittedAt: serverTimestamp() }));
  });
});

describe("activity", () => {
  test("actors cannot impersonate others", async () => {
    const { db } = clientFor(USERS.student);
    const entry = (actorId) => ({ courseId: COURSE, courseTitle: "T", actorId, actorName: "x", type: "submitted", message: "did a thing", createdAt: serverTimestamp() });
    await denied(addDoc(collection(db, "courses", COURSE, "activity"), entry(USERS.instructor.uid)));
    await allowed(addDoc(collection(db, "courses", COURSE, "activity"), entry(USERS.student.uid)));
  });
});

describe("video watch enforcement", () => {
  const progressRef = (db) => doc(db, "courses", COURSE, "enrollments", USERS.student.uid, "lessonProgress", "l2");
  const enrollRef = (db) => doc(db, "courses", COURSE, "enrollments", USERS.student.uid);
  const complete = { completedLessonIds: ["l1", "l2"], lastCompletedLessonId: "l2", progress: 100, status: "completed", updatedAt: serverTimestamp() };
  const progress = (maxWatched, position = maxWatched) => ({ position, maxWatched, duration: 100, percent: Math.round(maxWatched), updatedAt: serverTimestamp() });

  test("a video lesson cannot be completed without watching it", async () => {
    await denied(updateDoc(enrollRef(clientFor(USERS.student).db), complete));
  });

  test("first progress save cannot claim more than a minute watched", async () => {
    const { db } = clientFor(USERS.student);
    await denied(setDoc(progressRef(db), progress(95)));
    await allowed(setDoc(progressRef(db), progress(30)));
  });

  test("watch position cannot jump ahead faster than real time", async () => {
    const { db } = clientFor(USERS.student);
    await denied(updateDoc(progressRef(db), progress(95)));
    await denied(updateDoc(progressRef(db), progress(10))); // cannot move backwards either
    await allowed(updateDoc(progressRef(db), progress(40)));
  });

  test("other users cannot read or write someone's progress", async () => {
    await denied(getDoc(progressRef(clientFor(USERS.outsider).db)));
    await allowed(getDoc(progressRef(clientFor(USERS.instructor).db)));
  });

  test("after genuinely watching enough, the lesson can be completed", async () => {
    // Simulate 60 s of real watching by back-dating the last save.
    await admin.doc(`courses/${COURSE}/enrollments/${USERS.student.uid}/lessonProgress/l2`).update({
      updatedAt: AdminTimestamp.fromMillis(Date.now() - 60_000),
    });
    const { db } = clientFor(USERS.student);
    await allowed(updateDoc(progressRef(db), progress(95)));
    await allowed(updateDoc(enrollRef(db), complete));
  });
});

describe("notifications", () => {
  const note = (actor, overrides = {}) => ({
    type: "discussion", title: "Hello", body: "", link: "/dashboard", courseId: COURSE,
    actorId: actor.uid, actorName: "Actor", read: false, createdAt: serverTimestamp(), ...overrides,
  });
  const inbox = (db, uid) => collection(db, "users", uid, "notifications");

  test("students can notify their instructors but not strangers", async () => {
    const { db } = clientFor(USERS.student);
    await allowed(addDoc(inbox(db, USERS.instructor.uid), note(USERS.student)));
    await denied(addDoc(inbox(db, USERS.otherInstructor.uid), note(USERS.student)));
    await denied(addDoc(inbox(db, USERS.instructor.uid), note(USERS.student, { actorId: USERS.admin.uid })));
  });

  test("links must stay inside the app", async () => {
    const { db } = clientFor(USERS.student);
    await denied(addDoc(inbox(db, USERS.instructor.uid), note(USERS.student, { link: "https://evil.example" })));
    await denied(addDoc(inbox(db, USERS.instructor.uid), note(USERS.student, { link: "//evil.example" })));
  });

  test("instructors can fan out to many learners in one batch", async () => {
    const { db } = clientFor(USERS.instructor);
    const batch = writeBatch(db);
    for (let i = 0; i < 25; i++) batch.set(doc(inbox(db, `learner-${i}`)), note(USERS.instructor, { type: "announcement" }));
    await allowed(batch.commit());
  });

  test("only the recipient can read and mark notifications as read", async () => {
    const { db } = clientFor(USERS.instructor);
    const ref = await addDoc(inbox(clientFor(USERS.instructor).db, USERS.student.uid), note(USERS.instructor));
    await denied(getDoc(doc(clientFor(USERS.outsider).db, ref.path)));
    await allowed(updateDoc(doc(clientFor(USERS.student).db, ref.path), { read: true }));
    await denied(updateDoc(doc(clientFor(USERS.student).db, ref.path), { title: "changed" }));
    void db;
  });
});

describe("live class attendance", () => {
  test("only enrolled learners record their own attendance; minutes can't be inflated", async () => {
    await admin.doc(`courses/${COURSE}/liveSessions/s1`).set({ courseId: COURSE, title: "Live", startAt: AdminTimestamp.now(), durationMinutes: 60 });
    const outsiderRef = doc(clientFor(USERS.outsider).db, "courses", COURSE, "liveSessions", "s1", "attendance", USERS.outsider.uid);
    await denied(setDoc(outsiderRef, { userId: USERS.outsider.uid, userName: "O", role: "student", minutes: 0, firstJoinedAt: serverTimestamp(), lastSeenAt: serverTimestamp() }));
    const { db } = clientFor(USERS.student);
    const ref = doc(db, "courses", COURSE, "liveSessions", "s1", "attendance", USERS.student.uid);
    await denied(setDoc(ref, { userId: USERS.student.uid, userName: "S", role: "student", minutes: 30, firstJoinedAt: serverTimestamp(), lastSeenAt: serverTimestamp() }));
    await allowed(setDoc(ref, { userId: USERS.student.uid, userName: "S", role: "student", minutes: 0, firstJoinedAt: serverTimestamp(), lastSeenAt: serverTimestamp() }));
    await denied(updateDoc(ref, { minutes: 1, lastSeenAt: serverTimestamp() }));
    await allowed(updateDoc(ref, { lastSeenAt: serverTimestamp() }));
  });
});

describe("discussions & announcements", () => {
  const post = (u) => ({ lessonId: "l1", parentId: null, authorId: u.uid, authorName: "X", authorRole: "student", body: "Question?", resolved: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  test("learners can ask questions; outsiders cannot read the thread", async () => {
    const ref = await addDoc(collection(clientFor(USERS.student).db, "courses", COURSE, "discussions"), post(USERS.student));
    await denied(getDoc(doc(clientFor(USERS.outsider).db, ref.path)));
    await allowed(updateDoc(doc(clientFor(USERS.instructor).db, ref.path), { resolved: true, updatedAt: serverTimestamp() }));
    await denied(updateDoc(doc(clientFor(USERS.instructor).db, ref.path), { body: "edited by someone else" }));
  });

  test("only staff can post announcements", async () => {
    const a = { title: "Welcome", body: "Hello class", pinned: false, authorId: "x", authorName: "X", createdAt: serverTimestamp() };
    await denied(addDoc(collection(clientFor(USERS.student).db, "courses", COURSE, "announcements"), a));
    await allowed(addDoc(collection(clientFor(USERS.instructor).db, "courses", COURSE, "announcements"), a));
  });
});

describe("roles, super admin & audit log", () => {
  const audit = (actor, targetId, overrides = {}) => ({
    actorId: actor.uid, actorName: "Actor", actorRole: actor.role, action: "user.role_changed",
    targetType: "user", targetId, targetLabel: "x", courseId: null, summary: "changed a role",
    createdAt: serverTimestamp(), ...overrides,
  });
  // Role change + audit entry in one atomic batch (as the app does).
  function changeRole(actor, target, role, { withAudit = true } = {}) {
    const { db } = clientFor(actor);
    const batch = writeBatch(db);
    const logRef = doc(collection(db, "auditLogs"));
    if (withAudit) batch.set(logRef, audit(actor, target.uid));
    batch.update(doc(db, "users", target.uid), { role, updatedAt: serverTimestamp(), lastAuditId: logRef.id });
    return batch.commit();
  }

  test("role changes are rejected unless written with an audit-log entry", async () => {
    await denied(changeRole(USERS.admin, USERS.outsider, "instructor", { withAudit: false }));
    await denied(updateDoc(doc(clientFor(USERS.admin).db, "users", USERS.outsider.uid), { role: "instructor", updatedAt: serverTimestamp() }));
    await allowed(changeRole(USERS.admin, USERS.outsider, "instructor"));
    await allowed(changeRole(USERS.admin, USERS.outsider, "student"));
  });

  test("admins cannot create admins, touch admins, or change their own role", async () => {
    await denied(changeRole(USERS.admin, USERS.outsider, "admin"));
    await denied(changeRole(USERS.admin, USERS.outsider, "superadmin"));
    await denied(changeRole(USERS.admin, USERS.superadmin, "student"));
    await denied(changeRole(USERS.admin, USERS.admin, "student"));
  });

  test("only a super admin can grant and revoke admin", async () => {
    await allowed(changeRole(USERS.superadmin, USERS.otherInstructor, "admin"));
    await allowed(changeRole(USERS.superadmin, USERS.otherInstructor, "instructor"));
    await denied(changeRole(USERS.superadmin, USERS.outsider, "superadmin"));
    await denied(changeRole(USERS.superadmin, USERS.superadmin, "admin"));
  });

  test("audit log: staff append-only, readable by super admins only, actor can't be spoofed", async () => {
    const logs = (u) => collection(clientFor(u).db, "auditLogs");
    const ref = await addDoc(logs(USERS.instructor), audit(USERS.instructor, "c1", { action: "course.updated" }));
    await denied(addDoc(logs(USERS.student), audit(USERS.student, "c1")));
    await denied(addDoc(logs(USERS.instructor), audit(USERS.admin, "c1")));
    await denied(addDoc(logs(USERS.instructor), audit(USERS.instructor, "c1", { actorRole: "admin" })));
    await denied(getDoc(doc(clientFor(USERS.admin).db, ref.path)));
    await denied(getDocs(logs(USERS.instructor)));
    await allowed(getDocs(logs(USERS.superadmin)));
    await denied(updateDoc(doc(clientFor(USERS.superadmin).db, ref.path), { summary: "edited" }));
  });

  test("platform settings: everyone reads, only the super admin writes", async () => {
    const ref = (u) => doc(clientFor(u).db, "settings", "platform");
    await denied(setDoc(ref(USERS.admin), { aiAssistantEnabled: false }));
    await allowed(setDoc(ref(USERS.superadmin), { aiAssistantEnabled: false }));
    await allowed(getDoc(ref(USERS.student)));
  });
});

describe("required coursework", () => {
  const WORK = "c-work";
  const enrollRef = (db) => doc(db, "courses", WORK, "enrollments", USERS.student.uid);
  const subRef = (db) => doc(db, "courses", WORK, "assignments", "cw1", "submissions", USERS.student.uid);
  const grade = (g) => ({ grade: g, feedback: "fb", status: "graded", gradedAt: serverTimestamp(), gradedBy: "x", gradedByName: "x" });

  before(async () => {
    const base = (await admin.doc(`courses/${COURSE}`).get()).data();
    await admin.doc(`courses/${WORK}`).set({ ...base, lessonCount: 1, requiredCourseworkIds: ["cw1"] });
    await admin.doc(`courses/${WORK}/lessons/l1`).set({ moduleId: "m1", title: "L1", type: "article", order: 0, durationMinutes: 5 });
    await admin.doc(`courses/${WORK}/assignments/cw1`).set({
      courseId: WORK, courseTitle: "Test Course", title: "Module 1 coursework", description: "",
      dueAt: AdminTimestamp.fromMillis(Date.now() + 86_400_000), points: 20, passMark: 10, required: true, moduleId: "m1",
    });
    await admin.doc(`courses/${WORK}/enrollments/${USERS.student.uid}`).set({
      userId: USERS.student.uid, courseId: WORK, userName: "Student", userEmail: USERS.student.email, status: "active",
      progress: 0, completedLessonIds: [], passedCourseworkIds: [], lastLessonId: null, enrolledBy: USERS.admin.uid,
      enrolledAt: AdminTimestamp.now(), updatedAt: AdminTimestamp.now(), completedAt: null,
    });
  });

  test("finishing every lesson is not enough while coursework is outstanding", async () => {
    const { db } = clientFor(USERS.student);
    const done = { completedLessonIds: ["l1"], lastCompletedLessonId: "l1", updatedAt: serverTimestamp() };
    await denied(updateDoc(enrollRef(db), { ...done, progress: 100, status: "completed" }));
    await allowed(updateDoc(enrollRef(db), { ...done, progress: 50, status: "active" }));
    await denied(updateDoc(enrollRef(db), { status: "completed", progress: 100, updatedAt: serverTimestamp() }));
  });

  test("students cannot mark their own coursework as passed", async () => {
    await denied(updateDoc(enrollRef(clientFor(USERS.student).db), { passedCourseworkIds: ["cw1"] }));
  });

  test("a failed submission can be resubmitted; a passed one cannot", async () => {
    const student = clientFor(USERS.student).db;
    const staff = clientFor(USERS.instructor).db;
    const resubmit = { fileName: "v2.pdf", submittedAt: serverTimestamp(), status: "submitted", grade: null, feedback: null, gradedAt: null, gradedBy: null, gradedByName: null };
    await allowed(setDoc(subRef(student), submissionData({ courseId: WORK, assignmentId: "cw1" })));
    await allowed(updateDoc(subRef(staff), grade(5)));    // below the pass mark (10)
    await denied(updateDoc(subRef(student), { ...resubmit, grade: 20 })); // can't self-grade while resubmitting
    await allowed(updateDoc(subRef(student), resubmit));
    await allowed(updateDoc(subRef(staff), grade(15)));   // pass
    await denied(updateDoc(subRef(student), resubmit));
  });

  test("once the grader records the pass, the course can be completed", async () => {
    await allowed(updateDoc(enrollRef(clientFor(USERS.instructor).db), { passedCourseworkIds: ["cw1"], updatedAt: serverTimestamp() }));
    await allowed(updateDoc(enrollRef(clientFor(USERS.student).db), { status: "completed", progress: 100, completedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});

describe("live sessions (external meetings + recordings)", () => {
  const sessions = (u) => collection(clientFor(u).db, "courses", COURSE, "liveSessions");
  const valid = {
    courseId: COURSE, courseTitle: "Course", title: "Weekly class", description: "", hostId: USERS.instructor.uid, hostName: "Ina",
    startAt: new Date(), durationMinutes: 60, mode: "external", meetingUrl: "https://meet.google.com/abc-defg-hij", recordingUrl: null,
    endedAt: null, createdAt: serverTimestamp(),
  };

  test("staff schedule classes, mark them ended and add recordings; learners can't", async () => {
    const ref = await addDoc(sessions(USERS.instructor), valid);
    await denied(addDoc(sessions(USERS.student), valid));
    await denied(addDoc(sessions(USERS.instructor), { ...valid, courseId: "other" }));
    await denied(addDoc(sessions(USERS.instructor), { ...valid, endedAt: serverTimestamp() }));

    const part = { name: "class.mp4", url: "https://firebasestorage.googleapis.com/v0/b/x/o/y", path: "courses/c/recordings/s/class.mp4", size: 10, seconds: 60, startedAt: 1 };
    const mine = doc(clientFor(USERS.instructor).db, ref.path);
    const theirs = doc(clientFor(USERS.student).db, ref.path);
    await allowed(updateDoc(mine, { title: "Renamed class" }));
    await allowed(updateDoc(mine, { endedAt: serverTimestamp() }));
    await allowed(updateDoc(mine, { recordings: [part], recordingUrl: "https://zoom.us/rec/share/abc" }));
    await denied(updateDoc(mine, { recordings: Array.from({ length: 51 }, () => part) }));
    await denied(updateDoc(theirs, { recordingUrl: "https://evil.example" }));
    await denied(updateDoc(theirs, { recordings: [part] }));
    await denied(updateDoc(theirs, { endedAt: serverTimestamp() }));
  });
});

describe("storage", () => {
  test("recordings: course staff upload videos; learners can't", async () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const path = `courses/${COURSE}/recordings/s1/1700000000000-class.mp4`;
    await denied(uploadBytes(ref(clientFor(USERS.student).storage, path), mp4, { contentType: "video/mp4" }));
    await denied(uploadBytes(ref(clientFor(USERS.instructor).storage, path), mp4, { contentType: "application/pdf" }));
    await allowed(uploadBytes(ref(clientFor(USERS.instructor).storage, path), mp4, { contentType: "video/mp4" }));
  });

  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const pdf = new Uint8Array([37, 80, 68, 70]);

  test("avatars: owners only, images only", async () => {
    const { storage } = clientFor(USERS.student);
    await allowed(uploadBytes(ref(storage, `avatars/${USERS.student.uid}/me.png`), png, { contentType: "image/png" }));
    await denied(uploadBytes(ref(storage, `avatars/${USERS.outsider.uid}/me.png`), png, { contentType: "image/png" }));
    await denied(uploadBytes(ref(storage, `avatars/${USERS.student.uid}/x.html`), png, { contentType: "text/html" }));
  });

  test("submissions: enrolled owner only", async () => {
    await allowed(
      uploadBytes(ref(clientFor(USERS.student).storage, `submissions/${COURSE}/a1/${USERS.student.uid}/work.pdf`), pdf, { contentType: "application/pdf" }),
    );
    await denied(
      uploadBytes(ref(clientFor(USERS.outsider).storage, `submissions/${COURSE}/a1/${USERS.outsider.uid}/work.pdf`), pdf, { contentType: "application/pdf" }),
    );
  });

  test("lesson files: staff upload only", async () => {
    await denied(uploadBytes(ref(clientFor(USERS.student).storage, `courses/${COURSE}/lessons/l1/x.pdf`), pdf, { contentType: "application/pdf" }));
    await allowed(uploadBytes(ref(clientFor(USERS.instructor).storage, `courses/${COURSE}/lessons/l1/x.pdf`), pdf, { contentType: "application/pdf" }));
  });
});

void Timestamp;
