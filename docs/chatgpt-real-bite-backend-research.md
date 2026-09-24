# Real Bite — Bootstrap Backend Research and v1 Design

## Recommendation

Start with **Supabase Pro in Mumbai** for the first production pilot, while keeping the application code and database portable. It removes the early operational burden of running authentication, PostgreSQL, backups, private object storage, and a CDN yourself. The MVP's main risk is the quality, rights, and moderation of the photo library—not AWS infrastructure.

Use a paid project for any live pilot. The free tier can pause after inactivity and does not include automatic backups. Move infrastructure components to AWS only when background work, image processing, traffic, compliance, or reliability requirements justify their complexity.

### What is portable from day one

| Concern | v1 choice | Portability rule | Later AWS equivalent |
|---|---|---|---|
| Database | Supabase PostgreSQL + PostGIS | Plain SQL migrations; no business logic hidden in dashboard-only features | RDS PostgreSQL / Aurora PostgreSQL |
| API | TypeScript HTTP API with thin Supabase wrappers | Domain logic is framework and provider independent | ECS/Fargate, Lambda, or App Runner |
| Authentication | Supabase Auth | Our own `users` and `auth_identities` tables; never use a provider user ID as the app's primary key | Cognito, Auth0, Clerk, etc. |
| File storage | Supabase Storage | Store `storage_provider`, `bucket`, and `object_key`; access only via a `MediaStorage` interface | S3 + CloudFront |
| Background work | Short function / scheduled job only | All jobs are idempotent records and handlers, not provider-specific events | SQS + EventBridge + worker |
| Moderation | Replaceable external service | `SafetyScanner` interface; provider response is normalised | Rekognition or another provider |

### Provider boundary

```text
apps/api
  modules/                  # catalog, photos, verification, credits, scans
  platform/
    auth.ts                 # AuthProvider interface
    media-storage.ts        # MediaStorage interface
    safety-scanner.ts       # SafetyScanner interface
    jobs.ts                 # JobQueue interface
    supabase/               # current adapters
    aws/                    # added only during migration
db/
  migrations/               # reviewed, plain PostgreSQL SQL
packages/shared/            # Zod request/response contracts and domain types
```

The mobile app calls only the versioned API and Supabase Auth. It never depends on Supabase table names, direct PostgREST calls, a service-role key, or storage paths. That means a migration swaps adapters and infrastructure rather than changing the app’s product logic.

## Product data model

### Rules

1. A menu item belongs to a **brand**, never an outlet.
2. An outlet exists for location, nearby search, photo evidence, and “this branch” ranking.
3. `outlet_id` on a photo is optional. It says where the photo was taken; it does not change whether the item exists or is available.
4. All IDs are application-owned UUIDs. Every table has `created_at`; mutable tables also have `updated_at`.

### Identity and catalogue

| Table | Columns | Purpose |
|---|---|---|
| `users` | `id PK`, `display_name`, `avatar_asset_id`, `role`, `home_city_id`, `theme_pref`, `deleted_at` | Canonical Real Bite user. |
| `auth_identities` | `id PK`, `user_id FK`, `provider`, `provider_subject`, `email`, `email_verified` | Maps a user to Supabase Auth now and another provider later. Unique on `(provider, provider_subject)`. |
| `consents` | `id PK`, `user_id FK`, `kind`, `version`, `granted_at`, `revoked_at` | Versioned Terms, Privacy, photo and location consent. |
| `cities` | `id PK`, `slug`, `name`, `state`, `country_code`, `center_location`, `is_active` | Launch cities. `center_location` is a PostGIS point. |
| `brands` | `id PK`, `slug`, `name`, `brand_type`, `logo_asset_id`, `cover_asset_id`, `accent_color`, `is_featured`, `status` | Domino's, Pizza Hut, or later independent places. |
| `outlets` | `id PK`, `brand_id FK`, `city_id FK`, `name`, `locality`, `address`, `location`, `external_place_id`, `status` | Physical branch; used for proximity and photo evidence only. |
| `item_categories` | `id PK`, `brand_id FK`, `name`, `sort_order` | Brand-level groups such as Pizza and Sides. |
| `items` | `id PK`, `brand_id FK`, `category_id FK`, `slug`, `name`, `description`, `attributes JSONB`, `status` | One brand menu item, e.g. Domino’s Margherita. No `outlet_id`. |
| `item_aliases` | `item_id FK`, `alias` | Alternative spellings for typo tolerance and screenshot matching. |

### Media, moderation, and community trust

| Table | Columns | Purpose |
|---|---|---|
| `media_assets` | `id PK`, `storage_provider`, `bucket`, `object_key`, `kind`, `mime_type`, `width`, `height`, `bytes`, `sha256`, `owner_user_id` | Portable record for a stored image. `object_key` replaces provider-specific URLs. |
| `photos` | `id PK`, `asset_id FK`, `item_id FK`, `outlet_id FK nullable`, `uploader_user_id FK nullable`, `source`, `rights_tier`, `license_ref`, `capture_mode`, `captured_at`, `capture_location private`, `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`, `is_cover` | A photo supports an item; optional outlet identifies the branch where it was taken. |
| `verification_tasks` | `id PK`, `photo_id FK`, `status`, `community_outcome`, `final_outcome`, `decided_by`, `vote_count`, `resolved_at` | Community review work created for pending uploads. |
| `verification_votes` | `id PK`, `task_id FK`, `voter_id FK`, `answer`, `suggested_item_id nullable`, `weight`, `matched_outcome` | One vote per user per task. Unique on `(task_id, voter_id)`. |
| `verifier_stats` | `user_id PK`, `votes`, `gold_seen`, `gold_correct`, `weight`, `calibrated_at` | Trust score for weighting community votes. |
| `photo_reports` | `id PK`, `photo_id FK`, `reporter_id FK`, `reason`, `note`, `status`, `resolved_by` | Copyright, privacy, offensive-content, and mismatch reports. |
| `audit_logs` | `id PK`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `metadata JSONB` | Append-only audit trail for admin and moderation actions. |

### Rewards and telemetry

| Table | Columns | Purpose |
|---|---|---|
| `credit_ledger` | `id PK`, `user_id FK`, `delta`, `reason`, `reference_type`, `reference_id`, `status`, `idempotency_key`, `expires_at` | Append-only Bites record. Balance is calculated, never directly edited. |
| `scans` | `id PK`, `user_id FK`, `entry`, `parser`, `detected_brand_id`, `detected_outlet_id nullable`, `candidates JSONB`, `selected_item_id`, `auto_opened` | Screenshot-matching quality data. Never store the screenshot or raw OCR text. |

### How photo evidence is calculated

The item page queries the brand-level `items` table, then ranks its approved photos:

1. `photos.outlet_id = viewed outlet` → **This outlet**.
2. Photo belongs to another outlet of the same brand in the same city → **Same brand, nearby outlet**.
3. Photo belongs to the same brand in another city → **Same item, other city**.
4. `photos.outlet_id IS NULL` and source is team/licensed → **Real Bite team photo**.
5. No approved photo → **No verified customer photo yet**.

An outlet never removes, overrides, or limits a Margherita from the Domino’s menu.

## API contract

All product endpoints are under `/api/v1` and accept a Supabase session JWT in v1. The endpoint names, request/response schemas, and business logic remain unchanged when the authentication provider changes.

| Area | Endpoint | Purpose |
|---|---|---|
| Session | Supabase SDK: sign up, password sign in, Google sign in, reset password | Authentication only; API creates or links a canonical `users` record on first session. |
| Profile | `GET /me` | Profile, consent state, Bites balance. |
| Profile | `PATCH /me` | Display name, city, and theme preference. |
| Profile | `POST /me/consents` | Add a consent record. |
| Profile | `DELETE /me` | Begin account deletion. |
| Home | `GET /home?lat=&lng=&city_id=` | Featured brands, nearby outlets, and upload call-to-action. |
| Search | `GET /search?q=&city_id=` | Fuzzy brand, outlet, and item search. |
| Brands | `GET /brands` and `GET /brands/:slug` | Brand list and brand-level menu. |
| Outlets | `GET /outlets/:id` | Outlet details plus the brand menu and ranked evidence photos. |
| Items | `GET /items/:id?outlet_id=` | One brand item and photo gallery ranked for an optional outlet. |
| Upload | `POST /uploads/init` | Checks consent, rate limit and quota; creates a staging asset and returns a short-lived upload target. |
| Upload | `PUT <signed-upload-url>` | Direct private image upload to the storage provider. |
| Upload | `POST /uploads/:assetId/complete` | Creates pending photo, requests safety scan, and opens a verification task. |
| Photos | `GET /me/photos` | User’s upload history. |
| Photos | `POST /photos/:id/helpful` | Record helpful feedback. |
| Photos | `POST /photos/:id/report` | Report a photo. |
| Verification | `GET /verification/next` | One task the user can review, excluding their own photos. |
| Verification | `POST /verification/:taskId/votes` | Submit one idempotent weighted vote. |
| Credits | `GET /credits` | Balance and cursor-paginated ledger. |
| Scan | `POST /scans/match` | Accept on-device extracted text, return match candidates, do not retain raw text. |
| Scan | `POST /scans/:id/select` | Record the user’s selected result. |
| Admin catalogue | `GET/POST/PATCH /admin/brands`, `/admin/outlets`, `/admin/categories`, `/admin/items` | Manage approved catalogue data. |
| Admin import | `POST /admin/imports/outlets`, `POST /admin/imports/menu` | Import manually checked CSV data. |
| Admin moderation | `GET /admin/moderation/photos` | Pending, escalated, and reported photo queue. |
| Admin moderation | `POST /admin/photos/:id/decision` | Atomically approve/reject photo, resolve task, write rewards, and audit. |
| Admin metrics | `GET /admin/metrics` | Upload, approval, verification, and coverage metrics. |

## Critical flows

### Browse an item

```text
App → GET /items/:id?outlet_id=...
API → query brand item + approved photos
API → rank photos using optional outlet and city
API → return photos with an evidence label
```

### Upload, verify, and reward

```text
App → POST /uploads/init → API validates user and returns signed target
App → PUT signed target → private object storage
App → POST /uploads/:assetId/complete → pending photo + safety scan
API → create verification task if safe; otherwise escalate
Verifier → GET /verification/next → POST vote
Admin → POST /admin/photos/:id/decision
API transaction → photo decision + task resolution + matching vote outcomes + Bites ledger rows + audit log
```

### Screenshot match

```text
Screenshot → OCR on device → POST /scans/match with extracted text
API → alias and trigram search against brand-level items
API → candidate list → app opens selected item with optional nearby outlet context
```

## Non-negotiable safety rules

- The mobile client never receives a database service key.
- Users cannot directly write `photos`, `verification_votes`, `credit_ledger`, roles, or moderation fields.
- Original photos, capture location, and uploader identity are private.
- Approval/rejection and Bites grants run in one transaction and use unique idempotency keys.
- Keep database migrations as SQL files in source control and back up both PostgreSQL and stored media before any provider migration.
