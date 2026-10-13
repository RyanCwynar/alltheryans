/**
 * Bump this after `bun run db:seed -- --apply` so browsers/CDN fetch fresh API
 * payloads (query param cache bust). Prefer Vercel CDN purge when a token is set
 * — see scripts/seed.ts and README.
 */
export const API_CACHE_VERSION = "1";
