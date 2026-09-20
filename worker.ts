import vinext from "vinext/server/fetch-handler";

const AUTHENTICATED_API_PATHS = new Set(["/api/session", "/api/data"]);
const EMAIL_HEADER = "x-schengen-access-email";
const USER_ID_HEADER = "x-schengen-access-user-id";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getAccessIdentity(request: Request, ctx: ExecutionContext) {
  if (ctx.access) {
    return (await ctx.access.getIdentity()) ?? null;
  }

  // Workers with Static Assets currently lose ctx.access at the internal asset
  // router. The Access-managed identity endpoint re-validates the application
  // cookie and gives the Worker the same trusted identity in that configuration.
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  const identityUrl = new URL("/cdn-cgi/access/get-identity", request.url);
  const response = await fetch(identityUrl, {
    headers: { cookie },
    redirect: "manual",
  });
  if (!response.ok) return null;

  return (await response.json()) as CloudflareAccessIdentity;
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (!AUTHENTICATED_API_PATHS.has(url.pathname)) {
      return vinext.fetch(request, env, ctx);
    }

    const headers = new Headers(request.headers);
    headers.delete(EMAIL_HEADER);
    headers.delete(USER_ID_HEADER);

    const identity = await getAccessIdentity(request, ctx);
    const email = identity?.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const stableIdentity = identity?.user_uuid?.trim() || email;
    headers.set(EMAIL_HEADER, email);
    headers.set(USER_ID_HEADER, await sha256(stableIdentity));

    return vinext.fetch(new Request(request, { headers }), env, ctx);
  },
} satisfies ExportedHandler;
