export type AccessUser = {
  id: string;
  email: string;
};

export function getAccessUser(request: Request): AccessUser | null {
  const id = request.headers.get("x-schengen-access-user-id");
  const email = request.headers.get("x-schengen-access-email");

  if (!id || !/^[a-f0-9]{64}$/.test(id) || !email || !email.includes("@")) {
    return null;
  }

  return { id, email };
}

export function unauthorized() {
  return Response.json(
    { error: "Authentication required" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
