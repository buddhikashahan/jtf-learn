"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { StaffAssignments } from "./staff-assignments";
import { StudentAssignments } from "./student-assignments";

export function AssignmentsView() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffAssignments /> : <StudentAssignments />;
}
