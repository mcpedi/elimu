import { describe, expect, it, vi } from "vitest";
import { localAuthCredentials, localAuthSessions } from "../drizzle/schema";

const dbState = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => dbState.current) }));

import { createLocalSession, hashStudentSecret, LOCAL_SESSION_SHORT_TTL_MS, LOCAL_SESSION_TTL_MS, resetLocalPassword, verifyStudentSecret } from "./local-auth";

function fakeDb(credentials: any[], sessions: any[]) {
  const rowsFor = (table: unknown) => table === localAuthCredentials ? credentials : table === localAuthSessions ? sessions : [];
  return {
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => rowsFor(table) }) }) }),
    insert: () => ({ values: async (row: any) => { sessions.push(row); } }),
    update: (table: unknown) => ({ set: (values: any) => ({ where: () => {
      const apply = () => {
        const rows = rowsFor(table);
        rows.forEach(row => Object.assign(row, values));
        return rows.map(row => ({ id: row.id }));
      };
      return { returning: async () => apply(), then: (resolve: any, reject: any) => Promise.resolve().then(apply).then(resolve, reject) };
    } }) }),
    delete: (table: unknown) => ({ where: async () => { if (table === localAuthSessions) sessions.splice(0, sessions.length); } }),
  };
}

describe("local auth session persistence and password recovery", () => {
  it("uses a short default session and a 30-day session only when Remember Me is selected", async () => {
    const sessions: any[] = [];
    dbState.current = fakeDb([], sessions);
    const before = Date.now();
    await createLocalSession(11);
    const shortMs = sessions[0].expiresAt.getTime() - before;
    expect(shortMs).toBeGreaterThanOrEqual(LOCAL_SESSION_SHORT_TTL_MS - 1000);
    expect(shortMs).toBeLessThanOrEqual(LOCAL_SESSION_SHORT_TTL_MS + 1000);
    await createLocalSession(11, true);
    const longMs = sessions[1].expiresAt.getTime() - before;
    expect(longMs).toBeGreaterThanOrEqual(LOCAL_SESSION_TTL_MS - 1000);
    expect(longMs).toBeLessThanOrEqual(LOCAL_SESSION_TTL_MS + 1000);
  });

  it("consumes an administrator recovery code, changes the password, and revokes local sessions", async () => {
    const code = "AB12CD34EF56";
    const credentials = [{ id: 1, userId: 21, username: "teacher", passwordHash: await hashStudentSecret("OldPassword42!"), setupCodeHash: await hashStudentSecret(code), setupCodeExpiresAt: new Date(Date.now() + 60_000), failedAttempts: 0, lockedUntil: null }];
    const sessions = [{ id: 8, userId: 21, tokenHash: "token-hash", expiresAt: new Date(Date.now() + 60_000) }];
    dbState.current = fakeDb(credentials, sessions);
    const result = await resetLocalPassword({ userId: 21, setupCode: ` ${code.toLowerCase()} `, password: "NewPassword42!" });
    expect(result.success).toBe(true);
    expect(await verifyStudentSecret("NewPassword42!", credentials[0].passwordHash)).toBe(true);
    expect(credentials[0]).toMatchObject({ setupCodeHash: null, setupCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null });
    expect(sessions).toHaveLength(0);
  });

  it("increments the failed-code counter and rejects an invalid recovery code", async () => {
    const credentials = [{ id: 1, userId: 22, username: "teacher", passwordHash: await hashStudentSecret("OldPassword42!"), setupCodeHash: await hashStudentSecret("AB12CD34EF56"), setupCodeExpiresAt: new Date(Date.now() + 60_000), failedAttempts: 0, lockedUntil: null }];
    dbState.current = fakeDb(credentials, []);
    await expect(resetLocalPassword({ userId: 22, setupCode: "WRONGCODE1234", password: "NewPassword42!" })).rejects.toThrow("Recovery code invalid or expired.");
    expect(credentials[0].failedAttempts).toBe(1);
  });

  it("rejects expired codes without changing the password", async () => {
    const passwordHash = await hashStudentSecret("OldPassword42!");
    const credentials = [{ id: 1, userId: 23, username: "teacher", passwordHash, setupCodeHash: await hashStudentSecret("AB12CD34EF56"), setupCodeExpiresAt: new Date(Date.now() - 1000), failedAttempts: 0, lockedUntil: null }];
    dbState.current = fakeDb(credentials, []);
    await expect(resetLocalPassword({ userId: 23, setupCode: "AB12CD34EF56", password: "NewPassword42!" })).rejects.toThrow("Recovery code invalid or expired.");
    expect(credentials[0].passwordHash).toBe(passwordHash);
  });
});
