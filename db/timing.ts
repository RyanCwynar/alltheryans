/**
 * Per-request query timing / counting for the read API.
 * Wrap each route with `withRouteTiming` so logs show DB vs total time.
 *
 * `dbMs` is wall-clock time with at least one query in flight (parallel-safe).
 */

export type QueryStats = {
  queries: number;
  dbMs: number;
  _inFlight: number;
  _busyStarted: number;
};

const unset: QueryStats = { queries: 0, dbMs: 0, _inFlight: 0, _busyStarted: 0 };
let active: QueryStats = unset;

/** Current request stats (mutated by the instrumented libSQL client). */
export function queryStats(): QueryStats {
  return active;
}

export function beginQuery(): void {
  if (active === unset) return;
  if (active._inFlight === 0) active._busyStarted = performance.now();
  active._inFlight += 1;
  active.queries += 1;
}

export function endQuery(): void {
  if (active === unset) return;
  active._inFlight = Math.max(0, active._inFlight - 1);
  if (active._inFlight === 0) {
    active.dbMs += performance.now() - active._busyStarted;
  }
}

/** @deprecated prefer beginQuery/endQuery for wall-clock DB time */
export function recordQuery(_durationMs: number): void {
  beginQuery();
  endQuery();
}

/**
 * Run a route handler and log `{ route, totalMs, dbMs, queries }`.
 * Resets stats for the duration of `run`.
 */
export async function withRouteTiming<T>(
  route: string,
  run: () => Promise<T>,
): Promise<T> {
  const prev = active;
  const stats: QueryStats = { queries: 0, dbMs: 0, _inFlight: 0, _busyStarted: 0 };
  active = stats;
  const t0 = performance.now();
  try {
    return await run();
  } finally {
    const totalMs = performance.now() - t0;
    console.log(
      JSON.stringify({
        route,
        totalMs: Math.round(totalMs),
        dbMs: Math.round(stats.dbMs),
        queries: stats.queries,
      }),
    );
    active = prev;
  }
}
