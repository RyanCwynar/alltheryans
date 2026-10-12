# All The Ryans — Page Format Spec (v2: encyclopedia pages)

Prior repo check: there's no "all-the-ryans" repo under github.com/RyanCwynar. The closest is the private `council-of-ryans` (Solidity, 2024), which looks unrelated. I didn't touch it.

## Concept
Each Ryan gets a full, Wikipedia-style reference page. **The page is neutral and encyclopedic.** The fun lives in the series framing ("Ryan #N", the Ryan web, clusters) and in the X posts, never in the page body.

## Length
About 1,500–3,000 words of body text, not counting frontmatter and references.

## File layout
One Markdown file per Ryan: `NN-<slug>.md`, made of:
1. **YAML frontmatter.** It's structured data, the source of truth for the infobox and the database. See "Frontmatter schema" below.
2. **Infobox.** It's rendered from the frontmatter. Coder renders it, so the Markdown doesn't repeat it.
3. **Lead summary.** 2–4 paragraphs: who they are, why they're notable, and the key dates. Every fact is cited.
4. **Sections, in this order:**
   - `## Early life and education`
   - `## Career`, with dated subsections (`### 2006–2013: ImportGenius`, and so on)
   - `## Notable work and achievements`
   - `## Public profile and social media`
   - `## Personal life`, with only facts the subject or a reputable outlet has made public. Omit the section if there are none.
   - `## Recognition`
   - `## See also`, linking to other Ryan slugs (cluster-mates and relationship targets)
   - `## References`, a numbered list

## Voice
Neutral, third person, past tense for completed events. No jokes, superlatives or editorializing ("legendary", "famously"). Criticism and controversy are covered only when a reputable source reports them, are attributed ("X said…", "critics argued…"), and get proportionate weight. No politics or identity commentary beyond what's needed to describe a public role.

## Citation rules (strict)
- Every factual sentence ends with at least one inline `[n]` cite to the **original source**: a news outlet, primary filing, company press release or official site. Wikipedia is never cited and may only be used to find sources.
- Every number, date, valuation, title and quote is cited. Quotes are verbatim from a source the writer actually read.
- Paywalled sources may only be cited for what is visible in the accessible text or an archived copy. Otherwise they're marked `UNVERIFIED` in the verification log and the claim is cut.
- When sources conflict (for example on round size), use the primary or most specific one and note the conflict in the verification log.
- Time-sensitive facts (valuation, title, headcount) use "as of <date>".
- Company announcements are attributed as claims ("Flexport said…").
- Each page ends with a **verification log** (an HTML comment so it doesn't render) listing every source as read, paywalled or unverified.

## Frontmatter schema
```yaml
slug: ryan-petersen            # unique, kebab-case
name: Ryan Petersen
number: 1                      # Ryan #N in the series
birth: { date: "1980/1981", date_precision: year-range, place: "Bethesda, Maryland, U.S.", cite: [n] }
death: null
education: [{ institution, degree, field, year, cite }]
occupations: [businessman, investor]
clusters: [founder, tech, logistics]     # tags; controlled vocabulary in schema.md
organizations: [{ name, role, start, end, cite }]
website: https://...
social: [{ platform: x, handle: typesfast, url }]
known_for: [...]
relationships: [{ target: <ryan-slug>, type: <controlled type>, note, cite: [n] }]
sources: [{ n, title, publisher, date, url, access: read|paywalled|archived }]
```
Relationship types (controlled): `co-starred-with`, `bandmate-of`, `teammate-of`, `rival-of`, `invested-in`, `co-founded-with`, `worked-with`, `same-school`, `same-hometown`, `same-company`, `married-to`, `related-to`, `thematic-link`. Every relationship needs a citation showing **both** ends of the link.
