#!/usr/bin/env bun
/**
 * Fetch / check Ryan profile photos.
 *
 * Preference order (per docs/format-spec.md):
 *   1. Confirmed X handle → api.fxtwitter.com avatar (_normal → _400x400)
 *   2. Wikimedia Commons (manual; recorded via photo_source / credit / license)
 *   3. Clean initials placeholder (empty photo frontmatter)
 *
 * Images are stored under images/ryans/ — never hotlink.
 *
 *   bun run photos:check              # report gaps (exit 1 if X handle + no local photo)
 *   bun run photos:fetch              # download X avatars for gaps (no frontmatter writes)
 *   bun run photos:fetch -- --write   # also patch frontmatter photo / credit / license / source
 *   bun run photos:fetch -- --only=slug1,slug2 [--write]
 */
import { mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { parseRyanMarkdown, type ParsedRyan } from "./parse-ryan-md.js";

const root = join(import.meta.dir, "..");
const imagesDir = join(root, "images", "ryans");

async function loadAllRyans(): Promise<ParsedRyan[]> {
  const ryansDir = join(root, "ryans");
  const files = (await readdir(ryansDir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(ryansDir, f));
  const out: ParsedRyan[] = [];
  for (const file of files) out.push(await parseRyanMarkdown(file));
  return out;
}

export type PhotoArgs = {
  write: boolean;
  fetch: boolean;
  onlySlugs: string[] | null;
};

export function parsePhotoArgs(argv: string[] = process.argv): PhotoArgs {
  const write = argv.includes("--write");
  // "check" mode when invoked as photos:check (no --fetch) or explicit --check
  const fetch =
    argv.includes("--fetch") ||
    basename(argv[1] || "").includes("fetch-ryan-photos");
  const onlyArg = argv.find((a) => a === "--only" || a.startsWith("--only="));
  let onlySlugs: string[] | null = null;
  if (onlyArg) {
    const raw = onlyArg.startsWith("--only=")
      ? onlyArg.slice("--only=".length)
      : argv[argv.indexOf("--only") + 1] || "";
    onlySlugs = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return { write, fetch: write ? true : fetch, onlySlugs };
}

export function xHandleOf(ryan: ParsedRyan): string | null {
  const x = ryan.social.find((s) => s.platform === "x" || s.platform === "twitter");
  return x?.handle?.replace(/^@/, "") || null;
}

export function isLocalPhoto(photo: string): boolean {
  return Boolean(photo) && photo.startsWith("/images/");
}

export function isHotlinkedPhoto(photo: string): boolean {
  return /^https?:\/\//i.test(photo);
}

/** Absolute path on disk for a frontmatter photo value, or null. */
export function localPhotoPath(photo: string): string | null {
  if (!isLocalPhoto(photo)) return null;
  return join(root, photo.replace(/^\//, ""));
}

export type PhotoGap = {
  slug: string;
  reason: "empty" | "hotlink" | "missing-file" | "x-without-photo";
  handle: string | null;
};

/** Seed / CI check: every Ryan with an X handle should have a local photo file. */
export function findPhotoGaps(ryans: ParsedRyan[]): PhotoGap[] {
  const gaps: PhotoGap[] = [];
  for (const r of ryans) {
    const handle = xHandleOf(r);
    if (!r.photo || !r.photo.trim()) {
      gaps.push({
        slug: r.slug,
        reason: handle ? "x-without-photo" : "empty",
        handle,
      });
      continue;
    }
    if (isHotlinkedPhoto(r.photo)) {
      gaps.push({ slug: r.slug, reason: "hotlink", handle });
      continue;
    }
    // File existence checked async in main
  }
  return gaps;
}

export async function findMissingPhotoFiles(ryans: ParsedRyan[]): Promise<PhotoGap[]> {
  const missing: PhotoGap[] = [];
  for (const r of ryans) {
    const path = localPhotoPath(r.photo);
    if (!path) continue;
    try {
      await access(path);
    } catch {
      missing.push({
        slug: r.slug,
        reason: "missing-file",
        handle: xHandleOf(r),
      });
    }
  }
  return missing;
}

function imageFilenameFor(slug: string): string {
  if (slug === "matt") return "matt-ryan.jpg";
  if (slug.startsWith("ryan-") || slug === "ryangrowthh") return `${slug}.jpg`;
  return `ryan-${slug}.jpg`;
}

export function avatarUrlFromFx(avatarUrl: string): string {
  return avatarUrl.replace("_normal", "_400x400");
}

export async function fetchFxAvatar(handle: string): Promise<{
  handle: string;
  avatarUrl: string;
  bytes: Uint8Array;
  ext: ".jpg" | ".png" | ".webp";
}> {
  const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(handle)}`);
  if (!res.ok) {
    throw new Error(`fxtwitter HTTP ${res.status} for @${handle}`);
  }
  const data = (await res.json()) as {
    user?: { screen_name?: string; avatar_url?: string };
  };
  const avatar = data.user?.avatar_url;
  if (!avatar) throw new Error(`no avatar_url for @${handle}`);
  const url = avatarUrlFromFx(avatar);
  const img = await fetch(url, {
    headers: { "User-Agent": "AllTheRyansPhotoBot/1.0" },
  });
  if (!img.ok) throw new Error(`avatar HTTP ${img.status} for @${handle}: ${url}`);
  const bytes = new Uint8Array(await img.arrayBuffer());
  if (bytes.length < 500) throw new Error(`avatar too small for @${handle}`);
  const ctype = img.headers.get("content-type") || "";
  let ext: ".jpg" | ".png" | ".webp" = ".jpg";
  if (ctype.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50)) ext = ".png";
  else if (ctype.includes("webp")) ext = ".webp";
  return {
    handle: data.user?.screen_name || handle,
    avatarUrl: url,
    bytes,
    ext,
  };
}

function patchFrontmatter(
  raw: string,
  fields: Record<string, string>,
): string {
  if (!raw.startsWith("---")) throw new Error("missing frontmatter");
  const end = raw.indexOf("\n---", 3);
  if (end === -1) throw new Error("unclosed frontmatter");
  let fm = raw.slice(4, end);
  const body = raw.slice(end + 4); // starts with \n
  for (const [key, value] of Object.entries(fields)) {
    const quoted = JSON.stringify(value);
    const re = new RegExp(`^${key}:\\s*.*$`, "m");
    if (re.test(fm)) {
      fm = fm.replace(re, `${key}: ${quoted}`);
    } else if (key === "photo_source") {
      fm = fm.replace(
        /^(photo_license:\s*.*)$/m,
        `$1\nphoto_source: ${quoted}`,
      );
    } else {
      throw new Error(`frontmatter missing ${key}`);
    }
  }
  return `---\n${fm.trimStart()}\n---${body}`;
}

async function writeAvatarForRyan(
  ryan: ParsedRyan,
  opts: { writeFm: boolean },
): Promise<string> {
  const handle = xHandleOf(ryan);
  if (!handle) throw new Error(`${ryan.slug}: no X handle`);
  const avatar = await fetchFxAvatar(handle);
  await mkdir(imagesDir, { recursive: true });
  const base = imageFilenameFor(ryan.slug).replace(/\.jpg$/, avatar.ext);
  const dest = join(imagesDir, base);
  await writeFile(dest, avatar.bytes);
  const publicPath = `/images/ryans/${base}`;
  if (opts.writeFm) {
    const mdPath = join(root, "ryans", ryan.file.includes("/") ? basename(ryan.file) : ryan.file);
    // parsed.file is absolute path from parseRyanMarkdown
    const filePath = ryan.file.startsWith("/") ? ryan.file : mdPath;
    const raw = await readFile(filePath, "utf8");
    const next = patchFrontmatter(raw, {
      photo: publicPath,
      photo_credit: `X profile photo of @${avatar.handle}`,
      photo_license: "public profile photo",
      photo_source: `https://x.com/${avatar.handle}`,
    });
    await writeFile(filePath, next);
  }
  return publicPath;
}

async function main() {
  const argv = process.argv;
  const checkOnly =
    argv.includes("--check") ||
    process.env.npm_lifecycle_event === "photos:check";
  const write = argv.includes("--write");
  const doFetch = write || argv.includes("--fetch") || !checkOnly;
  const onlyArg = argv.find((a) => a === "--only" || a.startsWith("--only="));
  let onlySlugs: string[] | null = null;
  if (onlyArg) {
    const raw = onlyArg.startsWith("--only=")
      ? onlyArg.slice("--only=".length)
      : argv[argv.indexOf("--only") + 1] || "";
    onlySlugs = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  let ryans = await loadAllRyans();
  if (onlySlugs) {
    const set = new Set(onlySlugs);
    ryans = ryans.filter((r) => set.has(r.slug));
  }

  const gaps = findPhotoGaps(ryans);
  const missingFiles = await findMissingPhotoFiles(ryans);
  const allGaps = [...gaps, ...missingFiles];

  const needsXFetch = allGaps.filter(
    (g) =>
      g.handle &&
      (g.reason === "empty" ||
        g.reason === "x-without-photo" ||
        g.reason === "hotlink" ||
        g.reason === "missing-file"),
  );

  console.log(`Checked ${ryans.length} Ryan(s). Gaps: ${allGaps.length}.`);
  for (const g of allGaps) {
    console.log(
      `  ${g.slug}: ${g.reason}${g.handle ? ` (@${g.handle})` : ""}`,
    );
  }

  if (checkOnly || !doFetch) {
    const blocking = allGaps.filter(
      (g) => g.reason === "x-without-photo" || g.reason === "hotlink" || g.reason === "missing-file",
    );
    if (blocking.length) {
      console.log("");
      console.log(
        "Fix with: bun run photos:fetch -- --write   (X avatars) or add a Commons image under images/ryans/.",
      );
      process.exit(1);
    }
    const placeholders = allGaps.filter((g) => g.reason === "empty" && !g.handle);
    if (placeholders.length) {
      console.log("");
      console.log(
        `Placeholder only (no X handle): ${placeholders.map((p) => p.slug).join(", ")}`,
      );
    }
    console.log("Photo check OK.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const g of needsXFetch) {
    const ryan = ryans.find((r) => r.slug === g.slug)!;
    if (!g.handle) continue;
    try {
      const path = await writeAvatarForRyan(ryan, { writeFm: write });
      console.log(`fetched @${g.handle} → ${path}${write ? " (frontmatter updated)" : ""}`);
      ok++;
    } catch (err) {
      console.error(`FAIL ${g.slug} @${g.handle}: ${(err as Error).message}`);
      fail++;
    }
  }

  console.log(`Done. fetched=${ok} failed=${fail}`);
  if (fail) process.exit(1);
  if (!write && ok) {
    console.log("Re-run with --write to patch frontmatter, then bun run build:data.");
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
