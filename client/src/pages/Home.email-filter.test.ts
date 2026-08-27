import { describe, expect, it } from "vitest";
import { STUDENT_EMAIL_FILTER_OPTIONS } from "./Home";

describe("student email filters", () => {
  it("offers all, linked, and missing email states in stable order", () => {
    expect(STUDENT_EMAIL_FILTER_OPTIONS).toEqual([
      { value: "all", label: "All email statuses" },
      { value: "linked", label: "Has linked email" },
      { value: "missing", label: "No linked email" },
    ]);
  });
});
