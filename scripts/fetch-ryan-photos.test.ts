import { describe, expect, test } from "bun:test";
import {
  avatarUrlFromFx,
  findPhotoGaps,
  isHotlinkedPhoto,
  isLocalPhoto,
  xHandleOf,
} from "./fetch-ryan-photos.js";
import type { ParsedRyan } from "./parse-ryan-md.js";

function stub(partial: Partial<ParsedRyan> & Pick<ParsedRyan, "slug">): ParsedRyan {
  return {
    file: `${partial.slug}.md`,
    name: partial.slug,
    number: null,
    status: "published",
    short: "",
    title: "",
    photo: "",
    photoCredit: "",
    photoLicense: "",
    photoSource: "",
    birthDate: null,
    birthYearMin: null,
    birthYearMax: null,
    birthPlace: null,
    deathDate: null,
    website: "",
    leadSummary: "",
    bodyMd: "",
    occupations: [],
    clusters: [],
    knownFor: [],
    social: [],
    organizations: [],
    education: [],
    featuredOn: null,
    relationships: [],
    sources: [],
    ...partial,
  };
}

describe("avatarUrlFromFx", () => {
  test("swaps _normal for _400x400", () => {
    expect(
      avatarUrlFromFx("https://pbs.twimg.com/profile_images/1/abc_normal.jpg"),
    ).toBe("https://pbs.twimg.com/profile_images/1/abc_400x400.jpg");
  });
});

describe("photo path helpers", () => {
  test("detects local vs hotlink", () => {
    expect(isLocalPhoto("/images/ryans/ryan-holiday.jpg")).toBe(true);
    expect(isHotlinkedPhoto("https://upload.wikimedia.org/x.jpg")).toBe(true);
    expect(isLocalPhoto("")).toBe(false);
  });
});

describe("findPhotoGaps", () => {
  test("flags empty photo with X handle", () => {
    const gaps = findPhotoGaps([
      stub({
        slug: "ryan-x",
        social: [{ platform: "x", handle: "someone", url: "https://x.com/someone" }],
      }),
    ]);
    expect(gaps).toEqual([
      { slug: "ryan-x", reason: "x-without-photo", handle: "someone" },
    ]);
  });

  test("flags hotlinks", () => {
    const gaps = findPhotoGaps([
      stub({
        slug: "hot",
        photo: "https://upload.wikimedia.org/foo.jpg",
      }),
    ]);
    expect(gaps[0]?.reason).toBe("hotlink");
  });

  test("xHandleOf reads platform x", () => {
    expect(
      xHandleOf(
        stub({
          slug: "a",
          social: [{ platform: "x", handle: "@TypesFast", url: "" }],
        }),
      ),
    ).toBe("TypesFast");
  });
});
