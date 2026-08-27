import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("AI retry answers", () => {
  it("renders a retry action only for failed assistant messages", async () => {
    const chat = await readFile(new URL("../components/AIChatBox.tsx", import.meta.url), "utf8");
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(chat).toContain("Retry answer");
    expect(chat).toContain("onRetryMessage");
    expect(home).toContain("isError: true");
  });

  it("removes the failed placeholder before resending the preserved context", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(home).toContain("messages.slice(0, index).filter(message => !message.isError)");
    expect(home).toContain("assistant.mutate({ conversationId: conversationId ?? undefined, messages: retryMessages })");
  });
});
