import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// The first migration gives deployments a harmless, non-personal D1 canary.
// Trip and passport data stay in the browser until proper user authentication
// and an explicit cloud-sync design are added.
export const appMetadata = sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
