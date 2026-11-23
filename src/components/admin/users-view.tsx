"use client";

import { useMemo, useState } from "react";
import { limit, orderBy, query } from "firebase/firestore";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { useCollection } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import { setUserRole } from "@/lib/services/users";
import { roleLabels } from "@/config/site";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedTabsList, SegmentedTabsTrigger, Tabs } from "@/components/ui/tabs";
import { GraduationCap, Shield, UserCog } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Role, UserProfile, WithId } from "@/types";

const MAX_USERS = 500;

export function UsersView() {
  const me = useProfile();
  const q = useMemo(() => query(refs.users(), orderBy("createdAt", "desc"), limit(MAX_USERS)), []);
  const users = useCollection<UserProfile>(q);
  const [term, setTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [pending, setPending] = useState<{ user: WithId<UserProfile>; role: Role } | null>(null);

  const { isSuperAdmin } = useAuth();
  const counts = useMemo(() => {
    const c = { student: 0, instructor: 0, admin: 0 };
    users.data.forEach((u) => (c[u.role === "superadmin" ? "admin" : u.role] += 1));
    return c;
  }, [users.data]);
  // Admins manage students & instructors; only a super admin can grant or revoke admin.
  const assignable: Role[] = isSuperAdmin ? ["student", "instructor", "admin"] : ["student", "instructor"];

  const rows = users.data.filter(
    (u) =>
      (roleFilter === "all" || u.role === roleFilter || (roleFilter === "admin" && u.role === "superadmin")) &&
      (!term || `${u.displayName} ${u.email}`.toLowerCase().includes(term.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title="Users" description="Manage platform members and their roles." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={users.loading ? "–" : counts.student} icon={GraduationCap} />
        <StatCard label="Instructors" value={users.loading ? "–" : counts.instructor} icon={UserCog} tone="emerald" />
        <StatCard label="Administrators" value={users.loading ? "–" : counts.admin} icon={Shield} tone="rose" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SegmentedTabsList>
            <SegmentedTabsTrigger value="all">All</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="student">Students</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="instructor">Instructors</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="admin">Admins</SegmentedTabsTrigger>
          </SegmentedTabsList>
        </Tabs>
        <SearchInput value={term} onChange={setTerm} placeholder="Search by name or email" className="sm:w-72" />
      </div>

      {users.loading ? (
        <Skeleton className="h-72 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">User</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Joined</th>
                  <th className="w-48 px-5 py-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => {
                  const isMe = u.uid === me.uid;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.displayName} src={u.photoURL} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {u.displayName} {isMe && <Badge className="ml-1">You</Badge>}
                            </p>
                            <p className="truncate text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{u.phone || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3">
                        <Select
                          value={u.role}
                          disabled={isMe || !assignable.includes(u.role)}
                          title={
                            isMe
                              ? "You can't change your own role"
                              : !assignable.includes(u.role)
                                ? "Only a super admin can change this role"
                                : undefined
                          }
                          aria-label={`Role for ${u.displayName}`}
                          className="h-9"
                          onChange={(e) => setPending({ user: u, role: e.target.value as Role })}
                        >
                          {(Object.keys(roleLabels) as Role[])
                            .filter((r) => assignable.includes(r) || r === u.role)
                            .map((r) => (
                            <option key={r} value={r}>
                              {roleLabels[r]}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.data.length >= MAX_USERS && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Showing the {MAX_USERS} most recent users. Use search to narrow results.
            </p>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Change role to ${pending ? roleLabels[pending.role] : ""}?`}
        description={
          pending
            ? `${pending.user.displayName} will ${pending.role === "student" ? "lose staff permissions" : `gain ${roleLabels[pending.role].toLowerCase()} permissions`} immediately.`
            : ""
        }
        tone="primary"
        confirmLabel="Change role"
        onConfirm={async () => {
          if (!pending) return;
          await setUserRole(pending.user, pending.role, me);
          toast.success(`${pending.user.displayName} is now ${roleLabels[pending.role].toLowerCase()}`);
        }}
      />
    </div>
  );
}
