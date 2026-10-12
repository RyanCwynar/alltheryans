import { handle } from "hono/vercel";
import { createApp } from "./app.js";

export const config = {
  runtime: "nodejs",
};

const app = createApp();

export default handle(app);
