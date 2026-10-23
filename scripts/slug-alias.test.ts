import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  preferSlugMatch,
  slugLookupCandidates,
} from "../db/slug-alias.js";
import { loadRyanShareLocal } from "./load-ryan-share-local.js";
import {
  absoluteShareImage,
  applyRyanShareMeta,
  buildRyanShareMeta,
  SITE_ORIGIN_DEFAULT,
} from "../api/_lib/ryan-shell.js";
import { readFileSync } from "node:fs";

const root = join(import.meta.dir, "..");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");

describe("slugLookupCandidates", () => {
  test("ryan-hoover → [ryan-hoover, hoover]", () => {
    expect(slugLookupCandidates("ryan-hoover")).toEqual(["ryan-hoover", "hoover"]);
  });

  test("petersen → [petersen, ryan-petersen]", () => {
    expect(slugLookupCandidates("petersen")).toEqual(["petersen", "ryan-petersen"]);
  });

  test("exact canonical slugs stay first", () => {
    expect(slugLookupCandidates("hoover")[0]).toBe("hoover");
    expect(slugLookupCandidates("ryan-petersen")[0]).toBe("ryan-petersen");
  });
});

describe("preferSlugMatch", () => {
  test("prefers exact requested slug when both somehow match", () => {
    const rows = [
      { slug: "hoover", name: "A" },
      { slug: "ryan-hoover", name: "B" },
    ];
    expect(preferSlugMatch("ryan-hoover", rows)?.slug).toBe("ryan-hoover");
    expect(preferSlugMatch("hoover", rows)?.slug).toBe("hoover");
  });
});

describe("slug alias resolution (static data/api)", () => {
  test("/ryan/ryan-hoover resolves to hoover share meta + photo", async () => {
    const ryan = await loadRyanShareLocal("ryan-hoover", root);
    expect(ryan).not.toBeNull();
    expect(ryan!.slug).toBe("hoover");
    expect(ryan!.name).toBe("Ryan Hoover");
    expect(ryan!.photo).toBe("/images/ryans/ryan-hoover.jpg");

    const meta = buildRyanShareMeta(ryan!, SITE_ORIGIN_DEFAULT);
    expect(meta.canonicalUrl).toBe("https://alltheryans.com/ryan/hoover");
    expect(meta.imageUrl).toBe(
      "https://alltheryans.com/images/ryans/ryan-hoover.jpg",
    );
    expect(absoluteShareImage(ryan!.photo, SITE_ORIGIN_DEFAULT)).not.toContain(
      "og-default",
    );

    const html = applyRyanShareMeta(indexHtml, meta);
    expect(html).toContain("<title>Ryan Hoover — All The Ryans</title>");
    expect(html).toContain(
      'property="og:image" content="https://alltheryans.com/images/ryans/ryan-hoover.jpg"',
    );
    expect(html).not.toContain(
      'og:image" content="https://alltheryans.com/images/og-default.png"',
    );
    expect(html).not.toContain("That Ryan isn’t published");
  });

  test("/ryan/petersen resolves to ryan-petersen share meta", async () => {
    const ryan = await loadRyanShareLocal("petersen", root);
    expect(ryan).not.toBeNull();
    expect(ryan!.slug).toBe("ryan-petersen");
    expect(ryan!.name).toBe("Ryan Petersen");
    expect(ryan!.photo).toBe("/images/ryans/ryan-petersen.jpg");

    const meta = buildRyanShareMeta(ryan!, SITE_ORIGIN_DEFAULT);
    expect(meta.canonicalUrl).toBe(
      "https://alltheryans.com/ryan/ryan-petersen",
    );
    expect(meta.imageUrl).toBe(
      "https://alltheryans.com/images/ryans/ryan-petersen.jpg",
    );
  });
});
