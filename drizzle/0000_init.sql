-- All The Ryans — libSQL/SQLite schema (from db/schema.ts / docs/schema.md)
-- Applied by scripts/migrate.ts. Do not run against prod from CI agents.

CREATE TABLE IF NOT EXISTS `ryans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`series_number` integer,
	`short` text,
	`title` text,
	`photo` text,
	`photo_credit` text,
	`photo_license` text,
	`birth_date` text,
	`birth_year_min` integer,
	`birth_year_max` integer,
	`birth_place` text,
	`death_date` text,
	`website` text,
	`lead_summary` text,
	`body_md` text,
	`occupations` text DEFAULT '[]' NOT NULL,
	`known_for` text DEFAULT '[]' NOT NULL,
	`social` text DEFAULT '[]' NOT NULL,
	`featured_on` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CHECK (`status` IN ('draft', 'approved', 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ryans_slug_uq` ON `ryans` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ryans_series_number_uq` ON `ryans` (`series_number`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ryans_status_idx` ON `ryans` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ryans_birth_year_min_idx` ON `ryans` (`birth_year_min`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ryans_featured_on_idx` ON `ryans` (`featured_on`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`kind` text DEFAULT 'cluster' NOT NULL,
	CHECK (`kind` IN ('cluster', 'field', 'era'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tags_slug_uq` ON `tags` (`slug`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ryan_tags` (
	`ryan_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`ryan_id`, `tag_id`),
	FOREIGN KEY (`ryan_id`) REFERENCES `ryans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ryan_tags_tag_id_idx` ON `ryan_tags` (`tag_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `organizations_slug_uq` ON `organizations` (`slug`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ryan_organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ryan_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`role` text,
	`start_year` integer,
	`end_year` integer,
	`note` text,
	FOREIGN KEY (`ryan_id`) REFERENCES `ryans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `education` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ryan_id` integer NOT NULL,
	`institution` text NOT NULL,
	`degree` text,
	`field` text,
	`year` integer,
	FOREIGN KEY (`ryan_id`) REFERENCES `ryans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`target_id` integer NOT NULL,
	`type` text NOT NULL,
	`directed` integer DEFAULT false NOT NULL,
	`note` text,
	`verified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `ryans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `ryans`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK (`source_id` <> `target_id`),
	CHECK (`type` IN (
		'co-starred-with','bandmate-of','teammate-of','rival-of','invested-in',
		'co-founded-with','worked-with','same-school','same-hometown','same-company',
		'married-to','related-to','thematic-link'
	))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `relationships_source_target_type_uq` ON `relationships` (`source_id`,`target_id`,`type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `relationships_target_id_idx` ON `relationships` (`target_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`archive_url` text,
	`title` text,
	`publisher` text,
	`author` text,
	`published_on` text,
	`access` text,
	`checked_at` text,
	CHECK (`access` IS NULL OR `access` IN ('read','archived','search-snippet','paywalled','unverified','read-via-fxtwitter'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `sources_url_uq` ON `sources` (`url`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `citations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`ryan_id` integer NOT NULL,
	`footnote_n` integer,
	`field` text,
	`relationship_id` integer,
	`quote` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ryan_id`) REFERENCES `ryans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `citations_ryan_footnote_uq` ON `citations` (`ryan_id`,`footnote_n`);
--> statement-breakpoint
-- Standalone FTS5 index (maintained by seed CLI; avoids content= sync issues on libSQL)
CREATE VIRTUAL TABLE IF NOT EXISTS `ryans_fts` USING fts5(
	slug,
	name,
	short,
	title,
	body_md,
	tokenize = 'porter'
);
