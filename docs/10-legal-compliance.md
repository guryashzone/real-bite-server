# 10: Legal and Compliance Checklist

> This is a working checklist, not legal advice. **Specialist counsel should review** the Terms, Privacy, the contributor licence, the Bites terms, billing and tax before launch. Platform rules change often, so re-verify them at launch.

## 1. Privacy: India DPDP Act 2023
- [ ] A **plain-language notice** at signup, plus separate consent records (`consents`) for: terms, privacy, photo display, commercial use of photos, model training, location.
- [ ] **Data minimization:**
  - screenshots are processed on the device and **never uploaded**
  - only redacted OCR lines are sent, and they're not stored
  - `scans` keeps matched IDs only
  - `capture_location` is private.
- [ ] A **retention schedule**, published:
  - originals of rejected photos deleted after 30 days
  - deleted accounts purged after 30 days
  - logs kept 90 days.
- [ ] **Rights:** access, correction, deletion (**in-app account deletion plus a web deletion link**, which Google Play also requires), withdrawal of consent (photo removed from display, excluded from training).
- [ ] A named **grievance officer** and contact; a breach response plan.
- [ ] **Data residency:** AWS `ap-south-1` (Mumbai).
- Source: [DPDP Act 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf).

## 2. User-generated content: IT Rules 2021 (intermediary)
- [ ] Terms and Content Guidelines banning unlawful, obscene, infringing or misleading content.
- [ ] **Report** on every photo (reasons incl. copyright and privacy); takedown within the required timelines; a grievance mechanism.
- [ ] Moderation audit trail (who decided what, when): `photos.reviewed_by`, `verification_tasks.decided_by`, admin audit log.
- [ ] **Fairness to restaurants:** a right of reply and dispute queue (Phase 2 merchant tools). Photos are labelled as evidence of past orders, not claims about current quality.

## 3. Copyright and trademarks
- [ ] **Contributor licence** in the Terms: a non-exclusive licence to display; **separate opt-ins** for commercial use and training; the uploader promises it's their own photo.
- [ ] **Seed photos:** team-shot or licensed only; `license_ref` recorded.
- [ ] **Creator licences** (Phase 2): scope, term, territory, derivatives, training, revocation.
- [ ] **CC images:** commercial-OK licences only (CC0, BY, BY-SA); attribution stored and displayed.
- [ ] **No scraping, and no republishing of brand ad images or menu copy.** Item names only (facts).
- [ ] **Brand names and logos** used for identification only, with a "Not affiliated with {Brand}" disclaimer. A takedown path for brand owners. Monogram fallback.
- [ ] A copyright (DMCA-style) notice process.

## 4. Third-party API terms (Phase 2+)
- [ ] **Google Maps Platform:** attribution; cache nothing except `place_id` (lat/lng ≤30 days); no scraping; photos loaded fresh on tap. [Policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [ ] **YouTube API Services:**
  - embedded player only
  - no downloading, caching or separating of audio/video (**no frame extraction**)
  - data ≤30 days
  - branding and attribution
  - pass the **API compliance audit** before requesting more quota.
  - [Developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [ ] **Instagram oEmbed:** Meta app review, embed only.
- [ ] **AI providers:** configure the no-training / zero-retention options where offered; redact inputs; keep a sub-processor list in the Privacy policy.

## 5. Google Play
- [ ] **Privacy policy URL** and an accurate **Data safety** form (location, photos, account info, app activity; SDKs included: Sentry, Google Sign-In).
- [ ] **Account deletion:** in-app, plus a web link in the listing.
- [ ] **UGC policy:** reporting, blocking, moderation, Terms acceptance before posting.
- [ ] **Permissions:** location (foreground only), camera, photos (use the system photo picker where possible, avoiding broad media permissions).
- [ ] **Phase 3 overlay:**
  - `SYSTEM_ALERT_WINDOW` justification
  - `mediaProjection` foreground-service declaration
  - a demo video
  - prominent disclosure
  - **no AccessibilityService**.
  - [Accessibility policy](https://support.google.com/googleplay/android-developer/answer/10964491)
- [ ] **Billing (Phase 4):** Play Billing for digital goods; User Choice Billing only after review. [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [ ] **Rewards:** Bites have no cash value and can't be cashed out; never reward ratings or reviews.

## 6. Apple (Phase 5)
- [ ] IAP for digital features (3.1.1); screen-recording consent rules; no claims of an overlay feature. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## 7. Consumer and advertising
- [ ] Honest claims: "recent customer photos, closest available match", **never** "exactly what you'll get".
- [ ] Clear evidence labels; "Similar item" never presented as brand or outlet evidence.
- [ ] Transparent Bites terms (earning, expiry, adjustment for fraud).

## 8. Tax and billing
- [ ] Store prices include GST; the stores collect and remit GST for in-app purchases. Confirm the entity's GST registration and invoicing needs.
- [ ] Paid seed bounties and creator fees: contributor agreements, TDS/GST treatment, payout records.
