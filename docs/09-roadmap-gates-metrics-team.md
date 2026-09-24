# 09: Roadmap, Decision Gates, Metrics and Team

Phases are adapted from the base report, with **Phase 1a (MVP v1)** added as the first build.

## 1. Phases and exit gates
| Phase | Timebox | Deliverables | Exit gate |
|---|---|---|---|
| **0 Foundations** | 2 weeks | Rights policy, contributor licence, consent model, Terms/Privacy drafts, catalog taxonomy, brand/outlet/menu CSVs for the 5 chains in Bengaluru, **team seed shoots start**, CDK baseline (VPC, RDS, S3, SES, ECS), screenshot eval set (60–100) | Written go/no-go on our own supply; no scraping dependency; legal review of Terms, Privacy and Bites |
| **1a MVP v1: chains** ([00](00-mvp-v1-spec.md)) | 6–8 weeks | Google + email auth · Home (brands, nearby/city outlets, earn and verify cards) · brand/outlet/item pages with evidence labels · search · upload · **screenshot share (catalog parser)** · **community verification (shadow mode)** · Bites ledger · settings (theme, legal, delete account) · admin console (CSV import, bulk seed, moderation with community tally) | ≥3 photos for the top 100 items; screenshot top-1 ≥85%; closed beta (50–200 users) shows **search coverage ≥70%** for chain searches and a useful result rate above target; community–admin agreement measured |
| **1b v1.1: trust at scale** | 3–4 weeks | Consensus auto-approval (when agreement ≥95%), retag tasks, helpful signals and ranking, appeals, abuse tooling | Agreement stays ≥95%; median time to decision < 24 h; moderator load down ≥60% |
| **2 Confidence and supply** | 6 weeks | Local independent outlets, Place Menu + "I'm here", menu-card scan, community-verified edits, **AI Gateway** (scan fallback, AI voter, menu extraction), bounties + demand log, YouTube channel index, Creator Connect, graduation logic, contributor levels | Exact-outlet results beat generic chain results in feedback; external dependency ratio falling; contribution cost per accepted image below the bounty cost |
| **3 Android bubble scan** | 4–6 weeks | Overlay module, one-frame MediaProjection, Quick Settings tile, security test, Play review package | Scan usefulness beats manual search; no critical privacy defect; Play approval |
| **4 Monetization test** | 4 weeks | RevenueCat + Play Billing, scan packs, monthly Pro, spending Bites, paywall experiments, usage counters | Conversion and retention cover content cost |
| **5 Expansion** | Ongoing | iOS release (share extension, Shortcuts, Visual Intelligence), more areas and countries (schema already global — [12](12-geography-and-relevance.md)), merchant portal, non-food pilot | Coverage and trust thresholds met in each new category and area |

## 2. MVP v1 build order (suggested sprints)
| Sprint | Mobile | Backend and infra | Admin and data |
|---|---|---|---|
| 1 | Expo scaffold, NativeWind theme (light/dark), navigation, auth screens | CDK network/data/auth/storage stacks, NestJS skeleton, Drizzle schema + migrations, JWT guard | CSV formats, brand logos, start seed shoots |
| 2 | Home (brands, area chip, nearby), brand and outlet pages | Catalog, home, search, nearby APIs; resize Lambda; CloudFront | React-Admin catalog CRUD + CSV import |
| 3 | Item gallery, upload flow (camera/gallery, consent) | Presign, photos, Rekognition safety, evidence ranking | Bulk seed upload |
| 4 | Verify screen + calibration, My uploads, Bites | Verification (assignment, gold, weights, shadow consensus), ledger, reward rules | Moderation console with community tally, gold marking |
| 5 | Screenshot share + scan result screens | `/v1/scans` + `CatalogScanParser`, aliases | Alias editor; run the screenshot eval |
| 6 | Settings, legal pages, delete account, polish, error states | Hardening: rate limits, audit log, alarms, backups | Beta seeding push; Play internal testing |

## 3. Metrics
| Metric | Definition | v1 target |
|---|---|---|
| Search coverage | Searches with ≥1 approved photo ÷ searches | ≥70% (chains) |
| Useful result rate | (helpful + saved − "not right") ÷ results viewed | Baseline in beta |
| Screenshot accuracy | Top-1 / top-3 on the eval set and from live `scans.selected_item_id` | ≥85% / ≥95% |
| Community–admin agreement | Share of admin decisions matching the community outcome | Measured; ≥95% unlocks v1.1 |
| Time to decision | Upload → approved or rejected | Median < 24 h |
| Verifier accuracy | Gold correct ÷ gold seen | Median ≥90% |
| Contribution cost | (Bites value + safety + moderation time) ÷ accepted photos | Below ₹15 |
| Fraud loss rate | Reversed Bites ÷ earned Bites | < 3% |
| Week-4 retention | Returning searchers ÷ activated | Baseline in beta |
| External dependency ratio (Phase 2+) | Tier 3 results ÷ all results | < 50% at launch, < 20% by month 6 |

## 4. Team for the first release (from the base report)
| Role | Responsibility |
|---|---|
| Product founder | Supply strategy, positioning, pricing experiments, partner talks, trust decisions |
| Mobile engineer (React Native; Android native for Phase 3) | App, share intent, OCR, later the overlay module and Play compliance evidence |
| Backend/data engineer (NestJS, Postgres, AWS) | Catalog, search, verification, ledger, media pipeline, infra, observability |
| Product designer | Evidence labels, permission explanations, the upload and verify flows, accessibility |
| Part-time content ops | Seed shoots, moderation, gold tasks, matching corrections, takedowns |
| Specialist counsel | Terms, licences, privacy notice, Bites terms, billing and tax review |

## 5. Pilot definition
- **Seeded area:** Bengaluru (India → Karnataka → Bengaluru). Searches from anywhere else still work, falling back to country then global.
- **Brands:** Domino's, Pizza Hut, Burger King, Taco Bell, California Burrito, **only as searchable chains**, with no implied partnership.
- **Expand** to local outlets (Phase 2) once chain coverage and trust metrics hold.
