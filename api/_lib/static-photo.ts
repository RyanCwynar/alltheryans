/**
 * When libSQL is behind committed data/api JSON (e.g. photos added in Markdown
 * but prod DB not re-seeded), fill empty `photo` from the static payload.
 *
 * Edge-safe: no node:* imports (fetch-only).
 */

export type WithPhoto = { slug: string; photo?: string | null };

export function photoMissing(photo: string | null | undefined): boolean {
  return photo == null || !String(photo).trim();
}

/** Prefer row.photo; if empty, use staticPhoto. */
export function withStaticPhoto<T extends WithPhoto>(
  ryan: T,
  staticPhoto: string | null | undefined,
): T {
  if (!photoMissing(ryan.photo)) return ryan;
  if (photoMissing(staticPhoto)) return ryan;
  return { ...ryan, photo: String(staticPhoto).trim() };
}

export function applyStaticPhotoMap<T extends WithPhoto>(
  list: T[],
  photos: Map<string, string>,
): T[] {
  return list.map((r) => withStaticPhoto(r, photos.get(r.slug)));
}

/** Pure merge used by share-card loader + tests. */
export function mergeRyanWithStaticPhoto<T extends WithPhoto>(
  fromDb: T | null,
  fromStatic: T | null,
): T | null {
  if (!fromDb) return fromStatic;
  if (!fromStatic) return fromDb;
  return withStaticPhoto(fromDb, fromStatic.photo);
}

type DirectoryPayload = {
  ryans?: Array<{ slug?: string; photo?: string | null }>;
};

let photoMapCache: { key: string; map: Map<string, string>; at: number } | null =
  null;
const PHOTO_MAP_TTL_MS = 60_000;

/** Load slug → photo from committed directory.json (CDN / same deployment). */
export async function loadStaticPhotoMap(
  origin: string | URL,
): Promise<Map<string, string>> {
  const base = typeof origin === "string" ? origin : origin.origin;
  const key = base.replace(/\/$/, "");
  const now = Date.now();
  if (
    photoMapCache &&
    photoMapCache.key === key &&
    now - photoMapCache.at < PHOTO_MAP_TTL_MS
  ) {
    return photoMapCache.map;
  }

  const res = await fetch(new URL("/data/api/directory.json", `${key}/`), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`directory.json HTTP ${res.status}`);
  }
  const data = (await res.json()) as DirectoryPayload;
  const map = new Map<string, string>();
  for (const r of data.ryans || []) {
    if (r.slug && !photoMissing(r.photo)) {
      map.set(r.slug, String(r.photo).trim());
    }
  }
  photoMapCache = { key, map, at: now };
  return map;
}

/** Enrich one Ryan / list from static photos; no-op on fetch failure. */
export async function enrichRyanPhoto<T extends WithPhoto>(
  ryan: T,
  origin: string | URL,
): Promise<T> {
  if (!photoMissing(ryan.photo)) return ryan;
  try {
    const map = await loadStaticPhotoMap(origin);
    return withStaticPhoto(ryan, map.get(ryan.slug));
  } catch (err) {
    console.error("enrichRyanPhoto:", err);
    return ryan;
  }
}

export async function enrichRyanPhotos<T extends WithPhoto>(
  list: T[],
  origin: string | URL,
): Promise<T[]> {
  if (!list.some((r) => photoMissing(r.photo))) return list;
  try {
    const map = await loadStaticPhotoMap(origin);
    return applyStaticPhotoMap(list, map);
  } catch (err) {
    console.error("enrichRyanPhotos:", err);
    return list;
  }
}

/** @internal test helper — clear in-memory cache between tests. */
export function clearStaticPhotoMapCache(): void {
  photoMapCache = null;
}
