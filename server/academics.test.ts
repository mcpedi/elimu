import { describe, expect, it } from "vitest";
import { calculateGrade, DEFAULT_KENYAN_GRADING_SCALE, summarizeMarks } from "./academics";

describe("Kenyan grading calculations", () => {
  it("converts a score to the configured Kenyan grade and grade points", () => {
    expect(calculateGrade(76, 100, DEFAULT_KENYAN_GRADING_SCALE)).toMatchObject({
      percentage: 76,
      grade: "A-",
      points: 11,
    });
  });

  it("normalizes scores when an assessment maximum is not 100", () => {
    expect(calculateGrade(35, 50, DEFAULT_KENYAN_GRADING_SCALE)).toMatchObject({
      percentage: 70,
      grade: "B+",
      points: 10,
    });
  });

  it("summarizes total marks, normalized average, and mean points", () => {
    expect(summarizeMarks([
      { score: 80, maxMarks: 100, points: 12 },
      { score: 30, maxMarks: 50, points: 8 },
    ])).toEqual({ total: 110, average: 70, meanPoints: 10 });
  });
});
