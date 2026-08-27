import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("AI conversation history workspace", () => {
  it("exposes private history, resume, rename, and new-chat controls", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toContain("Chat history");
    expect(source).toContain("Only your conversations from this school appear here.");
    expect(source).toContain("New");
    expect(source).toContain("Save conversation title");
    expect(source).toContain("assistant.get.useQuery");
    expect(source).toContain("assistant.rename.useMutation");
  });

  it("keeps history endpoints scoped to the authenticated school and user", async () => {
    const source = await readFile(new URL("../../../server/routers.ts", import.meta.url), "utf8");
    expect(source).toContain("eq(aiConversations.schoolId, schoolId)");
    expect(source).toContain("eq(aiConversations.userId, ctx.user.id)");
    expect(source).toContain("eq(aiConversationMessages.userId, ctx.user.id)");
  });
});
