# UNION EYES MOBILE READINESS

Date: 2026-04-23
Scope: Mobile readiness for pilot-critical Union Eyes workflows

## Reality Snapshot

What is implemented:

- Dedicated mobile layout and navigation:
  - `apps/union-eyes/app/[locale]/mobile/layout.tsx`
  - `apps/union-eyes/app/[locale]/mobile/page.tsx`
  - `apps/union-eyes/app/[locale]/mobile/claims/page.tsx`
- Mobile routes are live and return HTTP 200 on app host.

What was runtime-validated in this pass:

- `/en-CA/mobile` -> 200
- `/en-CA/mobile/claims` -> 200
- `/en-CA/dashboard/claims` -> 307 (auth/redirect behavior expected for protected dashboard route)

## Mobile UX Assessment

| Area | Status | Notes |
|---|---|---|
| Mobile shell/nav | PASS | Dedicated layout and bottom nav present |
| Mobile claims list | PASS WITH CONDITIONS | Card-based list and filter tabs implemented; depends on API and local cache quality |
| Mobile auth entry points | PASS WITH CONDITIONS | Login/signup routes reachable; full authenticated flow not fully replayed in this audit |
| Dashboard on mobile | PASS WITH CONDITIONS | Protected dashboard exists; no full viewport walkthrough for all dashboard pages |
| Form/tap ergonomics | PASS WITH CONDITIONS | Mobile-specific pages look touch-oriented in code; cross-device rendering not exhaustively tested |
| Table-heavy admin/settings surfaces | FAIL for "mobile-first" expectation | Many enterprise settings pages are desktop-oriented and should be documented as desktop-preferred |

## Pilot Guidance

Pilot-safe mobile scope:

- Member and steward lightweight interactions on dedicated mobile pages.
- Login entry and claim list/detail interactions verified during pilot onboarding.

Pilot exclusions (desktop-preferred):

- Deep admin/settings/configuration surfaces.
- Table-heavy operational screens without mobile-specific variants.

## Required Hardening Before Production

1. Add Playwright mobile viewport suite for:

- login,
- claims list/detail,
- one end-to-end core case workflow,
- dashboard quick actions.

2. Add explicit desktop-preferred labels on pages that are not optimized for phone/tablet.

3. Add overflow/touch-target checks to CI for critical screens.

## Verdict

- Mobile readiness for pilot: PASS WITH CONDITIONS.
- Mobile readiness for production-wide claim: FAIL (not all surfaces are proven mobile-ready).
