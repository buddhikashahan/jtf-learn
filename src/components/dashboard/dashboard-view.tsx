"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { StudentDashboard } from "./student-dashboard";
import { StaffDashboard } from "./staff-dashboard";

export function DashboardView() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffDashboard /> : <StudentDashboard />;
}
