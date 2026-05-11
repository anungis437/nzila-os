# Full Page Route Authority Audit

Every `page.tsx` under `apps/union-eyes/app/` enumerated, grouped by surface,
classified by status and trust posture.

Counts: **306 page.tsx total** — 33 marketing, 187 dashboard, 10 portal, 76
other (auth, locale root, debug, support, etc.). Source: `scan-snapshot.md`.

## Marketing surface (33 pages, public)

| Group | Pages |
| ----- | ----- |
| Top-level | `/`, `/contact`, `/pricing`, `/status`, `/story`, `/trust`, `/governance`, `/executive-intelligence`, `/institutional-continuity`, `/pilot-request`, `/[...slug]` |
| Case studies | `/case-studies`, `/case-studies/[slug]` |
| Insights | `/insights`, `/insights/[slug]`, `/insights/category/[slug]` |
| Features | `/features/{ai-workbench,analytics,grievance-tracking,inbox,member-portal,priorities}` |
| Platform | `/platform/{explainable-intelligence,governance-intelligence,operational-coherence,organizational-memory}` |
| Solutions | `/solutions`, `/solutions/{executive-leadership,governance-leadership,labour-leadership,operations-leadership,procurement,technology-leadership}` |

**Trust posture**: public, no auth required. Doctrine alignment audit deferred to Wave 4.

## Auth surface (8 pages, public)

`/login`, `/signup`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/magic-link`, `/invite`.

`sign-in` / `sign-up` are kept as legacy aliases to `login` / `signup`. Retire candidates — see `full-legacy-surface-elimination.md`.

## Dashboard surface (187 pages, 89 sections)

All pages under `[locale]/dashboard/` are protected by `requireUser()` (see scan).
Authorization beyond authentication is partial; gaps tracked in
`full-feature-gating-hardening.md`.

### Section verdict summary

See `full-canonical-module-inventory.md` for the per-section verdict
(`keep` / `merge` / `retire` / `gate`). The 89 top-level sections fall into:

| Verdict | Count | Action |
| ------- | ----- | ------ |
| keep (canonical, authoritative) | TBD-Wave-2 | none |
| merge (overlapping with canonical sibling) | TBD-Wave-2 | consolidate |
| retire (`LegacyRedirect` shim) | 6 | delete after grace window |
| gate (publicly reachable but should be tier-restricted) | TBD-Wave-2 | add ModuleGate |

The 6 confirmed retires (have `LegacyRedirect`):
`claims`, `deadlines`, `executive`, `grievances`, `insights`, `messages`.
All redirect to a canonical surface (Inbox / Priorities / Intelligence / Work).

## Portal surface (10 pages, ALL deprecated)

`apps/union-eyes/app/[locale]/portal/{,claims,claims/[id],claims/new,documents,dues,messages,notifications,profile,settings}`.

Every page carries a `@deprecated` marker and calls `redirect()` to the
equivalent dashboard surface. **All 10 are retire candidates.**

## Other (debug, sentry, nested specials)

`/sentry-example-page` — keep (Sentry tunnel verification).
`debug/*` — internal diagnostic; gate behind admin in Wave 2.

## Mandatory sections checklist

- [x] Marketing inventory
- [x] Auth inventory
- [x] Dashboard inventory (high-level)
- [x] Portal inventory
- [x] Verdict summary table
