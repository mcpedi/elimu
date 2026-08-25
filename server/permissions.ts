import type { SchoolRole, User } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const administrativeRoles: SchoolRole[] = ["super_admin", "principal", "deputy_principal"];
export const academicRoles: SchoolRole[] = ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher"];
export const financeRoles: SchoolRole[] = ["super_admin", "principal", "bursar"];

export function requireRole(user: User | null | undefined, allowed: SchoolRole[]) {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in is required." });
  if (!allowed.includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your role is not permitted to perform this action." });
  }
}

export function isAdministrative(role: SchoolRole) {
  return administrativeRoles.includes(role);
}

export function canManageMarks(role: SchoolRole) {
  return academicRoles.includes(role);
}
