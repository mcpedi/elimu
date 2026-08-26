import { describe, expect, it } from "vitest";
import { isValidStudentPhoto } from "./routers/mvp";

describe("learner profile photo validation", () => {
  it("accepts supported image formats within the 1 MB upload limit", () => {
    expect(isValidStudentPhoto("image/jpeg", 1)).toBe(true);
    expect(isValidStudentPhoto("image/png", 1_000_000)).toBe(true);
    expect(isValidStudentPhoto("image/webp", 750_000)).toBe(true);
  });

  it("rejects unsupported, empty, and oversized uploads before storage", () => {
    expect(isValidStudentPhoto("application/pdf", 200)).toBe(false);
    expect(isValidStudentPhoto("image/jpeg", 0)).toBe(false);
    expect(isValidStudentPhoto("image/png", 1_000_001)).toBe(false);
  });
});
