import { describe, expect, it } from "vitest";

describe("site configuration", () => {
  it("retains the configured Elimubora360 application title", () => {
    expect(import.meta.env.VITE_APP_TITLE).toBe("Elimubora360");
  });
});
