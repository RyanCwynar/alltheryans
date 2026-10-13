#!/usr/bin/env bun
/**
 * Bundle browser deps into js/vendor/ (served same-origin, no CDN waterfall).
 * Versions come from package.json devDependencies. Commit the output.
 *
 *   bun run build:vendor
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");

const result = await Bun.build({
  entrypoints: [
    join(import.meta.dir, "vendor", "lit.js"),
    join(import.meta.dir, "vendor", "marked.js"),
    join(import.meta.dir, "vendor", "dompurify.js"),
  ],
  outdir: join(root, "js", "vendor"),
  naming: "[name].js",
  format: "esm",
  target: "browser",
  minify: true,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
for (const out of result.outputs) console.log(out.path.replace(`${root}/`, ""));
