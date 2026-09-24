# 12: Geography as relevance, not as a boundary — proposal

> **Status: accepted (22 Sep 2026); specs updated; server phases 1–3 built.** [00](00-mvp-v1-spec.md), [11](11-backend-mvp1.md), [02](02-architecture.md), [03](03-rights-and-sources.md), [05](05-scan-and-overlay.md) and [09](09-roadmap-gates-metrics-team.md) now describe this model. This doc holds the reasoning, the tier scores and the migration plan; they hold the schema, API and screens.
>
> **Code status.** Server phases 1–3 are built and applied locally (§10): tables, India seed and the read endpoints. The app's picker is done — `screens/area-picker` replaced `screens/city-picker` (every area selectable, skip allowed); it still reads `PLACEHOLDER_AREAS` and needs switching to `GET /v1/geo/search`. On the **server**, an earlier single-table `geo_areas` attempt was **removed**; `0000_init_geo.sql` holds the three-table design plus `user_locations`, `0001_seed_india.sql` the seed, and `src/geo/` the endpoints. Nothing was ever released, so there is no backfill and no alias to keep.

> **Principle:** *geography should improve relevance, not restrict discovery.* A search must never return "nothing" because the user's city has no photos.

## 1. What is city-bound today

City isn't a light assumption in the current spec — it is the spine. Every row below is a real place it would block going global.

| # | Where | What it does today | Category |
|---|---|---|---|
| 1 | `cities` table ([11 §3.2](11-backend-mvp1.md), `drizzle/0000_init_cities.sql`) | `serial` PK, `country char(2) default 'IN'`, flat list with no hierarchy. Already **built and migrated** | Schema |
| 2 | `outlets.city_id` **not null** ([11 §3.2](11-backend-mvp1.md)) | An outlet cannot exist without a city we've catalogued. A Mumbai outlet seen only in a screenshot can't be recorded | Required field |
| 3 | `outlets.location` **not null** | An outlet known by name but not coordinates can't be stored | Required field |
| 4 | `users.home_city_id` ([11 §3.1](11-backend-mvp1.md)) | Single city per user. No home-vs-current distinction, so a traveller stays pinned to Bengaluru | Onboarding + personalization |
| 5 | Evidence labels ([00 §3 query](00-mvp-v1-spec.md), lines 316–320) | `po.city_id = $city` → "Same brand, nearby"; anything else → "Same item, other city". **Country doesn't exist as a concept** | Ranking |
| 6 | `GET /v1/home?cityId=`, `/brands/:slug?cityId=`, `/outlets?cityId=`, `/search?cityId=`, `POST /v1/scans {cityId}` ([11 §4](11-backend-mvp1.md)) | `cityId` is the geographic vocabulary of the whole API | API |
| 7 | `GET /v1/items/:id/photos?scope=outlet\|all` | Two settings only: this outlet, or everything. No country tier in between | API + ranking |
| 8 | `outlets_city_brand` index `(city_id, brand_id)` | The only catalogue access path is city-first | Indexing |
| 9 | ~~`cities.is_active` + "Coming soon" list~~ — **fixed in the app**: every area is selectable, coverage is a badge, and the subtitle says what an un-launched area returns | Un-launched cities were unreachable, not merely un-curated | Discovery constraint |
| 10 | Onboarding ([00 §4.3](00-mvp-v1-spec.md), `screens/location`, `screens/area-picker`) — **fixed in the app**: "Skip for now" on both screens | Precise location **or** pick a city, with no country-only or global path; the user had to choose something | Onboarding dependency |
| 11 | `GET /v1/cities` (built: `cities.controller.ts`) | The app's only geography endpoint | API |
| 12 | Home "Outlets near you" / "Outlets in {city}" ([00 §4.3](00-mvp-v1-spec.md)) | Two modes, both city-terminal | Product |
| 13 | Scan matching ([05](05-scan-and-overlay.md)) | Outlet resolution = locality text **within the selected city** | Screenshot flow |
| 14 | Caching (implied) | Any cache would naturally key on `cityId`, which fragments per city and can't serve country or global tiers | Caching |

**Not yet a problem, and worth saying:** the catalogue is *already* global in the right way. `brands` and `items` are brand-scoped with no city or country column, so "Domino's Margherita" is one row today. The fix is therefore additive — we are not un-duplicating anything.

**Also fine as-is:** `photos.brand_id`/`item_id` composite FKs, the append-only ledger, verification, and auth. This proposal doesn't touch them.

## 2. The model

### 2.1 Three linked tables: countries → states → cities

The hierarchy is a **fixed depth**, so each level is its own table with its own columns and a plain parent foreign key. No polymorphic `kind` column, no `ltree` path, no self-join.

```sql
create table countries (
  id          uuid primary key default gen_random_uuid(),
  iso2        char(2) not null unique,        -- 'IN'
  iso3        char(3) not null unique,        -- 'IND'
  name        text not null,
  slug        citext not null unique,
  phone_code  text,
  currency    char(3),                        -- 'INR' — the default for prices in this market
  center      geography(Point,4326),
  is_launched boolean not null default false, -- we curate here; NOT a search filter
  created_at  timestamptz not null default now()
);

create table states (
  id          uuid primary key default gen_random_uuid(),
  country_id  uuid not null references countries(id),
  code        text,                           -- ISO 3166-2 suffix: 'KA'
  name        text not null,
  slug        citext not null,
  kind        text not null default 'state',  -- state | union_territory | province | region
  center      geography(Point,4326),
  is_launched boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (country_id, slug),
  unique (id, country_id)                     -- target for the composite FK below
);

create table cities (
  id          uuid primary key default gen_random_uuid(),
  country_id  uuid not null references countries(id),
  state_id    uuid,                           -- null for city-states (Singapore)
  name        text not null,
  slug        citext not null,
  center      geography(Point,4326) not null,
  timezone    text,
  is_launched boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (country_id, slug),
  unique (id, country_id),
  -- the database, not application code, rejects a Karnataka city filed under another country
  foreign key (state_id, country_id) references states (id, country_id)
);
```

Plus a trigram index on each `name` for the picker's search.

What this buys over one polymorphic table:

- **Each level keeps the columns that only make sense at that level.** `iso2`/`currency` belong to a country, `timezone` to a city, and `kind` (state vs union territory) to a state. In a single table they'd all be nullable columns that are wrong most of the time.
- **Tier checks are plain equality.** `photos.city_id = $city`, `state_id = $state`, `country_id = $country` — no ancestor operator, no recursive CTE, and every one of them uses a normal btree index.
- **The state level is optional without being special.** `cities.state_id` is nullable, so Singapore works; the composite foreign key still guarantees a state, when present, belongs to the same country.
- **`is_launched` stops gating search.** It means "we seed and curate here" and shows the area first in the picker. A user in Pune still searches and still gets India-level results.

The cost, stated honestly: a **fourth level (district, neighbourhood) means a new table**, not a new row, and the picker's "search everything" needs a union across three tables instead of one query. Both are small, and neither is v1 work.

### 2.2 Canonical identity vs geographic occurrence

The rule: **an entity's identity never forks by geography; its occurrence, availability and evidence do.**

| Layer | Table | Scope |
|---|---|---|
| Identity | `brands`, `items` | **Global. One row per brand and per menu item, forever.** `items.brand_id` stays; no country column is ever added here |
| Market facts | `brand_markets`, `item_markets` (new) | What's true **in a country**: presence, local name, availability, price, currency |
| Physical place | `outlets` | A branch: brand + geography, coordinates optional |
| Evidence | `photos` (a "food experience") | One photo of one item, with the geography where it happened |

```sql
create table brand_markets (               -- "Domino's India": presence and naming per country
  brand_id     uuid references brands(id),
  country_id   uuid references countries(id),
  local_name   text,
  is_active    boolean not null default true,
  primary key (brand_id, country_id)
);

create table item_markets (                -- availability / naming / price per country
  item_id       uuid references items(id),
  country_id    uuid references countries(id),
  is_available  boolean not null default true,
  name_override text,                      -- "Margherita" vs "Cheese & Tomato"
  price_minor   integer,
  currency      char(3),
  source        text not null check (source in ('admin','menu_scan','merchant','inferred')),
  updated_at    timestamptz not null default now(),
  primary key (item_id, country_id)
);
```

**Markets are country-level on purpose.** Menus vary between countries far more than between cities, and the cases that do vary locally — this branch is out of paneer, that one charges more — are already outlet-level facts. So resolution is: `outlet_items` → `item_markets` (country) → the item's own defaults. If a state- or city-level menu difference ever turns up, it gets its own table rather than nullable columns here.

**`outlets` changes:**

```sql
alter table outlets
  add column country_id uuid not null references countries(id),  -- the only level required
  add column state_id   uuid references states(id),
  add column city_id    uuid references cities(id),
  add column geo_source text,          -- 'admin' | 'places' | 'screenshot' | 'inferred'
  add column geo_confidence smallint,  -- 0-100
  add constraint outlets_city_same_country
    foreign key (city_id, country_id) references cities (id, country_id),
  add constraint outlets_state_same_country
    foreign key (state_id, country_id) references states (id, country_id);
alter table outlets alter column location drop not null;         -- coordinates now optional
```

Three nullable-below-country columns rather than one "most specific area" id: a query that asks "same state?" reads one column instead of resolving a level first, and the composite foreign keys make a mismatched pair impossible.

**`photos` gains its own geography**, denormalized at write time from the outlet (or, for brand-level photos, from the uploader's context), because ranking must not join four tables per row:

```sql
alter table photos
  add column country_id uuid references countries(id),
  add column state_id   uuid references states(id),
  add column city_id    uuid references cities(id),
  add column geo_source text,
  add column geo_confidence smallint;
```

`capture_location` stays private and is never returned; only these coarse ids are used for ranking.

**Naming:** the prompt calls this a "food experience". The table stays `photos` (settled, §11) — it is a photo, and renaming costs churn for no behaviour change. When non-photo experiences arrive, `experiences` becomes the parent table and `photos` a child.

### 2.3 Location is context, with a source and a confidence

Three separate things that the current spec collapses into one:

| Concept | Lives in | Changes when |
|---|---|---|
| **Home** | `user_locations` row, `kind = 'home'` | The user edits it in Settings. Survives travel |
| **Last seen** | `user_locations` row, `kind = 'last_seen'` | A device fix or an area switch. **This is what a search uses first**, so a Bengaluru user in New York gets New York |
| **Query context** | Per request, never stored | A screenshot names an outlet or city — it overrides both, for that query only |

These live in their own table rather than columns on `users`, because a user has more than one at once and each arrives from a different signal with a different confidence:

```sql
create table user_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,                    -- FK added with the users table (auth step)
  kind        text not null check (kind in ('home','last_seen')),
  source      text not null check (source in ('device_precise','device_approximate',
                'picked_city','picked_state','picked_country','screenshot',
                'inferred_locale','inferred_ip')),
  confidence  smallint not null check (confidence between 0 and 100),
  country_id  uuid references countries(id),
  state_id    uuid,
  city_id     uuid,
  point       geography(Point,4326),            -- private; never returned by any endpoint
  accuracy_m  integer,
  captured_at timestamptz,                      -- when the signal was produced, not stored
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind),
  foreign key (city_id, country_id)  references cities (id, country_id),
  foreign key (state_id, country_id) references states (id, country_id),
  -- a row that names nowhere is not a location
  check (country_id is not null or state_id is not null
      or city_id is not null or point is not null)
);
```

A row references our own tables **or** carries coordinates, or both: a device fix resolves to a city, while a picked city has no coordinates at all. `point` is private — only the coarse ids are ever used for ranking or returned.

Every geographic signal carries a confidence, and the highest wins **per query**:

| Signal | Confidence | Example |
|---|---|---|
| Outlet id from a shared listing URL | 95 | A Zomato link with a store id |
| Outlet matched from a screenshot address | 85 | "100 Feet Rd, Indiranagar" |
| Device coordinates (permission granted, < 10 min old) | 80 | |
| City text read from a screenshot | 70 | "Mumbai" in the header |
| User-selected area | 60 | Picker, or "change area" |
| `user_locations` `kind='home'` | 40 | Returning user, no other signal |
| Country from locale or IP (coarse only) | 20 | Never stored, never narrower than country |
| Global | 0 | Nothing known — still a valid state |

**Onboarding stops blocking.** Location permission is asked for because it helps, a picker is offered if declined, and **skipping both is allowed**: the app proceeds with country-from-locale, or global. A user with no `user_locations` row at all is a supported state, not a broken one.

## 3. Ranking: tiers, not filters

A query resolves to a context `{outletId?, cityId?, regionId?, countryId?, point?}`. Every candidate photo gets a **tier** by comparing its geography to that context — and tiers *score*, they don't exclude.

| Tier | Meaning | Geo score |
|---|---|---|
| 0 | Same outlet | 1.00 |
| 1 | Same city, same brand | 0.80 |
| 2 | Same state | 0.60 |
| 3 | Same country | 0.45 |
| 4 | Any country (global) | 0.25 |
| 5 | Different but similar dish | 0.10 — **deferred to the AI Gateway phase (§11); when it ships it gets its own section, never mixed in** |

```
score = 0.45·geo + 0.20·freshness + 0.15·trust + 0.10·quality + 0.10·dishConfidence
        + up to 0.10 proximity bonus (when both points are known, within tier 0–1)
        − penalties (near-duplicate, reported, stale beyond 18 months)
```

`freshness` decays exponentially with a 90-day half-life. `trust` combines verification outcome and uploader standing. `dishConfidence` is how sure we are the photo shows the requested item (verification votes today; a vision check later).

**Response shape: sections, always non-empty.**

```json
{ "groups": [
  { "tier": 0, "label": "This outlet",        "outletId": "…",  "photos": [...] },
  { "tier": 1, "label": "Near you",           "cityId": "…",    "photos": [...] },
  { "tier": 3, "label": "More from India",    "countryId": "…", "photos": [...] },
  { "tier": 4, "label": "Domino's Margherita worldwide", "photos": [...] }
] }
```

Empty tiers are omitted, the next tier fills the page, and tier 4 guarantees the screen is never empty for a dish we know. Only a dish we've never seen produces the "no photos yet" state — which is the upload prompt, and that's correct.

**Evidence labels generalize** from four to five, and the app must map them:

| Today | Becomes |
|---|---|
| This outlet | This outlet |
| Same brand, nearby | Same brand, this city |
| Same item, other city | **Elsewhere in {region/country}** |
| — | **{Country}** (new tier) |
| Real Bite team | Real Bite team |

## 4. API changes

| Today | Proposed | Note |
|---|---|---|
| `GET /v1/cities` | `GET /v1/geo/countries` · `GET /v1/geo/states?countryId=` · `GET /v1/geo/cities?countryId=&stateId=&q=` | One resource per table |
| — | `GET /v1/geo/search?q=` → `{ countries[], states[], cities[] }` | What the picker calls: one round trip, grouped by level |
| — | `GET /v1/geo/resolve?lat=&lng=` | Coordinates → `{country, region, city, confidence}` |
| — | `POST /v1/geo/resolve` | Screenshot signals → resolved context + confidence |
| `?cityId=` everywhere | `?cityId=` **or** `?stateId=` **or** `?countryId=` **or** `?lat=&lng=`, all optional | Nothing is required; absent means global. `cityId` survives, but as a hint rather than a filter |
| — | `&scope=auto\|outlet\|city\|country\|global` | A hint, default `auto`. Never a hard filter — it shifts which tier leads |
| `GET /v1/items/:id/photos?scope=outlet\|all` | `?outletId=&cityId=&stateId=&countryId=&scope=` → **grouped** response | The core change |
| `GET /v1/search?q=&cityId=` | `?q=&cityId=&countryId=&lat=&lng=` → results carry `geo:{tier,label,path}` | Global search, local ranking |
| `POST /v1/scans {cityId}` | `{ lines, context:{ lat?, lng?, cityId?, countryId? } }` → response adds `detectedContext:{signals[], resolved, confidence}` | Screenshot geography beats user default |
| `PATCH /v1/me {homeCityId}` | `{homeAreaId}` (any `kind`), nullable | `homeCityId` accepted and mapped for two releases |
| `/v1/admin/cities` | `/v1/admin/geo/{countries,states,cities}` | Plus a merge tool for duplicate rows |

Every response that carries a place also carries a resolved `path` (`["India","Karnataka","Bengaluru"]`) so the app can label a group without another lookup.

## 5. Search and indexing

**Text matching is unchanged** — trigram + aliases over `brands`, `items`, `outlets`. What changes is that geography leaves the `WHERE` clause and enters `ORDER BY`.

```sql
-- one query, all tiers, no city filter
select p.*, case
  when p.outlet_id = $outlet                     then 0
  when p.city_id   = $city                       then 1
  when p.state_id   = $state   then 2
  when p.country_id = $country                   then 3
  else 4 end as tier
from photos p
where p.item_id = $item and p.status = 'approved'
order by tier, score desc
limit 60;
```

**Indexes** (replacing the city-first assumption):

```sql
create index photos_item_city    on photos (item_id, city_id,    created_at desc) where status='approved';
create index photos_item_state   on photos (item_id, state_id,   created_at desc) where status='approved';
create index photos_item_country on photos (item_id, country_id, created_at desc) where status='approved';
create index photos_item_recent  on photos (item_id,             created_at desc) where status='approved';
create index photos_outlet_item  on photos (outlet_id, item_id)                   where status='approved';
create index outlets_city_brand  on outlets (city_id, brand_id) where status='active';
create index outlets_country_brand on outlets (country_id, brand_id) where status='active';
```

**A coverage table makes the tier decision cheap** and powers "how much local data exists" without scanning photos:

```sql
create table item_coverage (           -- maintained by trigger on photo approval
  item_id  uuid not null,
  level    text not null check (level in ('city','state','country')),
  area_id  uuid not null,              -- deliberately no FK: this is a derived cache, and a
                                       -- polymorphic key is fine for counters, not for facts
  approved_count int not null default 0,
  newest_at timestamptz,
  primary key (item_id, level, area_id)
);
```

**Partitioning: don't.** Every fallback query spans tiers, so partitioning `photos` by city or country turns one index scan into a fan-out across partitions — it makes the core query *worse*. If the table ever needs it, partition by `created_at` (time), or by `country_id` **only if data-residency law forces it** (see §9).

## 6. Caching

Never key a cache on raw coordinates — resolve to an area first, then key on the tier:

```
photos:item:<itemId>:outlet:<outletId>      TTL 2 min
photos:item:<itemId>:city:<cityId>          TTL 10 min
photos:item:<itemId>:state:<stateId>        TTL 30 min
photos:item:<itemId>:country:<countryId>    TTL 1 h
photos:item:<itemId>:global                 TTL 6 h
```

Coarse tiers are both the most reusable and the most stable, which is exactly backwards from a city-keyed cache — and it means a cold city inherits a warm country cache instead of a cold miss. Invalidate on photo approval by deleting the four keys for that photo's ancestors.

## 7. Screenshot flow

The screenshot's geography **wins over the user's default** when it is more specific and more confident (§2.3). A Bengaluru user sharing a Mumbai listing gets Mumbai results, and their home stays Bengaluru.

Extraction targets grow from `{brand, outlet, items}` to `{platform, brand, outlet, items, cityText?, countryHint?, listingUrl?}`. The resolver walks the confidence table, returns `detectedContext`, and the result screen shows it as a changeable chip ("Showing Mumbai · change"), so a wrong inference is one tap to fix.

`scans` stores the resolved ids and the signal list — never the raw text, per the standing rule.

## 8. Onboarding and travel

- Location permission is still asked for first, still explained, and **declining no longer stops onboarding**.
- The picker becomes an **area picker**: search across countries, with launched areas first. "Coming soon" disappears; an un-launched area is selectable and simply yields country-level results.
- Home screen header shows the **current context**, not a fixed city, with one tap to change it. Switching is session-scoped unless the user pins it as home.
- Travel works because the context comes from the device at query time: a search reads `user_locations` `kind='last_seen'` first, and only falls back to `kind='home'` when nothing better exists.

## 9. Consequences worth naming

- **Data residency.** Going multi-country eventually means GDPR alongside DPDP. Photos and user data are all in `ap-south-1` today. That's fine for India-first; an EU user base would force a region-scoped bucket and possibly partitioned storage. Not v1, but it's the one thing that could later justify country partitioning.
- **Seeded coverage still matters.** Global fallback stops empty screens; it does not make a Pune search *good*. Curation order stays a product decision.
- **Moderation across countries** means norms differ. The safety pre-filter and guidelines stay global; escalation queues may need per-country reviewers later.

## 10. Build order

Nothing city-based was ever released, so there is **no migration and no backfill** — the old `cities` table and `GET /v1/cities` were deleted before launch. What remains is build order.

| Phase | Work | State |
|---|---|---|
| **1. Geography tables** | `countries`, `states`, `cities`, `user_locations` + composite FKs and trigram indexes | **Done** — `0000_init_geo.sql` (+ GiST index on `cities.center`, `0002`) |
| **2. Seed** | India, its 36 states and union territories, and the launch cities (only Bengaluru `is_launched`) | **Done** — `0001_seed_india.sql`: India, 36 states/UTs, 27 cities, only Bengaluru launched |
| **3. Read endpoints** | `GET /v1/geo/{countries,states,cities}`, `/v1/geo/search`, `/v1/geo/resolve` | **Server done** (`GET`s only; `POST /v1/geo/resolve` waits for auth, phase 7). Next: the app's picker drops `PLACEHOLDER_AREAS` |
| **4. Catalogue geography** | `outlets.country_id/state_id/city_id` (country required, the rest optional), `location` nullable, composite FKs | With the `outlets` table |
| **5. Evidence geography** | `photos.country_id/state_id/city_id`, trigger-filled from the outlet or the uploader's context | With the `photos` table |
| **6. Tiered read path** | The grouped query, `item_coverage`, the tier indexes, cache keys per tier | With the gallery endpoint |
| **7. User context** | `user_locations` writes, the `users` foreign key, `/v1/geo/resolve` from device fixes and screenshots | `users` table and the `user_locations.user_id` FK **done** (`0003_users.sql`); writes and the resolve `POST` come with the auth endpoints |

**The ordering constraint that matters:** `outlets` and `photos` must be created **with** their geography columns, not retrofitted. That's phases 4–5, and it's why the geography tables come first.

## 11. Decisions (settled 22 Sep 2026)

| Question | Decision | Consequence |
|---|---|---|
| Similar-dish fallback (tier 5) | **Deferred.** Ship tiers 0–4 | v1 stays AI-free. Tiers 0–4 already guarantee a non-empty screen for any dish we know; a dish we've never seen correctly gets the upload prompt instead. Tier 5 returns with the AI Gateway ([02b](02b-ai-gateway.md)) and `pgvector` |
| Seed scope | **India only, global-ready schema** | Bengaluru stays the pilot and the ~750-photo seeding budget stays focused. A search from another country works on day one through country and global tiers rather than an empty screen |
| `photos` vs `experiences` | **Keep `photos`** | It is a photo. If notes or video arrive later, `experiences` becomes the parent table and `photos` a child — additive, no rename of the spec, app and server now |
| State level | **Seed Indian states** — and give them their own `states` table | Regional cuisine differences are real, `cities.state_id` is nullable so countries without the level still work, and adding it later would mean backfilling `state_id` across every outlet and photo |

## 12. What happens next

Phases 1–3 of §10 (the four tables, the India seed, and the read endpoints) are the work that gets more expensive by waiting: `outlets` and `photos` should be **created with** their geography columns rather than altered later, and the app's picker is already written against this shape.
