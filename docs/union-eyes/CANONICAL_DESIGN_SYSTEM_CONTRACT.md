# Union Eyes operational experience contract

Mission: `UE-GLOBAL-VISUAL-ACCEPTANCE-TO-GO`.

Status: implementation and browser qualification in progress. This document is a design contract,
not evidence of staging acceptance. `UE_SAAS_OPERATIONAL_READINESS` remains `NO_GO` until the
combined release evidence supports a new ruling. Production is outside this mission.

## Authority and scope

The operational application inherits its Poppins foundation, institutional navy/electric palette
and semantic shadcn components from `apps/union-eyes/app/globals.css`. The existing Workspace
orientation hub and role execution homes remain distinct. This work does not create capabilities,
change permissions, or extend the demonstration application.

## Shared composition

The dashboard layout owns the application shell, responsive header, context region and content
boundary. Pages own their truthful content and operational actions. Use `PageHeading` for a title,
description, optional eyebrow and action group. Do not introduce a nested application shell or a
second viewport-height clipping container inside a page.

| Element | Contract |
| --- | --- |
| Typeface | Poppins; system fallback; monospace only for identifiers and evidence hashes |
| Page title | 24–30px responsive, weight 600, line height 1.25 |
| Section title | 20px, weight 600, line height 1.4 |
| Description | 15px, line height 1.6, maximum 65 characters per line |
| Content | Maximum 90rem; minimum width zero inside flex/grid; normal document scrolling |
| Page spacing | 16px at narrow widths, increasing to 32px; sections remain distinguishable |
| Primary action | Semantic `primary` / `primary-foreground`, derived from institutional electric |
| Secondary action | Existing outline/secondary Button variants; wrap labels instead of clipping |
| Surfaces | Semantic `card`, `card-foreground`, `border`; no glass or hover lift on static cards |
| Tabs | Wrapping tab list, readable labels, Radix keyboard behavior, minimum 44px trigger height |
| Forms | Existing Input/Select/Label primitives; explicit labels; errors remain adjacent to fields |
| Tables | Existing Table scroll container; preserve column meaning and keyboard-reachable overflow |
| Status | Text first; semantic destructive/success/warning only for actual states, never decoration |
| Empty/error/loading | Distinguish no records, unavailable data and pending data; no fabricated success |
| Motion | No routine dashboard entrance delay; retain meaningful progress indicators |
| Focus | Visible two-pixel semantic ring with offset; modal focus containment and restoration |

## Navigation

Destination identity includes normalized path and owned query parameters. The most specific matching
destination is selected; `aria-current` and visual treatment use the same result. Unrelated filters
must not select a different destination. No duplicate target is presented as another functional page.
Long labels wrap. Collapsed navigation retains accessible names and titles. French navigation copy
comes from the existing message catalogs. Authorization-aware filtering remains authoritative for
presentation; server authorization remains authoritative for access.

## Responsive header and layers

The menu trigger is in the header flow. The environment region occupies its own layout space.
Header controls wrap and the organization control shrinks; breadcrumbs cannot displace controls.
Safe-area insets are respected. The header uses layer 20, and modal/drawer primitives use layer 50.
The navigation drawer uses the existing Radix dialog implementation for focus, Escape and inert
background behavior. Critical controls must pass geometry, hit-testing and actual interaction checks.
Document-level overflow measurements alone are insufficient.

## First visit

Required privacy choice precedes authenticated organization context, then onboarding, then optional
guidance. Missing, malformed or expired consent is not acceptance. Rejection of optional cookies is
a valid decision. Consent choices and preference management remain explicit; no stored value is
silently changed. The first privacy decision is a scrollable accessible dialog. Onboarding waits for
the decision and resolved user/organization, then occupies document flow rather than a competing
fixed overlay.

## Qualification and regression evidence

Generate the actual route inventory with `scripts/experience-route-inventory.ts`. Its static route
and guard observations are not runtime proof. Include non-navigation routes and record exact missing
parameters or permission fixtures. Browser classification must distinguish rendered pages, expected
denials/redirects, unexpected redirects, errors, missing implementations and loading states.

Qualify English and French at widths 360, 375, 390, 430, 768, 1024 and 1440. Include member, staff,
executive, governance and administrator fixtures that actually possess the required permissions.
Check first visit, normal, empty, loading, validation and failure states where supported. Only test
themes the application actually exposes.

Every baseline image requires route, role, locale, viewport, page state, exact source SHA, image and
revision identity, timestamp and capture hash. Wait for fonts and observed content stability, not a
fixed ten-second delay. Do not disable animations to conceal failures. Compare matching conditions;
classify intended changes, regressions and unqualified differences. Structural failures block release.

Final source needs all five repository checks, fresh security regressions, normal protected integration,
exact image identification, native staging acceptance and the remaining operational release gates.
Neither this contract nor attractive screenshots authorize staging cutover.
