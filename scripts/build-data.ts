#!/usr/bin/env bun
/**
 * Build static JSON for the frontend from ryans/*.md — no remote DB.
 *
 * Loads the Markdown into a throwaway local libSQL file using the same
 * migrations + seed logic, then runs the shared read queries and writes the
 * results to data/api/. Commit the output; Vercel serves it from the CDN.
 *
 *   bun run build:data
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDb } from "../db/client.js";
import { getDirectory, getPublishedRyanBySlug, getRyanWeb, getTagPage } from "../db/queries.js";
import { migrate } from "./migrate.js";
import { applyParsedRyans, parseAllRyans } from "./seed.js";

const root = join(import.meta.dir, "..");
const outDir = join(root, "data", "api");
const tmpDir = join(root, ".data");
const dbPath = join(tmpDir, `build-${process.pid}.db`);

async function writeJson(relPath: string, data: unknown) {
  const file = join(outDir, relPath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  await mkdir(tmpDir, { recursive: true });
  const { db, client } = createDb({ LIBSQL_URL: `file:${dbPath}` });
  try {
    await migrate(client);
    await applyParsedRyans(db, client, await parseAllRyans());

    const directory = await getDirectory(db, { sort: "name" });
    const graph = await getRyanWeb(db);

    await rm(outDir, { recursive: true, force: true });
    await writeJson("directory.json", directory);
    await writeJson("ryan-web.json", graph);

    for (const { slug } of directory.ryans) {
      const ryan = await getPublishedRyanBySlug(db, slug);
      await writeJson(`ryans/${slug}.json`, { ryan });
    }
    for (const { slug } of directory.tags) {
      const page = await getTagPage(db, slug, "number");
      await writeJson(`tags/${slug}.json`, page);
    }

    console.log(
      `Wrote ${directory.ryans.length} Ryans, ${directory.tags.length} tags to data/api/`,
    );
  } finally {
    client.close();
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-journal`, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
