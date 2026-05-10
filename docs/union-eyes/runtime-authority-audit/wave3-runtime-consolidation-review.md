# Wave 3 — Runtime Consolidation Review

> Authoritative record of the Wave 3 runtime reduction. This document is
> generated from the live Wave 1 / Wave 2 / Wave 3 working set and reflects
> *only* what is committed to the repository. Where Wave 3 reduced surface, the
> reduction is recorded as a delta against the Wave 1 scan snapshot.

## Provenance

- Branch: `feat/trustcore-trust-ops-v1`
- Wave 1 commit (audit foundation): `6a65c0d55`
- Wave 2 commit (gating hardening + 16 deny tests): `fbd999cee`
- Wave 3 Phase A commit (sovereignty gates + nav convergence): `26462f3de`
- Wave 3 Phase B commit (Tier A/B deletions + sovereignty deny tests): _this commit_
- Pre/post scan executed via Windows native `dir /s /b` over `apps\union-eyes\app`.

## Deleted route inventory

### Tier A — `portal/*` member surface (10 routes removed)
The legacy member portal at `app/[locale]/portal/` was a thin redirect tree
duplicating the consolidated `dashboard` surface. Every page issued a
server-side `redirect()` to its `dashboard` equivalent; no business logic,
data fetching, or component composition was unique to it.

| Removed route | Replacement |
|---|---|
| `portal/page.tsx` | `dashboard` |
| `portal/layout.tsx` | `dashboard/layout.tsx` |
| `portal/claims/page.tsx` | `dashboard/inbox?type=intake` |
| `portal/claims/new/page.tsx` | `dashboard/claims/new` |
| `portal/claims/[id]/page.tsx` | `dashboard/claims/[id]` |
| `portal/documents/page.tsx` | `dashboard/documents` |
| `portal/dues/page.tsx` | `dashboard` (member finance) |
| `portal/messages/page.tsx` | `dashboard/inbox?type=message` |
| `portal/notifications/page.tsx` | `dashboard/inbox` |
| `portal/profile/page.tsx` | `dashboard/profile` |
| `portal/settings/page.tsx` | `dashboard/settings` |

### Tier B — Dashboard `LegacyRedirect` shims (6 routes removed)
Wave 2 had already gated these surfaces; Wave 3 deletes the soft-redirect
pages outright now that all inbound references have been repointed to the
consolidated canonical surface.

| Removed route | Canonical destination |
|---|---|
| `dashboard/claims/page.tsx` | `dashboard/inbox?type=intake` |
| `dashboard/grievances/page.tsx` | `dashboard/work` |
| `dashboard/messages/page.tsx` | `dashboard/inbox?type=message` |
| `dashboard/deadlines/page.tsx` | `dashboard/priorities` |
| `dashboard/executive/page.tsx` | `dashboard/intelligence?scope=executive` |
| `dashboard/insights/page.tsx` | `dashboard/intelligence?scope=federation` |

> Note: The `claims/` segment is retained because `claims/new/page.tsx` and
> `claims/[id]/page.tsx` remain canonical (intake form + case detail).
> The `grievances/` segment is retained for the same reason
> (`grievances/[id]/page.tsx` is the case detail surface).

### Tier C — Deferred (auth surface)
`app/[locale]/sign-in/page.tsx` and `app/[locale]/sign-up/page.tsx` are
**deferred** to Wave 4. Rationale:
- Both surfaces have inbound links from external auth-provider callbacks
  (Entra redirect URIs configured against these paths).
- Marketing CTAs across `(marketing)/*` route to these surfaces.
- Removal requires an analytics window confirming zero inbound from
  external IDPs, which is out of scope for Wave 3.

## Retained canonical routes

The Wave 3 reduction does not affect any of the seven canonical operational
surfaces:
- `dashboard/inbox` — all member intake + messages + notifications
- `dashboard/work` — steward/officer representation queue
- `dashboard/priorities` — outcome-driven assignments
- `dashboard/intelligence` — federation + executive analytics
- `dashboard/governance` — explainability + audit
- `dashboard/institutional-memory` — institutional continuity
- `dashboard/cognition` — sovereignty layer (system_admin)

## Gating expansion

Wave 3 added six server-side `layout.tsx` gates (route-prefix protection via
`requireUser` + `hasMinRole`). Total layout-level gates after Wave 3: 18
(12 from Wave 2 + 6 from Wave 3).

| Layout | Min role | Numeric level | Doctrine layer |
|---|---|---|---|
| `dashboard/cognition/layout.tsx` | `system_admin` | 200 | Sovereignty |
| `dashboard/longitudinal-cognition/layout.tsx` | `system_admin` | 200 | Sovereignty |
| `dashboard/security/layout.tsx` | `admin` | 140 | Governance Operations+ |
| `dashboard/customer-success/layout.tsx` | `admin` | 140 | Internal admin |
| `dashboard/operations/layout.tsx` | `officer` | 80 | Operational management |
| `dashboard/ops/layout.tsx` | `system_admin` | 200 | Internal operational |

E2E coverage for these gates: 10 new deny scenarios in
`apps/union-eyes/e2e/authenticated-role-navigation.spec.ts` (member→all six
sovereignty surfaces; steward→cognition/longitudinal-cognition/customer-success/ops).

## Navigation convergence

Wave 3 Phase A normalized navigation across three composition points:

1. **`components/dashboard-navbar.tsx`** — replaced legacy `Claims` /
   `Grievances` items with canonical `Cases (→ inbox?type=intake)` /
   `Representation (→ work)`.
2. **`lib/dashboard/role-experience.ts`** — `member` and `staff` experience
   navigation arrays repointed entirely off `/dashboard/{claims,messages,workbench}`
   and onto `/dashboard/{inbox,work,priorities}` canonical paths.
3. **`(marketing)/locale-site-navigation.tsx`** — removed the duplicated
   "Modules" dropdown (6 entries shadowing the `Solutions` taxonomy);
   marketing primary nav now points to a single solutions taxonomy.

Inbound link repointing (Phase B):
- `dashboard/claims/[id]/page.tsx` — back-link `claims` → `inbox?type=intake`
- `dashboard/claims/new/page.tsx` — submit-success redirect + cancel link → `inbox?type=intake`
- `e2e/dashboard.spec.ts`, `e2e/cape-features.spec.ts`,
  `e2e/stakeholder-demo-journeys.spec.ts` — shim references replaced with
  canonical destinations.
- `messages/{en-CA,en,fr-CA}.json`, `public/manifest.json` — PWA shortcut
  + footer copy retargeted.

## Doctrine normalization

Wave 3 lightly normalized user-visible doctrine where it intersected the
nav convergence:
- Footer key "Modules" → "Capabilities" (en-CA, en, fr-CA).
- Navbar label "Claims" → "Cases".
- Navbar label "Grievances" → "Representation".
- Marketing dropdown "Modules" removed (collapsed into Solutions).

Deeper doctrine work (workspaces / centres / reasoning workbench framing
across deep-link surfaces) remains in the Wave 4 queue documented in
`full-doctrine-alignment-sweep.md`.

## Runtime reduction metrics

Scan executed via `dir /s /b apps\union-eyes\app\*page.tsx` (Windows).

| Metric | Wave 1 baseline | Wave 3 (post) | Delta |
|---|---:|---:|---:|
| `page.tsx` count | 306 | 290 | −16 |
| `portal/*` pages | 10 | 0 | −10 |
| Dashboard `LegacyRedirect` shims | 6 | 0 | −6 |
| Deferred Tier C surfaces (sign-in/sign-up) | 2 | 2 | 0 |
| Gated `layout.tsx` (Wave 2 + Wave 3) | 0 | 18 | +18 |
| Cross-role deny scenarios in E2E | 5 | 31 | +26 |

> Routes (`route.ts`) and other `layout.tsx` files were not Wave 3 targets;
> their counts (867 / 31) are recorded for provenance only.

## Stakeholder-boundary verdicts

| Stakeholder band | Verdict | Notes |
|---|---|---|
| Member (lvl 20) | **GO** | All 16 deleted routes either were redirect shims or pointed to canonical surfaces members already access. Member visibility unchanged; clarity improved. |
| Steward (lvl 50) | **GO** | Representation surface now has a canonical home (`work`); legacy `grievances` list shim removed. |
| Officer (lvl 80) | **GO** | New `operations/` gate is at officer level; existing Wave 2 officer-gated surfaces unchanged. |
| Executive (lvl 130–170) | **GO** | Executive intelligence consolidated into `intelligence?scope=executive`; old `executive` shim removed. |
| Governance (admin lvl 140) | **GO** | New `security/` and `customer-success/` gates at admin level. |
| Sovereignty (system_admin lvl 200) | **GO** | Cognition / longitudinal-cognition / ops / customer-success now layout-gated; deny tests cover member + steward. |
| Continuity / monetization | **CONDITIONAL GO** | Tier C deferral (sign-in/sign-up) is a known carry-over; analytics window required before Wave 4 cleanup. |

## Final verdict

**GO — with one CONDITIONAL GO carry-over (Tier C auth surfaces, deferred
to Wave 4).**

Wave 3 delivered:
- 16 real route deletions (10 Tier A + 6 Tier B).
- 6 sovereignty / governance-ops gates with passing E2E deny coverage.
- Canonical nav convergence across navbar + role-experience + marketing.
- Inbound-reference repointing across 5 source files + 3 E2E specs.
- Doctrine copy normalization on user-visible navigation labels.

No mandatory section is left as documentation-only; every section in this
review corresponds to a code change committed in Wave 3 Phase A or
Phase B.
