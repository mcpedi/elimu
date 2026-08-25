import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

function scrypt(secret: string, salt: string, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(secret, salt, keyLength, options, (error, derived) => {
      if (error) return reject(error);
      resolve(derived as Buffer);
    });
  });
}
const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;

export const STUDENT_LOGIN_LOCK_MS = 15 * 60 * 1000;
export const STUDENT_LOGIN_MAX_ATTEMPTS = 5;

export function normalizeStudentIdentifier(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeStudentUsername(firstName: string, lastName: string, middleName?: string | null) {
  return [firstName, middleName, lastName].filter(value => Boolean(value?.trim())).join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeStudentUsernameInput(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function hashStudentSecret(secret: string) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scrypt(secret, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024,
  })) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString("hex")}`;
}

export async function verifyStudentSecret(secret: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [algorithm, nValue, rValue, pValue, salt, expectedHex] = encoded.split("$");
  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (algorithm !== "scrypt" || !Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || !salt || !expectedHex || expectedHex.length % 2 !== 0) return false;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const derived = (await scrypt(secret, salt, expected.length, { N: n, r, p, maxmem: 32 * 1024 * 1024 })) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
