#!/usr/bin/env bun
/**
 * Self-host Ryan photos: download every remote `photo:` URL in ryans/*.md
 * into images/ryans/, then point the frontmatter at the local file.
 *
 * Wikimedia Commons photos also get `photo_credit` / `photo_license` filled
 * from the file's Commons metadata (attribution is required by CC BY / BY-SA).
 *
 * Default: dry-run (no downloads, no writes).
 * Apply:    bun run photos:fetch -- --apply
 *
 * Afterwards run `bun run db:seed -- --apply` so the DB picks up the new paths.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { slugify } from "../db/serialize.js";

const ROOT = join(import.meta.dir, "..");
const RYANS_DIR = join(ROOT, "ryans");
const IMAGES_DIR = join(ROOT, "images", "ryans");
const THUMB_WIDTH = 800;
// Wikimedia asks API clients to identify themselves.
const USER_AGENT = "AllTheRyansBot/1.0 (https://github.com/RyanCwynar/alltheryans)";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type Frontmatter = { raw: string; end: number };

function frontmatter(text: string): Frontmatter | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  return { raw: text.slice(0, end), end };
}

function field(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!m) return "";
  const v = m[1]!.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) {
    return v.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  return v;
}

/** Replace `key: ...` in the frontmatter, or append it after `after:`. */
export function setField(fm: string, key: string, value: string, after = "photo"): string {
  const line = `${key}: ${JSON.stringify(value)}`;
  const re = new RegExp(`^${key}:.*$`, "m");
  if (re.test(fm)) return fm.replace(re, line);
  return fm.replace(new RegExp(`^(${after}:.*)$`, "m"), `$1\n${line}`);
}

/** "File:Ryan_Cohen_2019_(cropped).jpg" from an upload.wikimedia.org URL, or null. */
export function commonsFileTitle(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "upload.wikimedia.org") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // /wikipedia/commons/thumb/a/ab/<File>/<size>-<File>  or  /wikipedia/commons/a/ab/<File>
  const i = parts.indexOf("thumb");
  const name = i !== -1 ? parts[i + 3] : parts[4];
  return name ? `File:${decodeURIComponent(name)}` : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type CommonsInfo = { url: string; credit: string; license: string; page: string };

async function commonsInfo(title: string): Promise<CommonsInfo> {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(THUMB_WIDTH),
    titles: title,
  }).toString();
  const res = await fetch(api, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status} for ${title}`);
  const data = (await res.json()) as any;
  const info = data?.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error(`No Commons imageinfo for ${title}`);
  const meta = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
    credit: stripHtml(meta.Artist?.value || ""),
    license: stripHtml(meta.LicenseShortName?.value || ""),
    page: info.descriptionurl || "",
  };
}

async function download(url: string): Promise<{ bytes: Uint8Array; ext: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = (res.headers.get("content-type") || "").split(";")[0]!.trim();
  const ext = EXT_BY_TYPE[type];
  // Guard against saving an HTML error page as a .jpg.
  if (!ext) throw new Error(`Not an image (${type || "no content-type"}) at ${url}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), ext };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const files = (await readdir(RYANS_DIR)).filter((f) => f.endsWith(".md")).sort();
  if (apply) await mkdir(IMAGES_DIR, { recursive: true });

  let changed = 0;
  let failed = 0;
  for (const file of files) {
    const path = join(RYANS_DIR, file);
    const text = await readFile(path, "utf8");
    const fm = frontmatter(text);
    if (!fm) continue;
    const photo = field(fm.raw, "photo");
    if (!/^https?:\/\//.test(photo)) continue;

    const name = field(fm.raw, "name") || file.replace(/\.md$/, "");
    const base = slugify(name);
    const title = commonsFileTitle(photo);

    if (!apply) {
      console.log(`WOULD FETCH ${file}: ${photo}${title ? ` (Commons ${title})` : ""}`);
      changed++;
      continue;
    }

    try {
      let src = photo;
      let credit = field(fm.raw, "photo_credit");
      let license = field(fm.raw, "photo_license");
      if (title) {
        const info = await commonsInfo(title);
        src = info.url;
        credit ||= info.credit ? `${info.credit} / Wikimedia Commons` : "Wikimedia Commons";
        license ||= info.license;
      }
      const { bytes, ext } = await download(src);
      const rel = `/images/ryans/${base}.${ext}`;
      await writeFile(join(ROOT, rel.slice(1)), bytes);

      let next = setField(fm.raw, "photo", rel);
      next = setField(next, "photo_credit", credit);
      next = setField(next, "photo_license", license, "photo_credit");
      await writeFile(path, next + text.slice(fm.end));
      console.log(`SAVED ${file} -> ${rel} (${bytes.length} bytes; ${credit} / ${license})`);
      changed++;
    } catch (err) {
      console.error(`FAILED ${file}: ${(err as Error).message}`);
      failed++;
    }
  }

  const verb = apply ? "Saved" : "Would fetch";
  console.log(`${verb} ${changed} photo(s)${failed ? `, ${failed} failed` : ""}.`);
  if (!apply && changed) console.log("Re-run with --apply to download and update frontmatter.");
  if (failed) process.exitCode = 1;
}

if (import.meta.main) await main();
