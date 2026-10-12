import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { schema } from "./schema.ts";

export type Db = LibSQLDatabase<typeof schema>;

export type LibsqlEnv = {
  LIBSQL_URL?: string;
  LIBSQL_AUTH_TOKEN?: string;
};

/**
 * Shared libSQL + Drizzle client for the read-only API and the single-writer CLI.
 * Credentials come from server env only — never ship tokens to the browser.
 */
export function createDb(env: LibsqlEnv = {}): { db: Db; client: Client } {
  const url = env.LIBSQL_URL ?? process.env.LIBSQL_URL;
  if (!url) {
    throw new Error("LIBSQL_URL is required (e.g. https://alltheryans-db.byldr.co or file:./.data/local.db)");
  }
  const authToken = env.LIBSQL_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN;
  // file: URLs do not need a token; remote libSQL does.
  if (!url.startsWith("file:") && !authToken) {
    throw new Error("LIBSQL_AUTH_TOKEN is required for remote LIBSQL_URL");
  }
  const client = createClient({
    url,
    authToken: authToken || undefined,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}
