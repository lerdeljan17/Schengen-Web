import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userState } from "@/db/schema";
import { getAccessUser, unauthorized } from "@/lib/access";
import { parseData } from "@/lib/schengen";

const MAX_BODY_BYTES = 1_000_000;

export async function GET(request: Request) {
  const user = getAccessUser(request);
  if (!user) return unauthorized();

  const [row] = await getDb()
    .select({ data: userState.data, updatedAt: userState.updatedAt })
    .from(userState)
    .where(eq(userState.userId, user.id))
    .limit(1);

  return Response.json(
    row ? { data: parseData(JSON.parse(row.data)), updatedAt: row.updatedAt } : { data: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const user = getAccessUser(request);
  if (!user) return unauthorized();

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Data is too large" }, { status: 413 });
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Data is too large" }, { status: 413 });
    }

    const payload = JSON.parse(text) as { data?: unknown };
    const data = parseData(payload.data);
    const now = Date.now();

    await getDb()
      .insert(userState)
      .values({
        userId: user.id,
        email: user.email,
        data: JSON.stringify(data),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userState.userId,
        set: { email: user.email, data: JSON.stringify(data), updatedAt: now },
      });

    return Response.json(
      { ok: true, updatedAt: now },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid data" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
