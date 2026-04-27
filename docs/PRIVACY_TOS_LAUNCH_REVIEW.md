# Privacy / Terms launch review (Lane D)

Goal: before public launch, confirm Kinetix privacy and terms accurately describe what the product does and what data flows through it.

## Cross-references

- Bookiji workspace standard: `docs/standards/PRIVACY_AND_DATA_USE.md` (umbrella - confirm path).
- Kinetix product scope: [`../PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md)
- Stripe billing contract: [`deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md)
- Garmin partner posture: [`GARMIN_CONNECT_DEVELOPER_PROGRAM.md`](GARMIN_CONNECT_DEVELOPER_PROGRAM.md)

## Data inventory (must match privacy policy)

| Data | Source | Stored where | Retention | Shared with |
|------|--------|--------------|-----------|-------------|
| Email + Supabase auth | User sign-in (magic link / Google OAuth) | `auth.users`, `platform.profiles` | Active account | Supabase (sub-processor) |
| Subscription / payment | Stripe checkout | Stripe (PCI scope) + entitlements only in our DB | Subscription lifecycle | Stripe (sub-processor) |
| Activities / runs | User upload, Strava/Withings/Garmin sync | `kinetix.activities` | Active account; deletable on request | None |
| Health metrics (sleep/HRV/stress) | Withings, Garmin (when live) | `kinetix.health_metrics` | 18 months rolling | None |
| Coach conversation transcripts | `/api/ai-chat` | `kinetix.coach_messages` (or equivalent) | 12 months for training; deletable on request | AI provider per `monorepo-packages/ai-runtime` (sub-processor) |
| Support tickets / KB | Help Center | `kinetix_support_tickets` and `kinetix_support_kb` | Active account | None |
| iOS / watchOS health data | HealthKit on-device | On-device only; sync subset over Watch Connectivity | Per Apple guidelines | None |

## Privacy policy checklist

- [ ] Each data row above is described in plain language.
- [ ] Sub-processors listed (Supabase, Stripe, AI provider, Strava/Withings/Garmin/Apple).
- [ ] Cross-border transfer disclosure (Supabase region, Stripe regions).
- [ ] User rights (access, deletion, export) and how to exercise them.
- [ ] Children's privacy: Kinetix is 13+ (or 16+ in EEA) - confirm.
- [ ] AI usage disclosure: when conversation excerpts are sent to model providers, what is sent (no payment data, no raw HR series), and any opt-out.
- [ ] Cookie / local storage description matches `apps/web/src/lib/clientStorageScope.ts`.
- [ ] Contact for privacy requests (privacy@bookiji.com or equivalent live address).

## Terms of service checklist

- [ ] Subscription terms match Stripe configuration (price, billing cadence, free trial if any).
- [ ] Refund policy stated.
- [ ] Acceptable use (no scraping, no reverse engineering).
- [ ] Disclaimer that Kinetix is a coaching tool, not medical advice.
- [ ] Liability cap and arbitration clause (legal review required).
- [ ] Account termination by us / by user.
- [ ] Governing law / jurisdiction.
- [ ] Contact for legal notices.

## App Store specific (Lane B coordination)

- Apple privacy questionnaire answers must align 1:1 with this document. The Lane B agent maintains [`docs/IOS_LAUNCH_CHECKLIST.md`](IOS_LAUNCH_CHECKLIST.md) and uses the data inventory above.
- Watch + iPhone health data is "Linked to user / used for app functionality" only; never used for tracking.

## Operator action queue

- [ ] Legal review: privacy + terms drafts (counsel turnaround).
- [ ] Publish privacy policy at `https://kinetix.bookiji.com/privacy` (or canonical Bookiji URL).
- [ ] Publish terms at `https://kinetix.bookiji.com/terms`.
- [ ] Update Help Center "About" section with both links.
- [ ] Update App Store listing (Lane B7) with the live URLs.
- [ ] Update Garmin application brief ([`GARMIN_CONNECT_APPLICATION_BRIEF.md`](GARMIN_CONNECT_APPLICATION_BRIEF.md)) "Privacy policy URL" cell with the live link.
