export function jsonString(value: unknown): string {
  return JSON.stringify(value ?? []);
}

export function jsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function tagLabel(slug: string): string {
  const known: Record<string, string> = {
    actor: "Actor Ryans",
    founder: "Founder Ryans",
    athlete: "Athlete Ryans",
    musician: "Musician Ryans",
    tech: "Tech Ryans",
    olympian: "Olympian Ryans",
    "sports-owner": "Sports-owner Ryans",
    historical: "Historical Ryans",
    investor: "Investor Ryans",
    logistics: "Logistics Ryans",
    film: "Film Ryans",
    director: "Director Ryans",
    "tv-host": "TV Host Ryans",
    media: "Media Ryans",
    engineer: "Engineer Ryans",
    creator: "Creator Ryans",
    youtube: "YouTube Ryans",
    business: "Business Ryans",
    boxer: "Boxer Ryans",
    baseball: "Baseball Ryans",
    hockey: "Hockey Ryans",
    producer: "Producer Ryans",
    motorsport: "Motorsport Ryans",
    football: "Football Ryans",
    "open-source": "Open-source Ryans",
  };
  return known[slug] ?? `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Ryans`;
}
