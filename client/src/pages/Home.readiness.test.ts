import { describe, expect, it, vi } from "vitest";
import { chooseWorkspaceError, refetchWorkspace, shouldAttemptDashboard } from "./Home";

describe("workspace readiness", () => {
  it("keeps the dashboard request eligible when setup status is temporarily unavailable", () => {
    expect(shouldAttemptDashboard(undefined)).toBe(true);
    expect(shouldAttemptDashboard(true)).toBe(true);
    expect(shouldAttemptDashboard(false)).toBe(false);
  });

  it("prioritises a dashboard error while retaining the setup error as fallback", () => {
    const readinessError = new Error("setup status unavailable");
    const dashboardError = new Error("dashboard unavailable");
    expect(chooseWorkspaceError(readinessError, dashboardError)).toBe(dashboardError);
    expect(chooseWorkspaceError(readinessError, null)).toBe(readinessError);
  });

  it("refetches both readiness and dashboard data from the retry action", () => {
    const refetchReadiness = vi.fn();
    const refetchDashboard = vi.fn();
    refetchWorkspace(refetchReadiness, refetchDashboard);
    expect(refetchReadiness).toHaveBeenCalledOnce();
    expect(refetchDashboard).toHaveBeenCalledOnce();
  });
});
