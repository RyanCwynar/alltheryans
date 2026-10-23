/** Ordered unique candidates: exact slug first, then ryan- ↔ bare alias. */
export function slugLookupCandidates(slug) {
  const s = String(slug || "").trim();
  if (!s) return [];
  const out = [s];
  if (s.startsWith("ryan-")) {
    const rest = s.slice("ryan-".length);
    if (rest) out.push(rest);
  } else {
    out.push(`ryan-${s}`);
  }
  return [...new Set(out)];
}
