import { describe, expect, test } from "bun:test";
import {
  applyStaticPhotoMap,
  mergeRyanWithStaticPhoto,
  photoMissing,
  withStaticPhoto,
} from "../api/_lib/static-photo.js";
import { resolveRyanShare } from "../api/_lib/load-ryan-share.js";
import {
  absoluteShareImage,
  applyRyanShareMeta,
  buildRyanShareMeta,
  SITE_ORIGIN_DEFAULT,
} from "../api/_lib/ryan-shell.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("photoMissing", () => {
  test("treats null/empty/whitespace as missing", () => {
    expect(photoMissing("")).toBe(true);
    expect(photoMissing(null)).toBe(true);
    expect(photoMissing(undefined)).toBe(true);
    expect(photoMissing("   ")).toBe(true);
    expect(photoMissing("/images/ryans/ryan-florence.jpg")).toBe(false);
  });
});

describe("withStaticPhoto / mergeRyanWithStaticPhoto", () => {
  test("DB photo empty + static JSON photo → uses static path", () => {
    const fromDb = {
      slug: "ryan-florence",
      name: "Ryan Florence",
      title: "Web developer; co-founder of Remix and React Training",
      short: "Co-creator of React Route",
      lead_summary: "**Ryan Florence** built React Router.",
      photo: "",
    };
    const fromStatic = {
      ...fromDb,
      photo: "/images/ryans/ryan-florence.jpg",
    };

    const merged = mergeRyanWithStaticPhoto(fromDb, fromStatic);
    expect(merged?.photo).toBe("/images/ryans/ryan-florence.jpg");

    // Same path used by loadRyanShare / resolveRyanShare
    expect(resolveRyanShare(fromDb, fromStatic)?.photo).toBe(
      "/images/ryans/ryan-florence.jpg",
    );

    const meta = buildRyanShareMeta(merged!, SITE_ORIGIN_DEFAULT);
    expect(meta.imageUrl).toBe(
      "https://alltheryans.com/images/ryans/ryan-florence.jpg",
    );
    expect(absoluteShareImage(merged!.photo, SITE_ORIGIN_DEFAULT)).toBe(
      "https://alltheryans.com/images/ryans/ryan-florence.jpg",
    );

    const html = applyRyanShareMeta(
      readFileSync(join(import.meta.dir, "..", "index.html"), "utf8"),
      meta,
    );
    expect(html).toContain(
      'property="og:image" content="https://alltheryans.com/images/ryans/ryan-florence.jpg"',
    );
    expect(html).toContain(
      'name="twitter:image" content="https://alltheryans.com/images/ryans/ryan-florence.jpg"',
    );
    expect(html).not.toContain(
      'property="og:image" content="https://alltheryans.com/images/og-default.png"',
    );
  });

  test("keeps DB photo when already set", () => {
    const fromDb = {
      slug: "ryan-florence",
      name: "Ryan Florence",
      photo: "/images/ryans/custom.jpg",
    };
    const fromStatic = {
      slug: "ryan-florence",
      name: "Ryan Florence",
      photo: "/images/ryans/ryan-florence.jpg",
    };
    expect(mergeRyanWithStaticPhoto(fromDb, fromStatic)?.photo).toBe(
      "/images/ryans/custom.jpg",
    );
  });

  test("applyStaticPhotoMap fills list gaps (API directory path)", () => {
    const map = new Map([
      ["ryan-florence", "/images/ryans/ryan-florence.jpg"],
      ["ryan-holiday", "/images/ryans/ryan-holiday.jpg"],
    ]);
    const list = applyStaticPhotoMap(
      [
        { slug: "ryan-florence", photo: "" },
        { slug: "ryan-holiday", photo: null },
        { slug: "gosling", photo: "/images/ryans/ryan-gosling.jpg" },
      ],
      map,
    );
    expect(list.map((r) => r.photo)).toEqual([
      "/images/ryans/ryan-florence.jpg",
      "/images/ryans/ryan-holiday.jpg",
      "/images/ryans/ryan-gosling.jpg",
    ]);
  });

  test("withStaticPhoto no-ops when static also empty (ryan-perry)", () => {
    expect(withStaticPhoto({ slug: "ryan-perry", photo: "" }, "").photo).toBe("");
  });
});
