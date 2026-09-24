# 03: Rights and Sources

> **Rule one:** *finding* an image and having the *right* to store, show, rank or train on it are two different things. Search engines and APIs help with the first. They almost never grant the second. (From the base report.)

## 1. Rights tiers
| Tier | Examples | Store? | Show? | Rank / train? | Role |
|---|---|---|---|---|---|
| **1 Our own** | In-app uploads (with consent), admin seed photos we took, paid seed bounties | ✅ | ✅ | Rank ✅ · train only with `photo_training` consent | **Main gallery** |
| **2 Licensed** | Food creators' archives, YouTube frames the **creator** licenses, merchant photos | ✅ within the licence | ✅ | Per licence | **Main gallery** |
| **3 Official APIs** | Google Places photos, YouTube embeds and thumbnails | ❌ (except IDs where allowed) | ✅ With attribution, per terms | ❌ | Temporary bootstrap, display only |
| **3b Open licences** | Openverse, Wikimedia Commons, Flickr (CC0 / CC BY / CC BY-SA) | ✅ Per licence, attribution kept | ✅ | Per licence | **"Similar item" tier only**, never shown as outlet evidence |
| **4 Open web** | Web and image search results, blogs, Instagram posts | ❌ | ❌ until cleared (link-outs only) | ❌ | **Finding rights holders** to approach |

The v1 MVP uses **only Tier 1**: admin seed photos we took or licensed, plus user uploads.

## 2. Evidence labels (shown on every photo)
| Label | Meaning |
|---|---|
| **This outlet** | The photo is tagged to the outlet being viewed |
| **Same brand, this city** | Same brand and item, another outlet in the same city |
| **Elsewhere in {region}** | Same brand and item, elsewhere in the region |
| **{Country}** | Same brand and item, elsewhere in the country |
| **Worldwide** | Same brand and item, another country — the fallback that keeps a screen from being empty ([12 §3](12-geography-and-relevance.md)) |
| **Real Dish team photo** | Brand-level seed photo (not tied to an outlet) |
| **Similar item** | Tier 3b generic photo (e.g. a generic Margherita). Clearly not this brand. |
| **From YouTube / From Google** | Tier 3 embed or display, with the provider's attribution |
| **No real photo yet** | Nothing verified; shows the earn prompt |

"This outlet" needs **both** the outlet match and the dish match to clear their own thresholds (base report). When in doubt, show the weaker label.

## 3. Per-source rules

### Google Places API (New)
- **May store:** `place_id` (indefinitely). Latitude/longitude are allowed for **≤30 days** only.
- **May not:** cache photos or photo names (they expire), scrape, or build our own dataset from Places content.
- **Must:** show Google attribution and the photo's `authorAttributions`, and follow the display rules.
- **Our use:**
  - outlet identity (`google_place_id`)
  - an "Outlet photos from Google" strip loaded **only on tap**
  - "Open in Google Maps" deep links.

  We don't classify Google photos by dish and don't store any derived data from them.
- Sources: [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos).

### YouTube Data API
- **Must not:** download, cache or store copies of audiovisual content, or separate or modify its audio/video (this rules out **frame extraction**).
- **Storage:** API data is kept ≤30 days (refresh or delete). IDs can be kept as references.
- **Display:** the embedded player (with `start=` for timestamps) and thumbnails, with YouTube attribution and branding.
- **Aggregation limits:** confirm the design with YouTube's **API compliance audit**, which is needed anyway for a quota increase.
- **Frames become Tier 2 only** through a written licence from the **creator** (see "Creator Connect" in [04](04-image-acquisition-and-cost.md)).
- Sources: [Developer policies](https://developers.google.com/youtube/terms/developer-policies), [Quota](https://developers.google.com/youtube/v3/getting-started).

### Open-licence images (Openverse, Wikimedia, Flickr)
- Filter to **commercial-use** licences (CC0, CC BY, CC BY-SA). Exclude NC and ND.
- Store the licence, author, source URL and attribution text with each asset. Show the attribution in the viewer.
- Use them only as **"Similar item"**, never as brand or outlet evidence.
- Source: [Openverse](https://openverse.org/about).

### Web and image search (Brave API, etc.)
- **Never ingest or display** result images. Results for "Domino's Margherita" are mostly the brand's own ads and stock photos anyway.
- Use them to **find bloggers, creators and Instagram handles** to license from. The only thing shown to users is a link-out card (title, domain, link).
- Google Custom Search JSON API: closed to new customers, **shutting down 1 Jan 2027** ([source](https://developers.google.com/custom-search/v1/overview)). Don't build on it.

### Instagram
- Show specific public posts only through official **oEmbed** (requires Meta app review), for creators found through outreach. Never scrape or store the media.

### Brand assets
- **Logos:** only to identify the brand, with a "Not affiliated with {Brand}" disclaimer, and a takedown process. Fall back to monograms if counsel prefers.
- **Never republish brand ad images** or copy menu descriptions. Item names are facts; write descriptions ourselves.

### User uploads (Tier 1)
- A plain-language licence in the Terms: the uploader grants Real Dish a non-exclusive licence to display the photo in the app and on the web.
- **Separate, optional** consents for commercial use and model training (`consents` table).
- Withdrawal: "delete my photo", "remove my name". Once a photo is withdrawn, it's removed from display promptly and excluded from any future training.
- Receipts, if offered as verification evidence, are **private**: auto-redacted and never shown.

## 4. Provenance record (required for every displayed photo)
| Question | Field(s) |
|---|---|
| Who supplied it? | `photos.source`, `uploader_user_id` |
| What permission allows its use? | `rights_tier`, `license_ref`, consent rows + version |
| Which item and outlet does it support? | `item_id`, `outlet_id` (nullable) |
| When was it taken? | `captured_at`, `created_at` |
| How was it verified? | `verification_tasks` (outcome, decided_by), safety scan result |
