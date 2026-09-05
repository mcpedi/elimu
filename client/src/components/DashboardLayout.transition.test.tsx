// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LayoutDashboard, Users } from "lucide-react";
import DashboardLayout from "./DashboardLayout";

const user = { id: 1, name: "Test Principal", email: "principal@test.school", role: "principal" as const };

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ loading: false, user, logout: vi.fn() }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("./LiveNotificationCenter", () => ({
  default: () => <button aria-label="Notifications">Notifications</button>,
}));

describe("mounted dashboard section transition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") ? false : false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderLayout = () => {
    function Harness() {
      const [activeId, setActiveId] = React.useState("overview");
      return <DashboardLayout navigation={[{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "students", label: "Students", icon: Users }]} activeId={activeId} onNavigate={setActiveId} title="Overview"><div>Workspace content</div></DashboardLayout>;
    }
    return render(<Harness />);
  };

  it("does not show on initial render, appears after a section change, then clears", () => {
    renderLayout();
    expect(screen.queryByLabelText("Loading Students")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /students/i })[0]);
    const transition = screen.getByLabelText("Loading Students");
    expect(transition).toBeTruthy();
    expect(transition.querySelector(".section-transition-card")?.classList.contains("pointer-events-none")).toBe(true);

    act(() => vi.advanceTimersByTime(259));
    expect(screen.getByLabelText("Loading Students")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByLabelText("Loading Students")).toBeNull();
  });

  it("suppresses the transient loader when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    renderLayout();
    fireEvent.click(screen.getAllByRole("button", { name: /students/i })[0]);
    expect(screen.queryByLabelText("Loading Students")).toBeNull();
  });
});
