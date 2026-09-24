# 13: CheapFoodMap Architectural Benchmark & Integration Blueprint for Real Bite

> **Document Type:** Competitive & UX/Technical Benchmark  
> **Target Application:** Real Bite (Expo/React Native Android App + NestJS / PostGIS Backend)  
> **Subject of Analysis:** [CheapFoodMap.com](https://cheapfoodmap.com/) (Reverse-engineered on 23 Sep 2026)  
> **Cross-References:** [00-mvp-v1-spec.md](00-mvp-v1-spec.md), [02-architecture.md](02-architecture.md), [06-place-menu.md](06-place-menu.md), [07-rewards-system.md](07-rewards-system.md), [11-backend-mvp1.md](11-backend-mvp1.md), [12-geography-and-relevance.md](12-geography-and-relevance.md).

---

## 1. Executive Summary & Strategic Alignment

**Real Bite** solves a fundamental consumer visual deception problem: *food delivery and restaurant menus use styled, staged, or generic marketing photos that bear little resemblance to what is actually served.* Real Bite's moat is an authentic, outlet-matched photo library verified by the community and tied to a ledger of in-app credits (**Bites**).

**CheapFoodMap** (`cheapfoodmap.com`) tackles a complementary consumer pain point: *discovering high-value, affordable food options (meals under $10, capped at $15) across the United States through an interactive map powered by gamified crowdsourcing.*

```
┌───────────────────────────────────────────────┐     ┌───────────────────────────────────────────────┐
│              CheapFoodMap                     │     │                  Real Bite                    │
├───────────────────────────────────────────────┤     ├───────────────────────────────────────────────┤
│ • Core Hook: "Where can I eat under $10?"    │     │ • Core Hook: "What does this dish ACTUALLY   │
│ • Interface: Map-first visual explorer        │     │   look like at this outlet?"                  │
│ • Currency: Acorns 🌰 (Gamification / Levels) │     │ • Interface: Search, Brand, Outlet & Dish     │
│ • Crowdsourcing: Price freshness & spot logs  │     │ • Currency: Bites (Earn-only ledger credits)  │
│ • Community: Board, comments, hoodie flairs   │     │ • Crowdsourcing: Camera photos + shadow votes │
│ • Distribution: Web/SEO (cities, spot pages)  │     │ • Distribution: Android-first Expo app + OCR  │
└───────────────────────────────────────────────┘     └───────────────────────────────────────────────┘
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       The Synergistic Real Bite Opportunity      │
             │ Real Visual Truth + Value/Price Freshness +      │
             │ Spatial Map Discovery + Frictionless Crowdsource │
             └─────────────────────────────────────────────────┘
```

By benchmarking CheapFoodMap's mechanics—specifically its **Google Maps advanced custom markers, price freshness verifications, "Conquer it" dining passport, instant-trust moderation thresholds, and avatar/level progression**—Real Bite can supercharge user acquisition, engagement, and data collection velocity without compromising its core architectural tenets (no scraping, strict photo rights, and append-only Bites ledger).

---

## 2. In-Depth Technical & Product Teardown of CheapFoodMap

### 2.1 Technology Stack & Infrastructure

| Layer | Implementation in CheapFoodMap | Real Bite Current Stack | Technical Comparison & Takeaways |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React / Next.js (App Router)** with hybrid SSR and client-side hydration | **Expo (SDK 57) / React Native** (Android-first) | CheapFoodMap leverages Next.js for high SEO indexability. Real Bite is native-first, but can extract huge value from web canonical routes for dish and outlet pages. |
| **Styling & UI Tokens** | **Tailwind CSS** with warm retro palette (`#E8593C` brand orange, `#1E3A5F` navy, `#FAFAF8` background, rounded-full pills) | **Custom Design System** (`codebase/real-bite/DESIGN.md`, `src/constants/theme.ts`) | Both favor clean, card-based tokens with high contrast and pill tags. Real Bite's token system directly matches this aesthetic. |
| **Map Rendering Engine** | **Google Maps JavaScript API** with modern Web Component **`<gmp-advanced-marker>`** | None in v1 (list/tier-based ranking in `docs/12`); planned for v2 | CheapFoodMap uses Google Advanced Markers to render interactive DOM elements inside the map canvas (custom mascot icons, price labels, dynamic hover states). |
| **Places & Geocoding** | **Google Places Autocomplete API** with manual fallback | **Google Places IDs-only** (display/reference only; `docs/03`, `docs/06`) | CheapFoodMap relies on Places autocomplete during submission. Real Bite restricts Google Places to `place_id` IDs-only to prevent vendor lock-in and TOS violations. |
| **Session & Auth** | Cookie/Session auth with **progressive guest onboarding** | **Google ID token + Email/Password** (argon2 + 15-min JWT + rotating refresh) | CheapFoodMap lets guests browse and interact immediately, awarding +10 Acorns upon upgrading to an account. Real Bite can allow guest browsing while reserving uploads/voting for authenticated users. |
| **Media & Content** | User uploaded photos + external Google Maps reviews sync | **S3 presigned uploads + CloudFront**, ML Kit on-device OCR, Rekognition safety filter | Real Bite has a superior media architecture with cryptographic hashing (`sha256`), verification pipelines, and on-device privacy. |
| **Monetization** | Embedded **Ko-fi** donations widget (`ko-fi.com/cheapfoodmap`) | **Bites-for-scans paywall** (Phase 4, RevenueCat promotional entitlement) | Real Bite has a direct B2C utility monetization path (scans/pro pass), whereas CheapFoodMap relies on tip-jar patronage. |

---

### 2.2 Navigation Architecture & URL Routing

CheapFoodMap is structured for both viral discovery and deep programmatic SEO:

```
https://cheapfoodmap.com/
│
├── /                                  # Interactive Map + Search + Activity Sidebar
│   └── ?focus=[slug]&lat=..&lng=..    # Spatial deep-link focusing on specific venue pin
├── /spot/[slug]                       # Canonical SEO landing page for a specific meal/restaurant
│                                      # (e.g., /spot/tacos-el-charly-austin-tx)
├── /cities                            # Directory of supported metro areas (DFW, Bay Area, etc.)
├── /[city-slug]                       # City-filtered landing page (e.g., /dallas, /houston)
├── /community                         # Community discussion forum (Hot / New / Top filters)
├── /leaderboard                       # Global ranking table (Weekly, Monthly, All-Time)
├── /legend                            # Gamification transparency guide (Acorn payouts & tiers)
├── /profile/[uuid] & /profile         # User public passport, unlocked achievements, activity
└── /settings                          # Account management & Avatar hoodie color picker
```

---

### 2.3 Spot Detail View (`/spot/[slug]`) Architecture

When inspecting a spot card on CheapFoodMap, the data fields and user actions are tightly orchestrated:

1. **Breadcrumb Hierarchy:** `Home > City > Restaurant Name`
2. **Venue Header & Cross-Link:**
   - Restaurant Name & Cuisine Tag (e.g. `Mexican`, `Vietnamese`).
   - Synced Google Maps star rating and review count: `★ 4.6 (1,270 reviews)`.
   - External deep-link: `Open in Google Maps`.
3. **The "Conquer It" CTA:**
   - A dedicated button allowing any user to mark: *"Claim this place — you've eaten here"*.
   - Increments the spot's total conquer tally and adds the spot to the user's personal Passport.
4. **Deal / Meal Presentation:**
   - Dish Name (e.g. *Burrito*, *2-Taco Plate*).
   - Price tag (e.g. `$9.25`), formatted with high visual prominence.
   - **Freshness Badge:** *"Price verified today"*, *"Price verified 14 days ago"*, or *"Needs verification"*.
5. **Crowdsourcing Quick-Actions:**
   - `Confirm price (+15 XP)`: One-tap confirmation if the user ate there or knows the price is still accurate.
   - `Update price (+25 XP)`: Inline input to submit an updated price if it inflated or changed.
   - `Save`: Bookmark to personal list.
6. **Social Feedback & Community Sentiment:**
   - Upvote (▲) / Downvote (▼ *"Not worth it"*) with live counters.
   - Submitter credit card: Avatar, Username, Submitter Level (`Lv. 2`).
   - Dish comment stream: Allows tips (e.g. *"Salsa bar is free"*, *"Cash only on Tuesdays"*).

---

### 2.4 The "+ Add a Meal" Contribution Workflow

Clicking `+ Add a meal` triggers a multi-step modal optimized for minimal cognitive friction:

```
┌─────────────────────────────────────────────────────────────┐
│                       Add a Meal                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Restaurant: [ Search Google Places... or add manually ] │
│ 2. Cuisine:    [ Dropdown: Mexican, Asian, Burgers, etc. ]  │
│ 3. Dish Name:  [ What did you eat? 0/200 chars           ]  │
│ 4. Price ($):  [ Numeric input (Max $15; <$10 highlighted)] │
│ 5. Portion:    (•) Meal   ( ) Snack / Appetizer             │
│ 6. Tip Factor: [Toggle: Tip expected / No tip counter]     │
│ 7. Deal Type:  [Tags: Lunch Special | Happy Hour | Regular] │
│ 8. Photo:      [ Dropzone / Camera (+10 Acorn Bonus)      ] │
│                                                             │
│         [  "I ate this for real" - Submit Deal  ]           │
└─────────────────────────────────────────────────────────────┘
```

**Psychological Highlight:** The submission button does not say "Submit" or "Send". It says **"I ate this for real"**—a micro-copy choice that anchors personal authenticity and commitment.

---

### 2.5 Gamification Teardown: The "Acorns 🌰" Engine

CheapFoodMap's gamification system is transparently documented at `/legend`:

#### A. Points & Action Distribution

| Action | Reward | Frequency / Rule |
| :--- | :---: | :--- |
| **First Spot at a New Venue** | **+60 Acorns** | 10 base + 50 new venue pioneer bonus |
| **Verify Existing Price** | **+15 Acorns** | Limited to 1 verification per spot every 30 days |
| **Add Photo to Submission** | **+10 Acorns** | Additive media bonus |
| **Add Extra Meal to Existing Venue** | **+10 Acorns** | Expanding menu coverage |
| **Upgrade Guest to Registered Account** | **+10 Acorns** | One-time conversion bonus |
| **Community Board Post** | **+5 Acorns** | Engaging in the forum |
| **Receive Upvote on your Spot** | **+2 Acorns** | Ongoing creator dividend |
| **Post a Comment** | **+1 Acorn** | Micro-interaction reward |
| **Daily Contribution Streak** | **+1 to +2/day** | +1/day (Days 1–5), +2/day (Day 6+) |

#### B. The Trust Threshold: 25 Acorns = Instant Live Publishing
This is one of CheapFoodMap's most effective architectural decisions:
- **< 25 Acorns:** Submissions enter a pending moderation queue.
- **≥ 25 Acorns:** Price updates and contributions **bypass pre-moderation and go live immediately**.

This dramatically lowers administrative overhead while requiring a user to make just 1–2 verified contributions before granting trusted status.

#### C. Progression & Visual Customization (Avatar Hoodies)

| Level | Acorn Threshold | Reward Unlocked |
| :---: | :---: | :--- |
| **Lv. 1** | 0 | Starter Hoodies |
| **Lv. 2** | 10 | Sunflower Hoodie |
| **Lv. 3** | 75 | Bubblegum Hoodie |
| **Lv. 4** | 200 | Grape Hoodie |
| **Lv. 5** | 500 | Chili Hoodie |
| **Lv. 6** | 1,200 | Frost Hoodie |
| **Lv. 7** | 3,000 | Midnight Hoodie |
| **Lv. 8** | 6,000 | Aurora Hoodie |
| **Lv. 9** | 12,000 | Custom Leaderboard Name Flair |
| **Lv. 10** | 25,000 | Hall of Fame Recognition |

**Scarcity Mechanic:** A special **Gold Hoodie** and numbered badge are permanently restricted to the **First 500 Founding Contributors**.

---

## 3. What Can Be Integrated Into Real Bite

While CheapFoodMap focuses on budget price discovery and Real Bite focuses on dish visual truth, several core patterns from CheapFoodMap solve Real Bite's most pressing roadmap challenges:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                   KEY MECHANISMS TO INTEGRATE INTO REAL BITE                             │
├────────────────────────────────┬───────────────────────────────┬────────────────────────┤
│ CheapFoodMap Mechanism         │ Real Bite Target Area         │ Value Unlocked         │
├────────────────────────────────┼───────────────────────────────┼────────────────────────┤
│ 1. Interactive Map Explorer    │ App Discovery & "Explore" tab │ Spatial dish discovery │
│ 2. Price Freshness Engine      │ Menu Item Data & Transparency │ Inflation & app markup │
│ 3. "Conquer It" Passport       │ User Profile & Retention      │ Gamified dining logs   │
│ 4. Trust Threshold Bypass      │ Moderation Queue Velocity     │ Instant upload for L2  │
│ 5. Avatar / Badge Scarcity     │ Bites Rewards & Contributor Lvl│ Early pilot seeding   │
│ 6. Programmatic Web Pages      │ SEO & Growth Engine           │ Zero-CAC user funnel   │
└────────────────────────────────┴───────────────────────────────┴────────────────────────┘
```

---

### Feature 1: Interactive Map Mode ("BiteMap" / Dish Visual Radar)

#### The Gap in Real Bite Today
Real Bite v1 relies on a text search bar, brand carousels, and an area picker chip (`screens/area-picker`). While `docs/12` specifies sophisticated PostGIS spatial ranking, the user cannot visually browse what dishes look like around them on a live map.

#### How to Integrate:
1. **Add a Map View Toggle on Home:**
   - In `screens/home`, provide a toggle: `[ List View ]` vs. `[ Map View ]`.
2. **Custom Dish Pin Markers:**
   - Rather than generic restaurant pins, render **Dish-Centric Pins** displaying:
     - Real photo thumbnail (circular cropped).
     - Price pill (e.g. `₹189`).
     - Veg / Non-Veg dot indicator (standard green/red FSSAI badge).
     - Evidence tier indicator (Green = photo from this exact outlet; Blue = photo from same brand nearby).
3. **Map Clustering & PostGIS Bounding Box API:**
   - When the user pans/zooms the map, call a bounding-box query:
     ```http
     GET /v1/map/dishes?minLat=12.96&minLng=77.58&maxLat=12.98&maxLng=77.62&vertical=food
     ```
   - On the backend, use PostGIS `ST_MakeEnvelope` and cluster outlets using `ST_ClusterKMeans` or geohashing when zoomed out.

---

### Feature 2: Price Verification & Freshness Indicator

#### The Real-World Problem:
In India, menu prices on Swiggy and Zomato are frequently marked up 15–30% above in-store dine-in prices. Furthermore, restaurant menu prices inflate every 6–12 months.

#### How to Integrate:
1. **Price Freshness Tag on Dish Cards:**
   - Next to the item price, display:
     - *"Verified in-store 3 days ago"* (Green check).
     - *"Price may have changed (Verified >6 months ago)"* (Amber clock).
2. **CheapFoodMap's Dual Verification Buttons:**
   - On the Item screen (`screens/item`):
     - `[ Confirm Price ₹149 (+5 Bites) ]` → 1-tap confirmation.
     - `[ Update Price (+10 Bites) ]` → Opens numeric prompt to input the current in-store bill/menu price.
3. **Menu Photo Proof Bonus:**
   - If the user snaps a photo of the bill or menu card confirming the price update, award a +15 Bite bonus (feeding directly into the `extractMenu` pipeline from `docs/06`).

---

### Feature 3: The "Conquer It" Dining Passport (Meal Log)

#### The Behavioral Hook:
Foodies love tracking places they've visited. CheapFoodMap's "Conquer it" button gives users an instant sense of completion without requiring a 500-word review.

#### How to Integrate:
1. **"I Ate This" Button on Dish & Outlet Screens:**
   - A single prominent action button on every dish: **"I had this dish"** or **"Conquer it"**.
2. **Instant Micro-Prompt for Real Photo:**
   - Tapping "I had this dish":
     - Immediately logs the dish to the user's **Bite Passport** in their profile.
     - Triggers a non-intrusive bottom sheet: *"Have a photo of how it actually looked? Snap it now for +20 Bites!"*
     - If the user is physically within 150m of the outlet (via `isMock`-checked GPS from `docs/06`), apply the **Geo-Verified** badge and award the pioneer bonus if first.
3. **User Profile Food Passport:**
   - A visual gallery of all dishes conquered, categorized by cuisine, city, and spice rating.

---

### Feature 4: Trust Threshold for Instant Publishing

#### The Bottleneck in Real Bite v1:
`docs/00` and `docs/07` specify that all uploads in v1 must go through community verification in shadow mode or admin approval before appearing in public galleries. While this protects quality, it delays gratification for legitimate users and slows down catalog population.

#### How to Integrate (CheapFoodMap 25-Acorn Rule adapted for Real Bite):
1. **The Trusted Contributor Tier (L2):**
   - Once a user has accumulated **≥50 Bites from verified, approved uploads** with an admin/community agreement rate of **≥95%**:
     - Their camera uploads at registered outlets **bypass the pre-approval queue and publish instantly**.
     - An automated post-publish audit task is silently created in the background (`verification_tasks`).
     - If any subsequent upload receives a safety flag or community rejection, the instant-publish privilege is immediately revoked and points are reversed via the append-only ledger (`reversal` row).
2. **Result:**
   - Highly active contributors see their photos live on the menu within 5 seconds of dining, creating immediate delight and viral sharing.

---

### Feature 5: Avatar Progression & Scarcity Badges (Founding 500)

#### Solving the Pilot "Cold Start" in Bengaluru:
Real Bite's initial pilot requires ~750 owned photos across 30–50 outlets (`docs/README.md`). Monetary incentives (Bites) are helpful, but identity and status are often more powerful drivers for early contributors.

#### How to Integrate:
1. **Founding 500 Bengaluru Badge:**
   - The first 500 users who contribute ≥3 verified dish photos in the Bengaluru pilot receive an exclusive **"Founder 500" Gold Chef Hat Badge** and profile border.
   - This badge is permanently displayed on every photo they contribute, granting social clout.
2. **Visual Chef / Foodie Avatar Progression:**
   - Rather than generic avatars, implement unlockable chef avatars or mascot flair tied to Bite milestones:
     - *Apprentice (0 Bites)* → *Commis Chef (50 Bites)* → *Sous Chef (250 Bites)* → *Executive Chef (1,000 Bites)* → *Master Gastronome (5,000 Bites)*.

---

### Feature 6: Programmatic Web Pages for Zero-CAC SEO

#### CheapFoodMap's Growth Engine:
CheapFoodMap's largest acquisition channel is organic search for queries like `"cheap food in dallas"`, `"best meals under $10 austin"`, or `"[restaurant] cheap menu"`.

#### How to Integrate for Real Bite:
1. **Lightweight Web Discovery Engine:**
   - In addition to the Expo mobile app, deploy a lightweight Next.js or Astro web catalog backed by the existing NestJS API.
2. **High-Intent Landing Pages:**
   - `realbite.app/brand/[brand-slug]` (e.g. `realbite.app/brand/dominos-india`)
   - `realbite.app/outlet/[outlet-slug]` (e.g. `realbite.app/outlet/dominos-indiranagar-100ft-rd`)
   - `realbite.app/dish/[dish-slug]` (e.g. `realbite.app/dish/paneer-makhani-pizza`)
3. **Search Engine Meta Snippet:**
   - Title: *"Real Customer Photos of Margherita Pizza at Domino's Indiranagar | Real Bite"*
   - Schema.org `Restaurant` and `Menu` structured JSON-LD with real image URLs.
   - Seamless "Open in App" banner / smart app banner to convert web visitors into app installs.

---

## 4. Technical Architecture & Database Schema Additions

To support these features, the existing PostgreSQL 16 + PostGIS database schema (`docs/11-backend-mvp1.md`) requires only lightweight, non-breaking additive extensions.

### 4.1 Schema DDL Additions (Drizzle Migrations)

```sql
-- ── 1. Price Verification & Freshness ─────────────────────────────
create table item_price_verifications (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references items(id) on delete cascade,
  outlet_id      uuid references outlets(id) on delete set null,
  user_id        uuid not null references users(id) on delete cascade,
  reported_price numeric(10, 2) not null,
  currency       char(3) not null default 'INR',
  is_in_store    boolean not null default true,     -- true: dine-in, false: delivery app
  proof_photo_id uuid references photos(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_price_verif_item_outlet on item_price_verifications(item_id, outlet_id, created_at desc);

-- ── 2. Dining Passport / Conquered Dishes ─────────────────────────
create table user_conquests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  item_id        uuid not null references items(id) on delete cascade,
  outlet_id      uuid references outlets(id) on delete set null,
  photo_id       uuid references photos(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint uq_user_item_outlet unique (user_id, item_id, outlet_id)
);

create index idx_user_conquests_user on user_conquests(user_id, created_at desc);

-- ── 3. Dish Tips & Community Notes ────────────────────────────────
create table dish_tips (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references items(id) on delete cascade,
  outlet_id      uuid references outlets(id) on delete set null,
  user_id        uuid not null references users(id) on delete cascade,
  tip_text       varchar(280) not null,
  upvotes_count  integer not null default 0,
  status         varchar(20) not null default 'published', -- published | flagged | hidden
  created_at     timestamptz not null default now()
);

create index idx_dish_tips_item on dish_tips(item_id, upvotes_count desc);
```

### 4.2 Proposed API Endpoints (NestJS Backend)

```typescript
// 1. Spatial Map Exploration
GET /v1/map/dishes
  Query: { minLat, minLng, maxLat, maxLng, vertical?, categoryId? }
  Returns: Array<{
    outletId: string;
    brandName: string;
    outletName: string;
    lat: number;
    lng: number;
    topDish: {
      itemId: string;
      itemName: string;
      price: number;
      thumbnailUrl: string;
      evidenceTier: 'same_outlet' | 'same_brand_nearby' | 'regional';
      isVeg: boolean;
    }
  }>

// 2. Price Confirmation & Freshness
POST /v1/items/:id/price/confirm
  Body: { outletId?: string, currentPrice: number }
  Action: Appends ledger row (+5 Bites), updates item_price_verifications

POST /v1/items/:id/price/update
  Body: { outletId?: string, newPrice: number, proofPhotoId?: string }
  Action: Appends ledger row (+10 Bites), updates item_price_verifications

// 3. "I Ate This" / Conquest
POST /v1/items/:id/conquer
  Body: { outletId?: string, lat?: number, lng?: number }
  Returns: { conquestId: string, unlockedBadge?: string, promptPhoto: boolean }

GET /v1/users/:id/passport
  Returns: { totalConquered: number, dishes: Array<UserConquestSummary> }
```

---

## 5. UI / UX Design Patterns: Adapting CheapFoodMap into Real Bite

### 5.1 The "Dish Pin" Component (Mobile Map View)

```
┌─────────────────────────────────────┐
│             [ ₹149 ]                │  <-- Price Pill Tag
│        ┌──────────────┐             │
│        │  (Photo of   │ (•) Veg     │  <-- Thumbnail + FSSAI green dot
│        │   Margherita)│             │
│        └──────┬───────┘             │
│               ▼                     │  <-- Outlet Coordinate Anchor
└─────────────────────────────────────┘
```

When tapped, a lightweight bottom sheet slides up:
- Dish Name, Brand, and Outlet locality.
- Full real photo with Evidence Badge: `[ This outlet · Verified 2d ago ]`.
- Actions: `[ View Full Gallery ]` · `[ I Had This Dish ]` · `[ Upload Photo ]`.

---

### 5.2 Micro-Copy Guidelines (Inspired by CheapFoodMap)

CheapFoodMap succeeds because its copy feels human, playful, and grounded in reality:

| Standard Generic Copy | CheapFoodMap Inspiration | Recommended Real Bite Implementation |
| :--- | :--- | :--- |
| "Submit Photo" | "I ate this for real" | **"Share what it really looked like"** |
| "Check In" | "Conquer it" | **"I ate this dish" / "Add to Passport"** |
| "Verify Price" | "Confirm price (+15 XP)" | **"Confirm price (+5 Bites)"** |
| "Wrong Price" | "Update price (+25 XP)" | **"Fix price (+10 Bites)"** |
| "No photos available" | "Be the first chipmunk" | **"No real photo yet: be the pioneer (+30 Bites)"** |

---

## 6. Implementation Phasing & Integration Roadmap

To maintain engineering discipline and prevent scope creep from destabilizing the v1 launch target (`docs/00-mvp-v1-spec.md`), here is the recommended phased rollout:

### Phase A: Zero-Breaking-Change Quick Wins (Target: v1 Polish)
- [ ] **Micro-Copy Updates:** Adopt authentic action copy on upload buttons (*"Share what it really looked like"*).
- [ ] **Founder 500 Bengaluru Badge:** Implement the badge table and profile flair to incentivize the initial 750 seed photos during the Bengaluru pilot.
- [ ] **"I Had This" (Conquer) Action:** Add a 1-tap dish bookmark on `screens/item` that populates a "My Dishes" tab in the user profile.

### Phase B: Value & Freshness Expansion (Target: v1.1)
- [ ] **Price Freshness Tracking:** Deploy `item_price_verifications` table.
- [ ] **1-Tap Price Confirmations:** Add `[ Confirm Price (+5 Bites) ]` and `[ Update Price (+10 Bites) ]` to dish cards.
- [ ] **Trusted Uploader Bypass (25-Acorn equivalent):** Grant instant publishing to users with ≥50 approved Bites and >95% accuracy.

### Phase C: Spatial Discovery & Web Growth (Target: Phase 2)
- [ ] **Interactive "BiteMap" Explorer:** Introduce the map toggle on Home using PostGIS `ST_MakeEnvelope` bounding queries and custom photo markers.
- [ ] **Public Web Catalog:** Build Next.js / Astro static landing pages (`/brand/[slug]`, `/dish/[slug]`, `/outlet/[slug]`) to capture organic Google search traffic.
- [ ] **Dish Tips & Foodie Passport:** Allow users to leave short tips (*"Ask for crispy crust"*) and share their conquest passport on Instagram/WhatsApp.

---

## 7. Summary & Key Takeaways

1. **CheapFoodMap proves that crowdsourcing velocity is driven by micro-rewards and instant feedback.** Real Bite's append-only Bites ledger is technically superior, but CheapFoodMap's UX makes contributing feel effortless.
2. **Price verification is the ideal bridge between passive browsing and photo taking.** Taking a photo requires effort; tapping *"Confirm Price ₹149"* takes 1 second and provides immediate value to other diners.
3. **The combination of visual authenticity (Real Bite) and budget/price transparency (CheapFoodMap) creates an unbeatable consumer utility.**
