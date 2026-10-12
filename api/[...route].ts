import { handle } from "hono/vercel";
import { createApp } from "./app.ts";

export const config = {
  runtime: "nodejs",
};

const app = createApp();

export default handle(app);
