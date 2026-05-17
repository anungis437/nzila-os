# Wave 4 — Implementation Report

**Posture**: additive · governance-safe · procurement-safe · runtime-stable.

## Files Modified

| # | File | Change | Nature |
|---|---|---|---|
| 1 | `apps/union-eyes/lib/dashboard/role-experience.ts` | `Operational Review` → `Continuity Review` (governance nav, line 124) | Display string only; `href: '/dashboard/workbench'` preserved |
| 2 | `apps/union-eyes/components/mobile/BottomNav.tsx` | Added `'Continuity Review': Briefcase` icon-map alias (kept `'Operational Review'` entry for fixture compatibility) | Additive only |
| 3 | `apps/union-eyes/e2e/helpers/role-fixtures.ts` | `'Operational Review'` → `'Continuity Review'` in `governance` allowed-labels block | Test fixture sync |
| 4 | `apps/union-eyes/app/[locale]/dashboard/clc/page.tsx` | Metadata `title` + `description` + inline H1 `defaultValue` rewritten | Display + SEO metadata only; route slug `/dashboard/clc` preserved |
| 5 | `apps/union-eyes/messages/en.json` | 5 strings: `clcDashboard`, `operational`, `clc.executive.title`, `staff.dashboard.executiveDashboard`, `clc.dashboard.title`+`description` | Locale bundle (display only) |
| 6 | `apps/union-eyes/messages/en-CA.json` | Identical 5-string mirror of `en.json` | Locale bundle (display only) |
| 7 | `apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts` | Added `wave4LanguageConvergence: ForbiddenTerm[]` (15 hard-fail terms) and registered in `FORBIDDEN_VOCABULARY` spread between `wave3ContinuityCognition` and `warningLevel` | Narrative-governance additive |

## Before / After (Display Strings)

### Navigation
- **role-experience.ts:124** `{ label: 'Operational Review', href: '/dashboard/workbench' }` → `{ label: 'Continuity Review', href: '/dashboard/workbench' }`

### CLC Route Metadata (`app/[locale]/dashboard/clc/page.tsx`)
- `title`: `'CLC Executive Dashboard | UnionEyes'` → `'CLC Continuity Coordination | UnionEyes'`
- `description`: `'Canadian Labour Congress executive dashboard and national analytics'` → `'Canadian Labour Congress continuity coordination and federation-safe institutional visibility'`
- inline H1 `defaultValue`: `'CLC Executive Dashboard'` → `'CLC Continuity Coordination'`

### Locale Bundles (en + en-CA, identical)
- `clcDashboard`: `"CLC Executive Dashboard"` → `"CLC Continuity Coordination"`
- `operational`: `"Operational Analytics"` → `"Operational Visibility"`
- `clc.executive.title`: `"CLC Executive Dashboard"` → `"CLC Continuity Coordination"`
- `staff.dashboard.executiveDashboard`: `"Executive Dashboard"` → `"Continuity Coordination"`
- `clc.dashboard.title`: `"CLC Executive Dashboard"` → `"CLC Continuity Coordination"`
- `clc.dashboard.description`: `"…national oversight, affiliate coordination, and per-capita remittance management"` → `"…national continuity coordination, affiliate coordination, and per-capita remittance stewardship"`

## Wave 4 Forbidden Vocabulary (15 terms, all `hard-fail`)

| Term | Category | Suggestion |
|---|---|---|
| executive dashboard | startup-saas | executive continuity coordination · governance visibility surface |
| operational review | surveillance-ai | continuity review · governance review of record |
| operational dashboard | startup-saas | continuity coordination surface · runtime visibility surface |
| operational analytics | surveillance-ai | continuity visibility (read-only) |
| executive insights | surveillance-ai | executive continuity context · governance visibility |
| executive analytics | surveillance-ai | executive continuity context (read-only) |
| organizational intelligence | surveillance-ai | institutional continuity context |
| organizational monitoring | surveillance-ai | institutional visibility (read-only, provenance-stamped) |
| performance management | surveillance-ai | stewardship of record · continuity review |
| management oversight | surveillance-ai | human oversight · reviewer-led oversight |
| management posture | surveillance-ai | stewardship posture |
| command and control | startup-saas | coexistence-safe coordination · federation-safe coordination |
| operational telemetry posture | surveillance-ai | runtime visibility posture (read-only) |
| enterprise control posture | startup-saas | stewardship-oriented administration · coexistence-safe administration |
| alert semantics | surveillance-ai | reviewer attention prompt (human-reviewed) |

## Procurement Risk Table

| Risk Vector | Wave 4 Impact | Mitigation |
|---|---|---|
| URL / route slug rename | None | All `href`/route segments untouched |
| Deep-link breakage | None | `/dashboard/workbench`, `/dashboard/clc`, `/dashboard/operations`, public `/trust#system-status` preserved |
| SEO regression | Low (intentional re-branding of CLC page title in metadata) | New title is more semantically accurate to federation context |
| Procurement preview text | Low (CLC description is more procurement-appropriate) | Stewardship language strengthens institutional positioning |
| API contract / schema | None | No schema, contract, or endpoint touched |
| Localization risk | None | en + en-CA updated symmetrically; fr/pt/it already institutional |
| Test fixture drift | Closed | `role-fixtures.ts` synchronized |

## Doctrine Checklist

- [x] Additive (no removal of stable hrefs/slugs/contracts/APIs)
- [x] Governance-safe (no scoring / no analytics / no automation / no alerting introduced)
- [x] Procurement-safe (no URL renames; all deep-links preserved)
- [x] Runtime-stable (zero schema mutation; zero routing change)
- [x] Protected fencing preserved (no admin/governance gating weakened)
- [x] Wave 4 forbidden-vocab block registered (15 hard-fail terms, dual category)
- [x] Locale parity preserved (en + en-CA symmetric)
- [x] Self-violation discipline: re-ran narrative gate, closed every self-trip before sign-off
- [x] No new orchestration / observability semantics introduced
- [x] No organizational-monitoring posture introduced
