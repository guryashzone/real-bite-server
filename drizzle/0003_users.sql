-- drizzle-kit quotes the custom citext type, which Postgres rejects, so it is unquoted here by hand.
-- Also adds the user_locations.user_id foreign key that 0000 left for this table (docs/12 §2.3).
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" citext NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"avatar_asset_id" uuid,
	"role" text DEFAULT 'user' NOT NULL,
	"theme_pref" text DEFAULT 'system' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user', 'moderator', 'admin')),
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active', 'suspended', 'deleted')),
	CONSTRAINT "users_theme_pref_check" CHECK ("users"."theme_pref" in ('system', 'light', 'dark'))
);
--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;