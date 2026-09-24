# 01: Feasibility and Risks

## Verdict
**Buildable. But this is a data business wearing an app's clothes.**
- The mobile app and backend are weeks of work.
- What decides success is whether a search returns **relevant, rights-cleared, recent photos** of the dish, ideally from the outlet the user is ordering from.

**Launch promise** (deliberately modest, from the base report):
> "See recent customer photos of this item, with the closest available match to your selected outlet."

It's evidence of what past orders looked like, **not** a guarantee of portion, toppings, freshness or delivery quality.

## Feasibility by capability
| Capability | Feasibility | How | Key limitation |
|---|---|---|---|
| Dish search → real photo gallery | High | A normalized catalog (brand → items), photos ranked by evidence | Cold start; photos specific to one outlet |
| Brand and outlet resolution | Medium–High | Aliases + trigram search + PostGIS nearest outlet + confidence-ranked location signals ([12 §2.3](12-geography-and-relevance.md)) | A dish name alone doesn't identify the outlet |
| Screenshot share | High | On-device OCR → catalog matching (v1), AI parsing fallback later | Varied app UIs; needs aliases and an eval set |
| Community verification | High | Blind peer votes, gold tasks, weighted consensus, admin oversight | Collusion and low-effort voting, handled with gold tasks and weights |
| Android floating bubble | Medium | `SYSTEM_ALERT_WINDOW` bubble + one-frame MediaProjection capture per tap | The system consent prompt each session; it can draw over other apps but **cannot read them** |
| iOS overlay / reading other apps | **Not viable** | Share Sheet, Shortcuts, iOS 26 Visual Intelligence (App Intents) | Don't promise an Android-style overlay on iOS |
| Place Menu (local outlets) | Medium | Menu-card scan + uploads + nearby outlet detection | Google has no menu API |
| Google Maps photos | Display only | Places API (New) with attribution, loaded on tap | Can't be cached; not tagged by dish; billed per view |
| YouTube | Display only | Data API discovery + embedded player at a timestamp | **No downloading or frame extraction**; ~100 searches/day free |
| Uploads → credits | High | Earned-only, non-cash ledger, awarded after acceptance | Fraud, privacy, copyright |
| Micro-payments | Partial | Play Billing scan packs and subscriptions via RevenueCat | ~₹10 price floor, 15% fee, 18% GST; per-search charging isn't practical |

## What must be true to win (from the base report)
1. Useful images exist for a **meaningful share of popular searches** in the launch area.
2. The branch-and-dish match is **reliable enough that users trust the evidence label**.
3. The contributor loop supplies fresh images **more cheaply than paid acquisition plus moderation**.
4. The overlay removes friction **without** creating a store-approval, privacy or trust problem.

## Why "chains first" is the right MVP
- **Menus are standardized.** One good photo of a Domino's Margherita is valid evidence for ~100 outlets ("Same brand" label). Coverage per photo is much higher than for local places.
- **Menus are public facts** and easy to put into the catalog. There's no menu API problem.
- **Screenshot matching is easy**, because the catalog is small and known, so v1 needs no AI.
- **Local outlets drop into the same schema later**: an `independent` brand with one outlet ([00 §2](00-mvp-v1-spec.md#2-how-the-data-stays-generic)).

## Competition (honest view)
| Competitor | What they have | Our difference |
|---|---|---|
| Google Maps | User photos per place, some dish tagging, Local Guides peer review | Dish-level for chains, works **across apps** (screenshot/bubble), evidence labels, food-first |
| Zomato / Swiggy | Review photos per restaurant | Neutral (not the seller), cross-platform, "ad vs reality" focus |
| Instagram / YouTube | Creator content | Structured by dish and outlet, searchable instantly |

**The real risk is that a platform copies the feature.** The mitigations: speed, the owned photo library, trust (verification), and expanding to other categories ("real product photos").

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Not enough outlet-specific photos | Empty or generic results | Chains first; seed ≥3 photos per top item; evidence labels; earn prompts on empty items; bounties ([04](04-image-acquisition-and-cost.md)) |
| Depending on unlicensed sources | Takedowns, store rejection, losing the library | Only our own and licensed photos are stored; API content is attributed and bounded ([03](03-rights-and-sources.md)) |
| Wrong branch or dish match | Loss of trust | Evidence labels, thresholds, "Not right?", community verification, retagging |
| Credit fraud / fake photos | Cost, bad gallery | Awarded after acceptance, safety pre-filter, blind peer review + gold tasks, dedupe, camera-first rewards, caps ([07](07-rewards-system.md)) |
| Low-quality peer verification | Bad photos approved | Shadow mode in v1 (admin decides); auto-decide only after ≥95% agreement; weights from gold accuracy |
| Overlay distrust or rejection | Low adoption, removal | Explicit one-shot scan, no AccessibilityService, manual search is the full experience ([05](05-scan-and-overlay.md)) |
| Privacy incident | Regulatory and reputational harm | OCR on device, screenshots never uploaded, consent records, deletion flows ([10](10-legal-compliance.md)) |
| Brand trademark objections | Takedown requests | "Not affiliated" disclaimer, logos used for identification only, takedown process, monogram fallback |
| Weak willingness to pay | Revenue below content cost | Monetize only after the coverage gate; scan packs before subscriptions ([08](08-monetization-and-unit-economics.md)) |
| Third-party API cost and quota | Cost spiral or outages | Discovery in the background, fetch once, graduation, dependency-ratio KPI ([04](04-image-acquisition-and-cost.md)) |
