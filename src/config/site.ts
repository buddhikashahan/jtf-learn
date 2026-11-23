import {
  BarChart3,
  Bell,
  BookOpen,
  ShieldCheck,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Jinasena Training Foundation",
  shortName: "JTF Learn",
  description:
    "A modern learning platform for technical training — courses, assignments, live classes and progress tracking in one place.",
};

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: "main" | "learn" | "admin" | "account";
  roles?: Role[];
}

export const navGroupLabels: Record<NavItem["group"], string | null> = {
  main: null,
  learn: "Learning",
  admin: "Administration",
  account: "Account",
};

export function navFor(role: Role): NavItem[] {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "main" },
    { label: "Notifications", href: "/notifications", icon: Bell, group: "main" },
    { label: role === "student" ? "My Courses" : "Courses", href: "/courses", icon: BookOpen, group: "learn" },
    { label: "Assignments", href: "/assignments", icon: ClipboardList, group: "learn" },
    { label: "Live Classes", href: "/live", icon: Video, group: "learn" },
    { label: "Reports", href: "/reports", icon: BarChart3, group: "admin", roles: ["instructor", "admin", "superadmin"] },
    { label: "Users", href: "/admin/users", icon: Users, group: "admin", roles: ["admin", "superadmin"] },
    { label: "Super Admin", href: "/superadmin", icon: ShieldCheck, group: "admin", roles: ["superadmin"] },
    { label: "Settings", href: "/settings", icon: Settings, group: "account" },
  ];
  return items.filter((i) => !i.roles || i.roles.includes(role));
}

export const roleLabels: Record<Role, string> = {
  student: "Student",
  instructor: "Instructor",
  admin: "Administrator",
  superadmin: "Super Admin",
};

/** Validate a post-login redirect target to prevent open redirects. */
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
