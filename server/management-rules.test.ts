import { describe, expect, it } from "vitest";
import { assertEligibleClassTeacher, assertRecordRemovable, validateClassCapacity, validateNamedRecordUpdate } from "./management-rules";

describe("record-management safeguards", () => {
  it("permits removal only when a record has no dependent operational data", () => {
    expect(() => assertRecordRemovable("subject", { learnerAllocations: false, marks: false, timetables: false })).not.toThrow();
    expect(() => assertRecordRemovable("teacher", { classLeadership: true, marks: false })).toThrow("classLeadership");
  });

  it("accepts supported class capacities and rejects invalid values", () => {
    expect(() => validateClassCapacity(45)).not.toThrow();
    expect(() => validateClassCapacity(0)).toThrow("between 1 and 120");
    expect(() => validateClassCapacity(121)).toThrow("between 1 and 120");
    expect(() => validateClassCapacity(42.5)).toThrow("whole number");
  });

  it("validates teacher and subject update fields before changes are persisted", () => {
    expect(() => validateNamedRecordUpdate("subject", { code: "KIS", name: "Kiswahili" })).not.toThrow();
    expect(() => validateNamedRecordUpdate("teacher", { employeeNo: "", firstName: "Amina", lastName: "Otieno" })).toThrow("employeeNo");
  });

  it("permits only an active in-school teacher to be assigned as class teacher", () => {
    expect(() => assertEligibleClassTeacher(true)).not.toThrow();
    expect(() => assertEligibleClassTeacher(false)).toThrow("active teacher");
  });
});
