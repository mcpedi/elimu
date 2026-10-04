import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";
import { and, eq, gt, or } from "drizzle-orm";
import { localAuthCredentials, localAuthSessions, users, type User } from "../drizzle/schema";
import { getDb } from "./db";
import { hashStudentSecret, verifyStudentSecret, STUDENT_LOGIN_LOCK_MS, STUDENT_LOGIN_MAX_ATTEMPTS } from "./student-auth";

export const LOCAL_SESSION_COOKIE = "elimubora_local_session";
export const LOCAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const LOCAL_SETUP_TTL_MS = 1000 * 60 * 60 * 24;

export function normalizeLocalUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function createLocalSetupCode() {
  return randomBytes(6).toString("hex").toUpperCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readLocalSessionToken(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const pair = cookieHeader.split(";").map(value => value.trim()).find(value => value.startsWith(`${LOCAL_SESSION_COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(LOCAL_SESSION_COOKIE.length + 1)) : undefined;
}

export async function createLocalSession(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database service is unavailable.");
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(localAuthSessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + LOCAL_SESSION_TTL_MS), lastSeenAt: now });
  return token;
}

export async function clearLocalSession(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(localAuthSessions).where(eq(localAuthSessions.tokenHash, hashToken(token)));
}

export async function authenticateLocalRequest(req: Request): Promise<User | null> {
  const token = readLocalSessionToken(req);
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ session: localAuthSessions, user: users }).from(localAuthSessions).innerJoin(users, eq(users.id, localAuthSessions.userId)).where(and(eq(localAuthSessions.tokenHash, hashToken(token)), gt(localAuthSessions.expiresAt, new Date()))).limit(1);
  const row = rows[0];
  if (!row || row.user.disabledAt) return null;
  await db.update(localAuthSessions).set({ lastSeenAt: new Date() }).where(eq(localAuthSessions.id, row.session.id));
  return row.user;
}

export async function issueLocalSetupCode(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database service is unavailable.");
  const code = createLocalSetupCode();
  const now = new Date();
  const setupCodeHash = await hashStudentSecret(code);
  const existing = (await db.select().from(localAuthCredentials).where(eq(localAuthCredentials.userId, userId)).limit(1))[0];
  if (existing) {
    await db.update(localAuthCredentials).set({ setupCodeHash, setupCodeExpiresAt: new Date(now.getTime() + LOCAL_SETUP_TTL_MS), failedAttempts: 0, lockedUntil: null, updatedAt: now }).where(eq(localAuthCredentials.userId, userId));
  } else {
    await db.insert(localAuthCredentials).values({ userId, username: `pending_${userId}`, setupCodeHash, setupCodeExpiresAt: new Date(now.getTime() + LOCAL_SETUP_TTL_MS) });
  }
  return { code, expiresAt: new Date(now.getTime() + LOCAL_SETUP_TTL_MS) };
}

export async function completeLocalSetup(input: { userId: number; setupCode: string; username: string; password: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database service is unavailable.");
  const username = normalizeLocalUsername(input.username);
  const credential = (await db.select().from(localAuthCredentials).where(eq(localAuthCredentials.userId, input.userId)).limit(1))[0];
  if (!credential?.setupCodeHash || !credential.setupCodeExpiresAt || credential.setupCodeExpiresAt.getTime() <= Date.now()) throw new Error("Setup code invalid or expired.");
  if (!(await verifyStudentSecret(input.setupCode.trim().toUpperCase(), credential.setupCodeHash))) throw new Error("Setup code invalid or expired.");
  const conflict = (await db.select().from(localAuthCredentials).where(and(eq(localAuthCredentials.username, username), eq(localAuthCredentials.userId, input.userId))).limit(1))[0];
  if (!conflict && (await db.select().from(localAuthCredentials).where(eq(localAuthCredentials.username, username)).limit(1))[0]) throw new Error("That username is already in use.");
  const passwordHash = await hashStudentSecret(input.password);
  await db.update(localAuthCredentials).set({ username, passwordHash, setupCodeHash: null, setupCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(localAuthCredentials.userId, input.userId));
  return { username };
}

export async function loginLocalUser(identifier: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database service is unavailable.");
  const normalized = normalizeLocalUsername(identifier);
  const rows = await db.select({ credential: localAuthCredentials, user: users }).from(localAuthCredentials).innerJoin(users, eq(users.id, localAuthCredentials.userId)).where(or(eq(localAuthCredentials.username, normalized), eq(users.email, identifier.trim().toLowerCase()))).limit(1);
  const row = rows[0];
  if (!row || row.user.disabledAt || !row.credential.passwordHash) return { ok: false as const, reason: "invalid" as const };
  if (row.credential.lockedUntil && row.credential.lockedUntil.getTime() > Date.now()) return { ok: false as const, reason: "locked" as const };
  if (!(await verifyStudentSecret(password, row.credential.passwordHash))) {
    const failedAttempts = Number(row.credential.failedAttempts ?? 0) + 1;
    const lockedUntil = failedAttempts >= STUDENT_LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + STUDENT_LOGIN_LOCK_MS) : null;
    await db.update(localAuthCredentials).set({ failedAttempts, lockedUntil, updatedAt: new Date() }).where(eq(localAuthCredentials.id, row.credential.id));
    return { ok: false as const, reason: lockedUntil ? "locked" as const : "invalid" as const };
  }
  const now = new Date();
  await db.update(localAuthCredentials).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now }).where(eq(localAuthCredentials.id, row.credential.id));
  await db.update(users).set({ lastSignedIn: now }).where(eq(users.id, row.user.id));
  return { ok: true as const, user: row.user };
}

export { hashStudentSecret, verifyStudentSecret, STUDENT_LOGIN_LOCK_MS, STUDENT_LOGIN_MAX_ATTEMPTS };
