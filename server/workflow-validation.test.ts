import { describe, expect, it } from "vitest";
import { summarizeAttendance } from "./attendance";
import { applyPayment } from "./fee-calculations";

describe("finance and attendance workflow validation", () => {
  it("updates paid amount, balance, and status after a valid fee payment", () => {
    expect(applyPayment(10_000, 7_500, 2_500)).toEqual({ newPaid: 10_000, balance: 0, status: "paid" });
    expect(applyPayment(10_000, 2_500, 1_000)).toEqual({ newPaid: 3_500, balance: 6_500, status: "partial" });
  });

  it("rejects zero or negative payment amounts", () => {
    expect(() => applyPayment(10_000, 0, 0)).toThrow("payment amount must be positive");
  });

  it("calculates attendance rate and flags a learner with repeated absences", () => {
    const summary = summarizeAttendance([
      { studentId: 1, status: "present" },
      { studentId: 1, status: "absent" },
      { studentId: 1, status: "absent" },
      { studentId: 1, status: "absent" },
      { studentId: 2, status: "late" },
    ]);
    expect(summary).toEqual({ rate: 40, absences: 3, repeatedAbsenceStudentIds: [1] });
  });
});
