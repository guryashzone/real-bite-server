-- Geography is three linked tables — countries -> states -> cities (docs/12 §2.1) — plus
-- user_locations, which records where a user is as context with a source and a confidence.
-- The first migration owns the extensions.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
-- drizzle-kit quotes custom column types ("geography(Point,4326)", "citext"), which Postgres
-- rejects, so they are unquoted here by hand.
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"state_id" uuid,
	"name" text NOT NULL,
	"slug" citext NOT NULL,
	"center" geography(Point,4326) NOT NULL,
	"timezone" text,
	"is_launched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_country_slug_key" UNIQUE("country_id","slug"),
	CONSTRAINT "cities_id_country_key" UNIQUE("id","country_id")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso2" char(2) NOT NULL,
	"iso3" char(3) NOT NULL,
	"name" text NOT NULL,
	"slug" citext NOT NULL,
	"phone_code" text,
	"currency" char(3),
	"center" geography(Point,4326),
	"is_launched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "countries_iso2_key" UNIQUE("iso2"),
	CONSTRAINT "countries_iso3_key" UNIQUE("iso3"),
	CONSTRAINT "countries_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"slug" citext NOT NULL,
	"kind" text DEFAULT 'state' NOT NULL,
	"center" geography(Point,4326),
	"is_launched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "states_country_slug_key" UNIQUE("country_id","slug"),
	CONSTRAINT "states_id_country_key" UNIQUE("id","country_id")
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"confidence" smallint NOT NULL,
	"country_id" uuid,
	"state_id" uuid,
	"city_id" uuid,
	"point" geography(Point,4326),
	"accuracy_m" integer,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_locations_user_kind_key" UNIQUE("user_id","kind"),
	CONSTRAINT "user_locations_kind_check" CHECK ("user_locations"."kind" in ('home', 'last_seen')),
	CONSTRAINT "user_locations_source_check" CHECK ("user_locations"."source" in ('device_precise', 'device_approximate', 'picked_city', 'picked_state', 'picked_country', 'screenshot', 'inferred_locale', 'inferred_ip')),
	CONSTRAINT "user_locations_confidence_check" CHECK ("user_locations"."confidence" between 0 and 100),
	CONSTRAINT "user_locations_has_signal" CHECK ("user_locations"."country_id" is not null or "user_locations"."state_id" is not null or "user_locations"."city_id" is not null or "user_locations"."point" is not null)
);
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_same_country" FOREIGN KEY ("state_id","country_id") REFERENCES "public"."states"("id","country_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_city_same_country" FOREIGN KEY ("city_id","country_id") REFERENCES "public"."cities"("id","country_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_state_same_country" FOREIGN KEY ("state_id","country_id") REFERENCES "public"."states"("id","country_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cities_country" ON "cities" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "cities_state" ON "cities" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "cities_name_trgm" ON "cities" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "countries_name_trgm" ON "countries" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "states_country" ON "states" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "states_name_trgm" ON "states" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_locations_user" ON "user_locations" USING btree ("user_id");--> statement-breakpoint
-- user_locations.user_id has no foreign key yet: the `users` table arrives with auth (docs/11 §3.1).
-- That migration adds:
--   ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fk"
--     FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
-- Nothing writes to this table before then.