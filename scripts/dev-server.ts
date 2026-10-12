#!/usr/bin/env bun
/**
 * Local static file server + read-only API (Bun).
 * Uses file:./.data/local.db by default — never touches prod.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../api/app.ts";

const root = join(import.meta.dir, "..");
const port = Number(process.env.PORT || 4173);

if (!process.env.LIBSQL_URL) {
  mkdirSync(join(root, ".data"), { recursive: true });
  process.env.LIBSQL_URL = `file:${join(root, ".data/local.db")}`;
}

const app = createApp();

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(req, process.env);
    }

    // SPA rewrites
    let pathname = url.pathname;
    if (/^\/ryan\/[^/]+\/?$/.test(pathname)) pathname = "/index.html";
    if (/^\/tag\/[^/]+\/?$/.test(pathname)) pathname = "/tag/index.html";

    const filePath = join(root, pathname === "/" ? "index.html" : pathname.slice(1));
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    // directory index
    const index = Bun.file(join(filePath, "index.html"));
    if (await index.exists()) return new Response(index);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`All The Ryans dev server at http://127.0.0.1:${server.port}`);
console.log(`LIBSQL_URL=${process.env.LIBSQL_URL}`);
