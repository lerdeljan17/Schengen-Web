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
  verifyPassword,
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

    const [user] = await getDb()
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        passwordSalt: users.passwordSalt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    let valid = false;
    if (user) valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    else await hashPassword(password);
    if (!user || !valid) {
      return Response.json(
        { error: "Email or password is incorrect." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const cookie = await createSession(user.id, request);
    await clearAuthAttempts(attempt.key);
    return Response.json(
      { email },
      { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie } },
    );
  } catch (error) {
    const message = error instanceof Error && /^(Enter|Password)/.test(error.message)
      ? error.message
      : "Could not sign in.";
    return Response.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
