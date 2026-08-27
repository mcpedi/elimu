import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

describe("academic activity and audit detail UI", () => {
  it("renders subject and score-ceiling context in academic activity", () => {
    expect(source).toContain("item.subjectCode");
    expect(source).toContain("item.score} / {item.maxMarks}");
    expect(source).toContain("item.classForm");
  });

  it("makes audit entries inspectable with recorded metadata", () => {
    expect(source).toContain("Select to view recorded details");
    expect(source).toContain("Detailed information recorded for this school-scoped administrative action.");
    expect(source).toContain("JSON.stringify(readableMetadata ?? {}, null, 2)");
  });
});
