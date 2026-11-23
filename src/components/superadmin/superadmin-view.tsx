"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collectionGroup, getCountFromServer, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import {
  Activity,
  BookOpen,
  Download,
  GraduationCap,
  History,
  ScrollText,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/components/providers/auth-provider";
import { useCollection } from "@/hooks/use-firestore";
import { usePlatformSettings } from "@/hooks/use-platform";
import { firestore } from "@/lib/firebase/client";
import { refs } from "@/lib/services/refs";
import { findUserByEmail, setUserRole } from "@/lib/services/users";
import { updatePlatformSettings } from "@/lib/services/platform";
import { getErrorMessage } from "@/lib/errors";
import { downloadCsv } from "@/lib/csv";
import { roleLabels } from "@/config/site";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditLog, Role, UserProfile, WithId } from "@/types";

// ── Platform statistics ──────────────────────────────────────────────────────
interface Counts {
  students: number;
  instructors: number;
  admins: number;
  courses: number;
  published: number;
  enrollments: number;
  actions24h: number;
}

function usePlatformCounts() {
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    let cancelled = false;
    const db = firestore();
    const count = (q: Parameters<typeof getCountFromServer>[0]) => getCountFromServer(q).then((s) => s.data().count);
    const role = (r: Role) => count(query(refs.users(), where("role", "==", r)));
    Promise.all([
      role("student"),
      role("instructor"),
      role("admin"),
      role("superadmin"),
      count(query(refs.courses())),
      count(query(refs.courses(), where("status", "==", "published"))),
      count(collectionGroup(db, "enrollments")),
      count(query(refs.auditLogs(), where("createdAt", ">=", Timestamp.fromMillis(Date.now() - 86_400_000)))),
    ])
      .then(([students, instructors, admins, supers, courses, published, enrollments, actions24h]) => {
        if (!cancelled) {
          setCounts({ students, instructors, admins: admins + supers, courses, published, enrollments, actions24h });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return counts;
}

// ── Audit log ────────────────────────────────────────────────────────────────
const CATEGORIES: { value: string; label: string; tone: BadgeTone }[] = [
  { value: "user", label: "Users & roles", tone: "danger" },
  { value: "course", label: "Courses", tone: "brand" },
  { value: "module", label: "Curriculum", tone: "info" },
  { value: "lesson", label: "Curriculum", tone: "info" },
  { value: "assignment", label: "Coursework", tone: "warning" },
  { value: "submission", label: "Grading", tone: "success" },
  { value: "enrollment", label: "Enrolments", tone: "neutral" },
  { value: "session", label: "Live classes", tone: "live" },
  { value: "announcement", label: "Announcements", tone: "neutral" },
  { value: "settings", label: "Settings", tone: "danger" },
];
const categoryOf = (action: string) => CATEGORIES.find((c) => action.startsWith(`${c.value}.`));
const actionLabel = (action: string) =>
  action
    .split(".")
    .pop()!
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

function AuditLogPanel() {
  const [max, setMax] = useState(200);
  const q = useMemo(() => query(refs.auditLogs(), orderBy("createdAt", "desc"), limit(max)), [max]);
  const logs = useCollection<AuditLog>(q);
  const [term, setTerm] = useState("");
  const [actor, setActor] = useState("all");
  const [category, setCategory] = useState("all");

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    logs.data.forEach((l) => map.set(l.actorId, l.actorName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs.data]);

  const rows = logs.data.filter((l) => {
    if (actor !== "all" && l.actorId !== actor) return false;
    if (category !== "all") {
      const cat = categoryOf(l.action);
      if (!cat || (cat.label !== category)) return false;
    }
    if (term) {
      const hay = `${l.summary} ${l.actorName} ${l.targetLabel ?? ""} ${l.action}`.toLowerCase();
      if (!hay.includes(term.toLowerCase())) return false;
    }
    return true;
  });

  const categoryLabels = [...new Set(CATEGORIES.map((c) => c.label))];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={term} onChange={setTerm} placeholder="Search actions, people, courses…" className="lg:w-80" />
        <Select value={actor} onChange={(e) => setActor(e.target.value)} className="lg:w-56" aria-label="Filter by person">
          <option value="all">Everyone</option>
          {actors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="lg:w-52" aria-label="Filter by category">
          <option value="all">All categories</option>
          {categoryLabels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          className="lg:ml-auto"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Time", "Person", "Role", "Action", "Summary", "Target", "Target id", "Course id"],
              rows.map((l) => [
                formatDateTime(l.createdAt),
                l.actorName,
                l.actorRole,
                l.action,
                l.summary,
                l.targetLabel ?? "",
                l.targetId ?? "",
                l.courseId ?? "",
              ]),
            )
          }
        >
          <Download /> Export
        </Button>
      </div>

      {logs.loading ? (
        <Skeleton className="h-96 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={logs.data.length ? "No matching activity" : "No staff activity recorded yet"}
          description={logs.data.length ? undefined : "Every change made by instructors and administrators will appear here."}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {rows.map((l) => {
              const cat = categoryOf(l.action);
              return (
                <li key={l.id} className="flex gap-3 px-5 py-3.5">
                  <Avatar name={l.actorName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-slate-900">{l.actorName}</span>
                      <Badge tone={l.actorRole === "instructor" ? "success" : "danger"}>{roleLabels[l.actorRole] ?? l.actorRole}</Badge>
                      {cat && (
                        <Badge tone={cat.tone} dot>
                          {cat.label} · {actionLabel(l.action)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{l.summary}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <time title={formatDateTime(l.createdAt)}>{timeAgo(l.createdAt)}</time>
                      {" · "}
                      {formatDateTime(l.createdAt)}
                      {l.courseId && (
                        <>
                          {" · "}
                          <Link href={`/courses/${l.courseId}/manage`} className="text-brand-600 hover:text-brand-700">
                            Open course
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {logs.data.length >= max && (
            <div className="border-t border-slate-100 p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setMax((m) => m + 200)}>
                <History /> Load older activity
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Administrators ───────────────────────────────────────────────────────────
function AdministratorsPanel() {
  const me = useProfile();
  const q = useMemo(() => query(refs.users(), where("role", "in", ["admin", "superadmin"])), []);
  const admins = useCollection<UserProfile>(q);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ user: WithId<UserProfile> | UserProfile; role: Role } | null>(null);

  async function findAndPromote(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const user = await findUserByEmail(email);
      if (!user) throw new Error("No account with that email. Ask them to register first.");
      if (user.role === "admin" || user.role === "superadmin") throw new Error(`${user.displayName} is already an administrator.`);
      setPending({ user, role: "admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...admins.data].sort((a, b) => Number(b.role === "superadmin") - Number(a.role === "superadmin") || a.displayName.localeCompare(b.displayName));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Administrators</CardTitle>
            <CardDescription>Admins manage courses, users (students & instructors) and all content. Only you can grant or revoke admin.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {admins.loading ? (
            <div className="px-5">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sorted.map((u) => {
                const isMe = u.uid === me.uid;
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar name={u.displayName} src={u.photoURL} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {u.displayName} {isMe && <Badge className="ml-1">You</Badge>}
                      </p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                    {u.role === "superadmin" ? (
                      <Badge tone="danger">
                        <ShieldCheck className="size-3" /> Super Admin
                      </Badge>
                    ) : (
                      <Select
                        value={u.role}
                        className="h-9 w-44"
                        aria-label={`Role for ${u.displayName}`}
                        onChange={(e) => setPending({ user: u, role: e.target.value as Role })}
                      >
                        <option value="admin">Administrator</option>
                        <option value="instructor">Demote to instructor</option>
                        <option value="student">Demote to student</option>
                      </Select>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Add an administrator</CardTitle>
            <CardDescription>The person must already have an account.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form method="post" onSubmit={findAndPromote} className="space-y-3">
            <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <Button type="submit" className="w-full" loading={busy} disabled={!email.trim()}>
              <UserPlus /> Make administrator
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.role === "admin" ? `Make ${pending.user.displayName} an administrator?` : `Change ${pending?.user.displayName ?? ""}'s role?`}
        description={
          pending?.role === "admin"
            ? "They'll be able to manage all courses, users and content. This is recorded in the audit log."
            : `They'll lose administrator access and become ${pending ? roleLabels[pending.role].toLowerCase() : ""}. This is recorded in the audit log.`
        }
        tone={pending?.role === "admin" ? "primary" : "danger"}
        confirmLabel={pending?.role === "admin" ? "Make administrator" : "Change role"}
        onConfirm={async () => {
          if (!pending) return;
          await setUserRole(pending.user, pending.role, me);
          toast.success(`${pending.user.displayName} is now ${roleLabels[pending.role].toLowerCase()}`);
          setEmail("");
        }}
      />
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function SettingsPanel() {
  const me = useProfile();
  const platform = usePlatformSettings();
  const [saving, setSaving] = useState(false);

  async function toggleAi(on: boolean) {
    setSaving(true);
    try {
      await updatePlatformSettings({ aiAssistantEnabled: on }, me);
      toast.success(on ? "AI study assistant enabled" : "AI study assistant disabled");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-600" /> AI study assistant
            </CardTitle>
            <CardDescription>
              Gemini on Vertex AI (via Firebase AI Logic) answers learners&apos; questions about the lesson and video they&apos;re
              watching, and helps instructors generate video transcripts.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Switch
            label="Enable the AI study assistant"
            description="Shows the floating “Ask AI” button in every lesson. Usage is billed to your Google Cloud project."
            checked={platform.aiAssistantEnabled}
            disabled={platform.loading || saving}
            onCheckedChange={toggleAi}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4 text-slate-500" /> Security model
            </CardTitle>
            <CardDescription>How privileged actions are protected — enforced by the Firestore security rules, not just the UI.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Only a super admin can grant or revoke the administrator role; nobody can change their own role.</li>
            <li>Every role change is rejected unless it is written together with its audit-log entry.</li>
            <li>The audit log is append-only and only super admins can read it — entries can&apos;t be edited or deleted from the app.</li>
            <li>Staff can&apos;t forge another person&apos;s name or role on an audit entry.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function SuperAdminView() {
  const counts = usePlatformCounts();
  const total = counts ? counts.students + counts.instructors + counts.admins : null;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Badge tone="danger">
            <ShieldCheck className="size-3" /> Super Admin
          </Badge>
        }
        title="Platform control center"
        description="Oversee every administrator and instructor action, manage administrators and platform settings."
        actions={
          <Link href="/reports" className={cn("inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-surface px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50")}>
            <Activity className="size-4" /> Learner reports
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Users"
          value={total ?? "–"}
          hint={counts ? `${counts.students} students · ${counts.instructors} instructors` : undefined}
          icon={Users}
        />
        <StatCard label="Administrators" value={counts?.admins ?? "–"} icon={UserCog} tone="rose" />
        <StatCard label="Courses" value={counts?.courses ?? "–"} hint={counts ? `${counts.published} published` : undefined} icon={BookOpen} tone="emerald" />
        <StatCard label="Enrolments" value={counts?.enrollments ?? "–"} icon={GraduationCap} tone="violet" />
        <StatCard label="Staff actions (24h)" value={counts?.actions24h ?? "–"} icon={ScrollText} tone="amber" />
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">
            <ScrollText /> Audit log
          </TabsTrigger>
          <TabsTrigger value="admins">
            <UserCog /> Administrators
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 /> Platform settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audit">
          <AuditLogPanel />
        </TabsContent>
        <TabsContent value="admins">
          <AdministratorsPanel />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

