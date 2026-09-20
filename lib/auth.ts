import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { authAttempts, sessions, users } from "@/db/schema";

const COOKIE_NAME = "schengen_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
// Cloudflare Workers caps a single PBKDF2 operation at 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000;

export type AuthUser = { id: string; email: string };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return {
    hash: bytesToBase64(await derivePassword(password, salt)),
    salt: bytesToBase64(salt),
  };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const actual = await derivePassword(password, base64ToBytes(salt));
  const expected = base64ToBytes(hash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") throw new Error("Enter a valid email address.");
  const email = value.trim().normalize("NFKC").toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function validatePassword(value: unknown) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw new Error("Password must be between 10 and 128 characters.");
  }
  return value;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function readCookie(request: Request) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const token = readCookie(request);
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const [row] = await getDb()
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, Date.now())))
    .limit(1);
  return row ?? null;
}

export async function createSession(userId: string, request: Request) {
  const tokenBytes = randomBytes(32);
  const token = bytesToBase64(tokenBytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const now = Date.now();
  await getDb().insert(sessions).values({
    tokenHash: await sha256(token),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
  });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export async function destroySession(request: Request) {
  const token = readCookie(request);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function reserveAuthAttempt(request: Request, email: string) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const key = await sha256(`${ip}|${email}`);
  const now = Date.now();
  const [row] = await getDb()
    .select()
    .from(authAttempts)
    .where(eq(authAttempts.key, key))
    .limit(1);

  if (!row || now - row.windowStartedAt >= RATE_WINDOW_MS) {
    await getDb()
      .insert(authAttempts)
      .values({ key, attempts: 1, windowStartedAt: now })
      .onConflictDoUpdate({
        target: authAttempts.key,
        set: { attempts: 1, windowStartedAt: now },
      });
    return { key, retryAfter: 0 };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { key, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - row.windowStartedAt)) / 1000) };
  }
  await getDb()
    .update(authAttempts)
    .set({ attempts: sql`${authAttempts.attempts} + 1` })
    .where(eq(authAttempts.key, key));
  return { key, retryAfter: 0 };
}

export async function clearAuthAttempts(key: string) {
  await getDb().delete(authAttempts).where(eq(authAttempts.key, key));
}

export function unauthorized() {
  return Response.json(
    { error: "Authentication required" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
