import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  clearAuthAttempts,
  createSession,
  hashPassword,
  isSameOrigin,
  normalizeEmail,
  reserveAuthAttempt,
  validatePassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as { email?: unknown; password?: unknown };
    const email = normalizeEmail(payload.email);
    const password = validatePassword(payload.password);
    const attempt = await reserveAuthAttempt(request, email);
    if (attempt.retryAfter) {
      return Response.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfter) } },
      );
    }

    const [existing] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return Response.json(
        { error: "An account already exists for this email." },
        { status: 409 },
      );
    }

    const id = crypto.randomUUID();
    const passwordData = await hashPassword(password);
    await getDb().insert(users).values({
      id,
      email,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      createdAt: Date.now(),
    });
    const cookie = await createSession(id, request);
    await clearAuthAttempts(attempt.key);

    return Response.json(
      { email },
      { status: 201, headers: { "Cache-Control": "no-store", "Set-Cookie": cookie } },
    );
  } catch (error) {
    const message = error instanceof Error && /^(Enter|Password)/.test(error.message)
      ? error.message
      : "Could not create account.";
    return Response.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
