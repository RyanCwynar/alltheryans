import { defineConfig } from "drizzle-kit";

/**
 * Schema source of truth for drizzle-kit generate.
 * Runtime migrations use scripts/migrate.ts against LIBSQL_URL (never applied here).
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
