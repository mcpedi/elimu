import { describe, expect, it } from "vitest";

describe("Neon API credentials", () => {
  it("can read the authenticated project list without exposing the key", async () => {
    const apiKey = process.env.NEON_API_KEY;
    expect(apiKey, "NEON_API_KEY must be provided by the project secret manager").toBeTruthy();

    const response = await fetch("https://console.neon.tech/api/v2/projects?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { projects?: unknown };
    expect(Array.isArray(body.projects)).toBe(true);
  }, 20_000);
});
