import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app.js";

export const config = {
  runtime: "nodejs",
};

/**
 * Vercel's Node runtime invokes (IncomingMessage, ServerResponse), not a Web
 * Request. hono/vercel's handle() only forwards to app.fetch(req), which breaks
 * CORS/header access (headers.get is not a function). Adapt with node-server.
 */
const app = createApp();

export default getRequestListener(app.fetch);
