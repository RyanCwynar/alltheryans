import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  absoluteShareImage,
  applyRyanShareMeta,
  buildRyanShareMeta,
  plainDescription,
  SITE_ORIGIN_DEFAULT,
} from "../api/_lib/ryan-shell.js";

const indexHtml = readFileSync(join(import.meta.dir, "..", "index.html"), "utf8");

describe("plainDescription", () => {
  test("strips markdown and cites", () => {
    expect(plainDescription("**Ryan** is a [1] developer.")).toBe("Ryan is a developer.");
  });
});

describe("absoluteShareImage", () => {
  test("makes local jpg absolute", () => {
    expect(
      absoluteShareImage("/images/ryans/ryan-florence.jpg", SITE_ORIGIN_DEFAULT),
    ).toBe("https://alltheryans.com/images/ryans/ryan-florence.jpg");
  });

  test("rejects svg and empty", () => {
    expect(absoluteShareImage("/favicon.svg", SITE_ORIGIN_DEFAULT)).toBe(
      "https://alltheryans.com/images/og-default.png",
    );
    expect(absoluteShareImage("", SITE_ORIGIN_DEFAULT)).toBe(
      "https://alltheryans.com/images/og-default.png",
    );
  });
});

describe("applyRyanShareMeta", () => {
  test("injects per-Ryan head tags into index.html", () => {
    const meta = buildRyanShareMeta(
      {
        slug: "ryan-florence",
        name: "Ryan Florence",
        title: "Web developer; co-founder of Remix and React Training",
        short: "Co-creator of React Route",
        lead_summary:
          "**Ryan Florence** is an American web developer who created React Router [1].",
        photo: "/images/ryans/ryan-florence.jpg",
      },
      SITE_ORIGIN_DEFAULT,
    );
    const html = applyRyanShareMeta(indexHtml, meta);

    expect(html).toContain("<title>Ryan Florence — All The Ryans</title>");
    expect(html).toContain(
      'link rel="canonical" href="https://alltheryans.com/ryan/ryan-florence"',
    );
    expect(html).toContain(
      'property="og:url" content="https://alltheryans.com/ryan/ryan-florence"',
    );
    expect(html).toContain(
      'property="og:image" content="https://alltheryans.com/images/ryans/ryan-florence.jpg"',
    );
    expect(html).toContain(
      'name="twitter:image" content="https://alltheryans.com/images/ryans/ryan-florence.jpg"',
    );
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).not.toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:image:alt" content="Ryan Florence"');
    expect(html).toContain('name="twitter:image:alt" content="Ryan Florence"');
    expect(html).toContain("Web developer; co-founder of Remix and React Training");
    expect(html).toContain('src="/js/app.js"');
    // Homepage defaults must be gone
    expect(html).not.toContain('canonical" href="https://alltheryans.com/"');
    expect(html).not.toContain('og:image" content="https://alltheryans.com/images/og-default.png"');
  });

  test("homepage index.html keeps summary_large_image", () => {
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"');
  });
});
