# 07: Rewards ("Bites") and Community Verification

> **What ships in v1:** the earn-only ledger, rewards for uploads and pioneers, **1 Bite per correct verification vote**, and community verification in **shadow mode** (an admin decides). See [00 §4.11](00-mvp-v1-spec.md#411-community-verification-verify-photos) and [00 §8](00-mvp-v1-spec.md#8-bites-in-v1-earn-only). Everything else here is the target design, rolled out in phases.

## 1. What Bites are
- An **in-app credit**, **earned only**. It can't be transferred, **has no cash value**, and can't be cashed out.
- It expires **12 months** after being earned (spent oldest first).
- Being non-cash keeps it clear of RBI prepaid-payment-instrument rules and store real-money reward policies.
- **We never reward a positive rating or review** on any platform. Rewards are for accepted, useful contributions only.

## 2. Earn
| Action | Bites | Phase |
|---|---|---|
| Approved photo, **in-app camera + outlet chosen** | 20 | v1 |
| Approved photo from gallery, or no outlet | 8 | v1 |
| **Pioneer:** first approved photo of the item at that outlet (or brand-level) | +30 | v1 |
| **Verification vote that matches the final outcome** | **1** (≤ 20/day) | v1 |
| Geo-verified camera photo (GPS ≤150 m of the outlet) | 20 (replaces the "outlet chosen" rule) | 2 |
| Gap bonus: the item at the outlet has fewer than 5 photos | +10 | 2 |
| Bounty multiplier on requested items | 2–3× | 2 |
| Menu-card scan that adds ≥5 accepted items | 25 | 2 |
| Accepted **edit** (missing item, outlet closed or moved, alias), verified by others | 5 | 2 |
| Confirmed YouTube timestamp tag | 5 | 2 |
| "Helpful" votes on your photo | +1 each, ≤20 per photo | 2 |
| Referral (both sides), paid after the new user's first accepted upload | 50 | 2 |
| 4-week streak (≥1 approved upload each week) | +50 | 2 |

**Zero** Bites for duplicates, stock or ad photos, reposts, screenshots or unverified claims.

## 3. Spend (Phase 4, with the paywall)
| Item | Bites | Retail equivalent |
|---|---|---|
| 1 scan | 10 | ~₹2.9 (₹29 per 10 scans) |
| Day pass (24 h, fair use) | 80 | ₹19 |
| Pro, 7 days | 200 | — |
| Pro, 30 days | 700 | ₹129 |

Pro bought with Bites is granted server-side as a **RevenueCat promotional entitlement**. It isn't a store subscription, so there's no billing-policy conflict.

## 4. Controls
- **Awarded after acceptance, never at upload.**
- **Diminishing returns:** once an item × outlet has more than 30 approved photos, the base reward halves; above 100 it's 2 Bites.
- **Daily caps:**
  - 150 Bites/day total
  - 20 Bites/day from verification
  - 6 photos per outlet per user per day.
- **Hold (Phase 2):** Bites become available 48 h after approval (72 h for new accounts).
- **Reversal:** a photo removed later for a violation writes a negative `reversal` row. A negative balance blocks spending.
- **Ledger:**
  - append-only
  - every row has `idempotency_key` (e.g. `photo:<id>:approved`, `vote:<id>:matched`)
  - balances come from the `credit_balances` view.

## 5. Community verification
### How it works
- **Queue:** every user photo that passes the **safety pre-filter** (Rekognition moderation labels) becomes a `verification_task`.
- **Question:** "Is this **{item}** from **{brand}**?" The verifier sees reference photos of the same item.
- **Answers:** ✅ Yes · ❌ Different dish (optionally suggest the right one) · 🚫 Not a real food photo · ⚠ Inappropriate · Skip.
- **The outlet isn't asked about.** A photo can't prove the branch; outlet trust comes from GPS and camera capture.

### Integrity
| Control | Rule |
|---|---|
| Unlock | Verified email + a 5-question calibration tutorial (gold photos) |
| Blind voting | No uploader identity, no other votes, no location shown |
| Random assignment | Never your own uploads; never uploads from your referrer or referee, or from the same device; ≤3 tasks per uploader per verifier per day |
| **Gold tasks** | ~1 in 5 cards has a known answer; the client can't tell which |
| Vote weight | New: 0.5 · ≥90% gold accuracy: 1.0 · ≥95% and ≥200 votes: 1.5 · <70%: **0** (silently ignored, no rewards) |
| Instant escalation | One ⚠ vote → hidden and sent to moderators |
| Consensus | Approve: yes-weight ≥2.5 **and** ≥80% · Reject: negative-weight ≥2.0 **and** ≥70% · else escalate after 6 votes |
| Retag | ≥2 "different dish" votes naming the same item → retag proposal |
| Appeal | The uploader can appeal a rejection once → moderator |

### Phases
| Phase | Decider | Notes |
|---|---|---|
| **v1: shadow consensus** | **Admin** | Community tallies are shown in the console. Verifier Bites are paid against the admin's decision. The **community–admin agreement** metric is tracked. |
| **v1.1: auto** | **Consensus**, once agreement ≥95% over the last 200 decided tasks | Admin handles escalations, appeals and a **5% random audit**. Auto mode is switched off again if agreement drops below 90%. |
| **Phase 2** | Consensus + **AI pre-check as one weighted voter** (weight ≤1.0, [02b](02b-ai-gateway.md)) | Community-verified **edits** (items, outlet status, aliases, menu-card diffs) |

### Contributor levels (Phase 2)
| Level | Requirement | Perks |
|---|---|---|
| L0 New | Signup | Upload rewards at 0.5× for the first 5 accepted photos; 72 h hold |
| L1 Contributor | 10 accepted, <10% rejected | 1× |
| L2 Trusted | 50 accepted, verifier accuracy ≥90% | 1.2×; uploads need fewer votes (2) |
| L3 Local Expert | Top of the leaderboard for their area | 1.5×, badge, early access |

Rejection rate >30% → demoted one level. Confirmed fraud → ban and reversal of the Bites earned.

## 6. Anti-fraud stack
| Threat | Control | Phase |
|---|---|---|
| Internet or stock photos | Community "not real" votes; camera-first rewards; reverse-similarity via embeddings | v1 / 2 |
| Exact re-uploads | `sha256` on assets | v1 |
| Edited copies | pHash + image-embedding similarity | 2 |
| Fake location | Play Integrity, mock-location detection, GPS ≤150 m, impossible-travel | 2 |
| Multi-accounting | Device limits (≤2 earning accounts per device), referral payout after the first accepted upload | 2 |
| Vote rings | Blind + random assignment, gold tasks, per-pair limits, weight 0 below 70% accuracy | v1 |
| Unsafe content | Rekognition pre-filter, ⚠ instant hide, report queue | v1 |

## 7. Economics check
- **Regular contributor:** ≈15 accepted photos/month ≈ **450 Bites** (≈ 3 weeks of Pro).
- **Active verifier:** 20 correct votes/day → ≤20 Bites/day → ≈600/month at most. It's a slow trickle **by design** (the "very small credit" principle).
- **Our cost per accepted photo:** ≈₹0.1 safety scan + the value of the Bites (as future scans at ~₹0.02–1 of AI cost each). That's far cheaper than paid bounties (₹15–30).
- **Heavy contributors end up with free Pro.** That's intended: they are our supply.

## 8. Compliance
- **Terms:** Bites are a promotional loyalty feature, earned only, no cash value, may expire, can be adjusted for fraud.
- **Store policy:** Bites can't be bought separately from IAP products. Earned Bites unlock only in-app digital features.
