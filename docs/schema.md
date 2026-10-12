# All The Ryans — Postgres schema proposal (for Next.js + Postgres)

Markdown pages with YAML frontmatter are the authoring format. A build or seed script upserts the frontmatter into Postgres. The page body stays in Markdown, or goes in `ryans.body_md`.

```sql
CREATE TABLE ryans (
  id            serial PRIMARY KEY,
  slug          text UNIQUE NOT NULL,            -- 'ryan-petersen'
  name          text NOT NULL,
  series_number int UNIQUE,                      -- Ryan #N
  birth_date    date,                            -- null if only year known
  birth_year_min int, birth_year_max int,        -- e.g. 1980..1981
  birth_place   text,
  death_date    date,
  website       text,
  lead_summary  text,
  body_md       text,
  occupations   text[] NOT NULL DEFAULT '{}',
  known_for     text[] NOT NULL DEFAULT '{}',
  social        jsonb NOT NULL DEFAULT '[]',     -- [{platform,handle,url}]
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published')),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tags (                               -- clusters: actor, founder, athlete...
  id    serial PRIMARY KEY,
  slug  text UNIQUE NOT NULL,
  label text NOT NULL,                            -- 'Actor Ryans'
  kind  text NOT NULL DEFAULT 'cluster' CHECK (kind IN ('cluster','field','era'))
);

CREATE TABLE ryan_tags (
  ryan_id int REFERENCES ryans(id) ON DELETE CASCADE,
  tag_id  int REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (ryan_id, tag_id)
);

CREATE TABLE organizations (
  id serial PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, url text
);

CREATE TABLE ryan_organizations (
  id serial PRIMARY KEY,
  ryan_id int REFERENCES ryans(id) ON DELETE CASCADE,
  organization_id int REFERENCES organizations(id),
  role text, start_year int, end_year int, note text
);

CREATE TABLE education (
  id serial PRIMARY KEY,
  ryan_id int REFERENCES ryans(id) ON DELETE CASCADE,
  institution text NOT NULL, degree text, field text, year int
);

CREATE TABLE relationships (                      -- the "Ryan web"
  id         serial PRIMARY KEY,
  source_id  int REFERENCES ryans(id) ON DELETE CASCADE,
  target_id  int REFERENCES ryans(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('co-starred-with','bandmate-of','teammate-of','rival-of',
              'invested-in','co-founded-with','worked-with','same-school','same-hometown',
              'same-company','married-to','related-to','thematic-link')),
  directed   boolean NOT NULL DEFAULT false,      -- invested-in = true; co-starred = false
  note       text,
  verified   boolean NOT NULL DEFAULT false,      -- true once both ends are cited
  CHECK (source_id <> target_id),
  UNIQUE (source_id, target_id, type)
);

CREATE TABLE sources (
  id          serial PRIMARY KEY,
  url         text UNIQUE NOT NULL,
  archive_url text,
  title       text, publisher text, author text,
  published_on date,
  access      text CHECK (access IN ('read','archived','search-snippet','paywalled','unverified')),
  checked_at  timestamptz
);

-- A citation attaches a source to a page footnote, an infobox field or a relationship.
CREATE TABLE citations (
  id              serial PRIMARY KEY,
  source_id       int REFERENCES sources(id) ON DELETE RESTRICT,
  ryan_id         int REFERENCES ryans(id) ON DELETE CASCADE,
  footnote_n      int,                             -- [n] on that page
  field           text,                            -- 'birth_place', 'organizations', or null for body
  relationship_id int REFERENCES relationships(id) ON DELETE CASCADE,
  quote           text,                            -- supporting excerpt, for audits
  UNIQUE (ryan_id, footnote_n)
);

CREATE INDEX ON ryan_tags (tag_id);
CREATE INDEX ON relationships (target_id);
CREATE INDEX ON ryans (birth_year_min);
```

## Queries the site needs
- **Cluster page** (for example Actor Ryans): `ryans JOIN ryan_tags JOIN tags WHERE tags.slug='actor' ORDER BY series_number | name | birth_year_min`.
- **Sort:** by series number, name, birth year or number of connections (a `COUNT` over relationships).
- **Ryan web graph:** nodes are `SELECT slug,name FROM ryans WHERE status='published'`. Edges come from `relationships WHERE verified`, and the cluster tags color the nodes. Expose it as `/api/ryan-web` JSON in `{nodes,links}` form for d3-force or react-force-graph.
- **Publish guard:** a page can't be set to `published` unless every footnote has a citation row whose source access is `read` or `archived`. Enforce this in the publish route or with a trigger.

## Seeding
`scripts/seed.ts` parses each `NN-<slug>.md` frontmatter and upserts, in order: ryans, tags, ryan_tags, organizations, education, sources, citations, then relationships. Relationships are created only when both slugs exist, otherwise they're queued.
