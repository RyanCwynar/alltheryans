#!/usr/bin/env bun
/**
 * Local static file server + read-only API (Bun).
 * Uses file:./.data/local.db by default — never touches prod.
 *
 * /ryan/:slug serves the SPA shell with per-Ryan OG/Twitter meta (same as
 * Vercel rewrite → api/ryan-page/[slug]).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../api/app.js";
import { loadRyanShareLocal } from "../api/_lib/load-ryan-share.js";
import {
  applyRyanShareMeta,
  buildRyanShareMeta,
  HTML_CACHE,
} from "../api/_lib/ryan-shell.js";

const root = join(import.meta.dir, "..");
const port = Number(process.env.PORT || 4173);

if (!process.env.LIBSQL_URL) {
  mkdirSync(join(root, ".data"), { recursive: true });
  process.env.LIBSQL_URL = `file:${join(root, ".data/local.db")}`;
}

const app = createApp();

async function ryanPageHtml(slug: string, origin: string): Promise<Response> {
  const index = await Bun.file(join(root, "index.html")).text();
  const ryan = await loadRyanShareLocal(slug, root);
  const html = applyRyanShareMeta(
    index,
    buildRyanShareMeta(
      ryan || {
        slug,
        name: "Ryan",
        title: "",
        short: "",
        lead_summary: "That Ryan isn’t published on All The Ryans.",
        photo: "",
      },
      origin,
    ),
  );
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": HTML_CACHE,
    },
  });
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      // Also allow hitting the HTML handler directly in local/dev.
      const pageMatch = url.pathname.match(/^\/api\/ryan-page\/([^/]+)\/?$/);
      if (pageMatch) {
        return ryanPageHtml(decodeURIComponent(pageMatch[1]), url.origin);
      }
      return app.fetch(req, process.env);
    }

    const ryanMatch = url.pathname.match(/^\/ryan\/([^/]+)\/?$/);
    if (ryanMatch) {
      return ryanPageHtml(decodeURIComponent(ryanMatch[1]), url.origin);
    }

    // SPA rewrites
    let pathname = url.pathname;
    if (/^\/tag\/[^/]+\/?$/.test(pathname)) pathname = "/tag/index.html";

    const filePath = join(root, pathname === "/" ? "index.html" : pathname.slice(1));
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, {
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
    }
    // directory index
    const index = Bun.file(join(filePath, "index.html"));
    if (await index.exists()) {
      return new Response(index, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`All The Ryans dev server at http://127.0.0.1:${server.port}`);
console.log(`LIBSQL_URL=${process.env.LIBSQL_URL}`);
