# 06: Place Menu ("I'm at Rameshwaram Cafe, show me real dishes")

> **Phase 2**, after the chain MVP. The v1 outlet page ([00 §4.5](00-mvp-v1-spec.md#45-outlet-page-proposed-design)) is already a Place Menu for chain outlets. This doc adds **local independent outlets** and **"I'm here" detection**.

## 1. User story
The user walks into Rameshwaram Cafe, Indiranagar. They open Real Dish, and it asks: *"Are you at Rameshwaram Cafe, Indiranagar?"* After they tap Yes, they see the full menu, and each dish has the best real photo from this outlet. They order, snap the Ghee Podi Idli, and earn Bites.

## 2. Data: no schema change
- **The place** = `brands` row (`brand_type = 'independent'`) + one `outlets` row. A multi-branch local chain is simply `brand_type = 'chain'`.
- **The menu** = `items` under that brand (plus `outlet_items` overrides if branches differ).
- **Photos** attach to `item_id` + `outlet_id`, exactly as for chains.

## 3. Where local menus come from (Google has no menu API)
| Source | How | Trust |
|---|---|---|
| **Menu-card scan** | A user photographs the physical menu or menu board → the AI Gateway `extractMenu` returns `{category, name, price?}[]` → a proposed diff against the current menu → **community-verified edit** (Phase 2) or admin approval | Medium → high after verification |
| Upload tags | The user types a new dish name while uploading → an `item_suggestions` row → verified | Medium |
| Merchant (B2B, later) | The outlet claims its page and maintains the menu | High (labelled "From the restaurant") |
| Admin import | CSV for launch outlets | High |

**Menu-card scan rewards:** 25 Bites when ≥5 new items are accepted ([07](07-rewards-system.md)).

## 4. "I'm here" detection
- **Foreground location only.** No background geofencing: it's policy-heavy, drains the battery, and costs user trust.
- On opening the app (or pulling to refresh Home): if precise location is on, find the nearest active outlets within **100 m**. If the nearest is clearly closest (≤60 m, and 1.5× nearer than the next), show the "Are you at …?" card at the top of Home.
- **Unknown place** (not in our database): "Add this place". The user picks it from a Google Places **IDs-only** Nearby/Text Search, which is free, and we store only `place_id`. The name, locality and location are **confirmed by the user and verified by the community**, so they are our own data, not cached Google content.

## 5. Outlet page for a local place
- Same layout as chains ([00 §4.5](00-mvp-v1-spec.md#45-outlet-page-proposed-design)), plus:
  - **"Scan menu card"** button when the menu has fewer than 10 items
  - **"Snap what you ordered"** prompt when the user is detected at the outlet: geo-verified uploads earn the most
  - an empty-state checklist: "Help build this menu: scan menu (+25) · add dishes · add photos (+20 each)".
- **Evidence labels:** only "This outlet" (single branch) or "Similar item".

## 6. Upload trust at the outlet
- **Camera** plus **GPS within 150 m** of the outlet location at capture time → the "geo-verified" flag → the full reward and a ranking boost.
- **Mock-location detection** (Android `isMock`), **Play Integrity** token, and the impossible-travel check ([07](07-rewards-system.md)).

## 7. Metrics
- Share of detected visits that result in an upload.
- Menu completeness per local outlet (items with ≥1 photo ÷ items).
- Time from "place added" to "≥10 items with photos".
