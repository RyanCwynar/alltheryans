import { createClient as createNodeClient, type Client } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { schema } from "./schema.js";

export type Db = LibSQLDatabase<typeof schema>;

export type LibsqlEnv = {
  LIBSQL_URL?: string;
  LIBSQL_AUTH_TOKEN?: string;
};

/**
 * Shared libSQL + Drizzle client for the read-only API and the single-writer CLI.
 * Credentials come from server env only — never ship tokens to the browser.
 *
 * Remote URLs use the fetch-based `/web` client (required on Vercel serverless).
 * Local `file:` URLs use the Node client.
 */
export function createDb(env: LibsqlEnv = {}): { db: Db; client: Client } {
  const url = (env.LIBSQL_URL ?? process.env.LIBSQL_URL)?.trim();
  if (!url) {
    throw new Error("LIBSQL_URL is required (e.g. https://alltheryans-db.byldr.co or file:./.data/local.db)");
  }
  const authToken = (env.LIBSQL_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN)?.trim() || undefined;
  // file: URLs do not need a token; remote libSQL does.
  if (!url.startsWith("file:") && !authToken) {
    throw new Error("LIBSQL_AUTH_TOKEN is required for remote LIBSQL_URL");
  }
  const client = url.startsWith("file:")
    ? createNodeClient({ url, authToken })
    : createWebClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { db, client };
}
