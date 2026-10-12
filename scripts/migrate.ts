#!/usr/bin/env bun
/**
 * Apply checked-in SQL migrations in drizzle/ to LIBSQL_URL.
 * Single-writer path — do not point this at prod unless Ryan asks.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDb } from "../db/client.js";

async function main() {
  const { client } = createDb();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      hash text NOT NULL UNIQUE,
      created_at text DEFAULT (datetime('now')) NOT NULL
    );
  `);

  const dir = join(import.meta.dir, "..", "drizzle");
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await client.execute("SELECT hash FROM __drizzle_migrations")).rows.map(
      (r) => String(r.hash),
    ),
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }
    const sql = await readFile(join(dir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`apply ${file} (${statements.length} statements)`);
    for (const statement of statements) {
      await client.execute(statement);
    }
    await client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash) VALUES (?)",
      args: [file],
    });
  }

  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
