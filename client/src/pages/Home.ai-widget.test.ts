import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("AI landing widget reliability", () => {
  it("renders as a bottom-right fixed launcher with a compact mobile width", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toContain("fixed bottom-20 right-4");
    expect(source).toContain("w-[calc(100vw-2rem)]");
    expect(source).toContain("Ask AI");
  });

  it("does not render over the public login form before sign-in", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toContain("{user ? <AIAssistantWidget /> : null}");
  });

  it("keeps failed replies visible instead of adding a blank assistant message", async () => {
    const source = await readFile(new URL("../../../server/routers.ts", import.meta.url), "utf8");
    expect(source).toContain("The assistant could not produce an answer. Please try again.");
    expect(source).toContain("The previous response was empty");
    expect(source).toContain('finish_reason === "length"');
    expect(source).toContain("Please continue and finish the answer.");
  });
});
