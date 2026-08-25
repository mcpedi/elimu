import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { canManageMarks, isAdministrative, requireRole } from "./permissions";

const principal: User = {
  id: 1,
  openId: "principal-open-id",
  name: "Principal",
  email: "principal@example.com",
  loginMethod: "manus",
  role: "principal",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const parent: User = { ...principal, id: 2, role: "parent" };

describe("school role authorization", () => {
  it("recognizes the leadership roles that have administrative scope", () => {
    expect(isAdministrative("super_admin")).toBe(true);
    expect(isAdministrative("principal")).toBe(true);
    expect(isAdministrative("teacher")).toBe(false);
  });

  it("permits only academic roles to enter marks", () => {
    expect(canManageMarks("teacher")).toBe(true);
    expect(canManageMarks("class_teacher")).toBe(true);
    expect(canManageMarks("parent")).toBe(false);
  });

  it("rejects a portal role from an administrative action", () => {
    expect(() => requireRole(parent, ["super_admin", "principal"])).toThrow(TRPCError);
    expect(() => requireRole(principal, ["super_admin", "principal"])).not.toThrow();
  });
});
