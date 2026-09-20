import { getSessionUser, sha256, unauthorized } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();

  return Response.json(
    { email: user.email, storageKey: (await sha256(user.id)).slice(0, 24) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
