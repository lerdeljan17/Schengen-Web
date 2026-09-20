import { getDb } from "@/db";
import { appMetadata } from "@/db/schema";

export async function GET() {
  try {
    await getDb().select({ key: appMetadata.key }).from(appMetadata).limit(1);

    return Response.json(
      { status: "ok", database: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
