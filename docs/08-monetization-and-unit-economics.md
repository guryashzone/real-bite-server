# 08: Monetization and Unit Economics

> **There's no paywall in v1.** We monetize only after the coverage gate: searches reliably return useful evidence (base report). Until then, the scarce resource is coverage, not search execution.

## 1. Offers (starting hypotheses to A/B test)
| Offer | Price | Includes | Notes |
|---|---|---|---|
| **Free** | ₹0 | **3 scans/month**, unlimited catalog search and browsing, uploads, verification | Accepted uploads earn Bites, which buy scans |
| **Scan pack** | ₹29 / 10 scans (test 5 vs 10) | Consumable IAP | The realistic form of "per-search" charging |
| **Monthly (Pro)** | ₹99–129 | More scans (fair use ~15/day), saved lists, **alerts when a requested dish gets photos**, the floating bubble (Phase 3), outlet filters | Must give ongoing value, not just a quota |
| **Day access** | ₹19 | 24 h, fair use ~25 scans, non-renewing | Test later. Don't lead with it, and never label it a subscription. |
| **Yearly** | ~₹899 | Pro | Only after monthly retention is proven |

**What's metered:** screenshot, bubble and visual-intelligence lookups. **Text search is never metered**, because it costs us almost nothing and builds the habit.

## 2. Store billing
- **Android:** Google Play Billing for subscriptions and consumables, managed through **RevenueCat**, with server-verified entitlements (webhook → `entitlements`).
- **iOS:** In-App Purchase (guideline 3.1.1).
- **UPI / Razorpay in-app:** only through Play's **User Choice Billing** program in India, after specialist review. It's not the default.
- **Price floor:** ~₹10 on both stores. Prices include GST.

## 3. What we keep from each sale
| Price | ÷ 1.18 GST | × 0.85 (15% store fee) | We keep |
|---|---|---|---|
| ₹129/month | ₹109.3 | ₹92.9 | **≈ ₹93** |
| ₹29 pack | ₹24.6 | ₹20.9 | **≈ ₹21** (₹2.1 per scan) |
| ₹19 day | ₹16.1 | ₹13.7 | **≈ ₹14** |
| ₹10 day | ₹8.5 | ₹7.2 | ≈ ₹7: too thin, which is why ₹19 is the default |

## 4. Our costs (₹88 = $1)
| Cost | Per unit | Notes |
|---|---|---|
| Screenshot scan, v1 (catalog parser) | **≈ ₹0** | On-device OCR + a database query |
| Screenshot scan, AI fallback | ≈ ₹0.02–1 | Depends on the model tier configured ([02b](02b-ai-gateway.md)); only used on low-confidence scans |
| Safety pre-filter | ≈ ₹0.09 per photo | Rekognition, ~$1 per 1k images |
| Photo storage and CDN | < ₹0.05 per photo per month | WebP derivatives |
| Google Places photos (Phase 2) | ~₹0.6 per photo view | On tap only; graduation removes it |
| AWS base | ≈ $60–150 / month | [02](02-architecture.md) |

**A typical Pro user** (30 scans/month, ~20% needing AI) costs **< ₹10/month** against ≈₹93 kept.

**The expensive part is acquiring a useful photo, not serving one.** Spread the accepted-photo cost over the views it gets later ([04](04-image-acquisition-and-cost.md)).

## 5. Per-user contribution (track by plan and cohort)
```
contribution = net receipts after store fee and GST
             − (AI + storage + safety + external API + support + incentive (Bites redeemed) + refunds)
```

## 6. Metrics that decide pricing (from the base report)
| Metric | Formula | Use |
|---|---|---|
| Search coverage | searches with a rights-cleared result ÷ total searches (split by exact-outlet vs brand) | **Primary launch-readiness gate** |
| Useful result rate | (saved + helpful) − mismatch reports, ÷ results viewed | Better than raw photo count |
| Contribution cost | (incentives + moderation + storage) ÷ accepted useful images | Compare the flywheel with bounties and licensing |
| Paid conversion | purchasers ÷ eligible users who saw a useful result | Willingness to pay for evidence |
| Week-4 retention | returning searchers ÷ activated users | Whether monthly pricing is justified |
| Fraud loss rate | reversed Bites ÷ Bites earned | Sets verification friction |
| External dependency ratio | Tier 3 results ÷ all results | Cost and risk trend ([04](04-image-acquisition-and-cost.md)) |

## 7. Later revenue
- **Merchant tools (B2B):** claim an outlet, maintain the menu, reply to photos, a "real-photo verified" badge, **sponsored bounties** (the restaurant funds Bites for photos of its new dish). Merchant photos are always labelled and **can never suppress user evidence**.
- **Affiliate deep links** to order, where a program exists.
- **Other categories:** "real product photos" for e-commerce, using the same engine.
