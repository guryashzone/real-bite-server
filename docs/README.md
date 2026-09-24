# Real Bite: Documentation

> **Real Bite** shows what a dish *actually* looks like: real customer photos of a menu item, matched as closely as possible to the outlet you're ordering from. It starts with food (India, Android-first) and is designed to extend to other categories later.

**Base report:** [`Reality Images Product Feasibility Report.docx`](../Reality%20Images%20Product%20Feasibility%20Report.docx). That report is the source for the rights tiers, evidence labels, one-frame scanning, pilot size, decision gates and metrics. These docs build on it.

---

## Start here

| If you want… | Read |
|---|---|
| **What we're building right now** (chain-brand MVP) | [00-mvp-v1-spec.md](00-mvp-v1-spec.md) |
| Whether the whole idea is viable | [01-feasibility-and-risks.md](01-feasibility-and-risks.md) |
| System design (AWS + NestJS) | [02-architecture.md](02-architecture.md) |
| How AI is plugged in (any provider, any model) | [02b-ai-gateway.md](02b-ai-gateway.md) |
| Which photo sources we may store vs only display | [03-rights-and-sources.md](03-rights-and-sources.md) |
| Cheapest way to get images, and how to stop depending on third parties | [04-image-acquisition-and-cost.md](04-image-acquisition-and-cost.md) |
| Screenshot scan + Android floating bubble + iOS options | [05-scan-and-overlay.md](05-scan-and-overlay.md) |
| "I'm at Rameshwaram Cafe, show me real Bitees" | [06-place-menu.md](06-place-menu.md) |
| Upload-to-earn credits ("Bites") and anti-fraud | [07-rewards-system.md](07-rewards-system.md) |
| Pricing, paywall, unit economics | [08-monetization-and-unit-economics.md](08-monetization-and-unit-economics.md) |
| Phases, exit gates, metrics, team | [09-roadmap-gates-metrics-team.md](09-roadmap-gates-metrics-team.md) |
| Legal and compliance checklist | [10-legal-compliance.md](10-legal-compliance.md) |
| **Geography: global identity, local ranking** | [12-geography-and-relevance.md](12-geography-and-relevance.md) |
| **Backend v1: our auth, tables, API** | [11-backend-mvp1.md](11-backend-mvp1.md) |

---

## One-page summary

**Verdict:** buildable. **The hard problem is data, not the app.** The app is weeks of work. The moat is a library of dish-tagged, outlet-tagged photos that we hold the rights to.

**Decisions so far:**
- **Mobile:** Expo / React Native, Android first.
- **Backend:** AWS (Mumbai, `ap-south-1`) + NestJS + PostgreSQL with PostGIS.
- **AI:** provider-agnostic. Every AI task goes through an internal *AI Gateway*, so any model on any platform can be configured per task without a code change.
- **Sourcing:** legit-first, **no scraping**.
  - Our own uploads and licensed photos are the photo library.
  - Official APIs (Google Places photos, YouTube embeds) are display-only bootstrap sources.
- **The MVP starts narrow.**
  - Well-known chains only: Domino's, Pizza Hut, Burger King, Taco Bell, California Burrito.
  - Admin-uploaded seed photos plus user uploads.
  - **Community verification** (other users check uploads, Google Maps-style; an admin makes the final call in v1).
  - **Screenshot share** (text read on the device, then matched to our catalog; the image never leaves the phone).
  - Google or email/password login.
  - No YouTube, AI or paywall yet.
  - The schema is generic, so local independent outlets fit later without a redesign.
- **Launch promise (honest):** *"See recent customer photos of this item, with the closest available match to your selected outlet."* Every photo carries an **evidence label**:
  - Same outlet
  - Same brand nearby
  - Elsewhere in the region · in the country · worldwide
  - Similar item
  - No verified customer photo yet.

**Key numbers (working assumptions, ₹88 = $1):**
| Item | Value |
|---|---|
| Pilot size | 1 seeded area (Bengaluru), 30–50 outlets, 100–150 dishes, ~750 owned photos |
| One-time bootstrap photo budget | ≈ ₹55k (creator licensing + seed bounties + team shoots) |
| AI cost per scan (OCR text → structured parse) | ≈ ₹0.02–1, depending on the model tier chosen |
| MVP AWS run cost | ≈ $60–150 / month |
| Free tier (once monetized) | 3 scans / month + unlimited catalog browsing |

## Conventions
- Prices are in ₹ and include GST unless stated. Store fees are assumed at 15%.
- All third-party limits and prices were checked in September 2026. **Re-verify before launch.** Sources are linked inline.
