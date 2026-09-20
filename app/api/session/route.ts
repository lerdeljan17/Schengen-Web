import { getAccessUser, unauthorized } from "@/lib/access";

export async function GET(request: Request) {
  const user = getAccessUser(request);
  if (!user) return unauthorized();

  return Response.json(
    { email: user.email, storageKey: user.id.slice(0, 24) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
