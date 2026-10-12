/**
 * Fetch-based libSQL client for Vercel (Node or Edge). No Node-native deps.
 */
import { createClient, type Client } from "@libsql/client/web";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { schema } from "./schema.js";

export type Db = LibSQLDatabase<typeof schema>;

export function createDb(): { db: Db; client: Client } {
  const url = process.env.LIBSQL_URL?.trim();
  if (!url) {
    throw new Error("LIBSQL_URL is required");
  }
  if (url.startsWith("file:")) {
    throw new Error("Remote/web client cannot open file: URLs");
  }
  const authToken = process.env.LIBSQL_AUTH_TOKEN?.trim() || undefined;
  if (!authToken) {
    throw new Error("LIBSQL_AUTH_TOKEN is required for remote LIBSQL_URL");
  }
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { db, client };
}
