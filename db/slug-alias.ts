/**
 * Older Ryans use last-name slugs (`hoover`); newer ones use `ryan-<name>`
 * (`ryan-petersen`). Accept both shapes when looking up by URL slug.
 */

/** Ordered unique candidates: exact slug first, then ryan- ↔ bare alias. */
export function slugLookupCandidates(slug: string): string[] {
  const s = String(slug || "").trim();
  if (!s) return [];
  const out: string[] = [s];
  if (s.startsWith("ryan-")) {
    const rest = s.slice("ryan-".length);
    if (rest) out.push(rest);
  } else {
    out.push(`ryan-${s}`);
  }
  return [...new Set(out)];
}

/** Prefer an exact slug match when multiple candidates resolve. */
export function preferSlugMatch<T extends { slug: string }>(
  requested: string,
  rows: T[],
): T | null {
  if (!rows.length) return null;
  return rows.find((r) => r.slug === requested) ?? rows[0] ?? null;
}
