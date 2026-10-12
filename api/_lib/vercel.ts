import { getRequestListener } from "@hono/node-server";

export const nodeConfig = {
  runtime: "nodejs" as const,
};

/**
 * Vercel Node invokes (IncomingMessage, ServerResponse). Adapt a Web fetch
 * handler so Request/Response APIs work (and CORS headers.get is available).
 */
export function asVercelHandler(fetch: (request: Request) => Response | Promise<Response>) {
  return getRequestListener((request) => fetch(request));
}
