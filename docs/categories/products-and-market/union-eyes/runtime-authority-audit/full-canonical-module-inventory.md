# Full Canonical Module Inventory

The 89 top-level sections under `apps/union-eyes/app/[locale]/dashboard/`,
classified by canonical role and verdict. Sections with `LegacyRedirect` shims
are flagged `retire`; sections that hard-overlap with a canonical sibling are
flagged `merge`. Everything else is provisionally `keep` pending Wave 2 stakeholder mapping.

## Canonical platform pillars (keep)

| Section | Canonical purpose | Continuity role |
| ------- | ----------------- | --------------- |
| `inbox` | Unified intake (claims + messages) | Front door for case work |
| `work` | Active grievance / case workbench | Replaces legacy `grievances` |
| `priorities` | Actionable upcoming deadlines | Replaces legacy `deadlines` |
| `intelligence` | Analytics + federation + executive | Replaces `executive`, `insights` |
| `cognition` | Reasoning + memory queries | Sovereign cognition layer |
| `governance` | Charter, motions, decisions of record | Governance-of-record |
| `governance-center`, `governance-culture`, `governance-recommendations` | Governance subsurfaces | merge candidates → Wave 2 |
| `institutional-memory` | Doctrine + cases + precedents archive | Continuity layer |
| `institutional-intelligence` / `institutional-operating-intelligence` | Operating intelligence | possibly merge → Wave 2 |
| `executive-operating-intelligence` | Executive operating view | possibly merge → Wave 2 |

## Operational modules (keep, gate by tier)

`admin`, `admin/dues`, `admin/rewards`, `admin/scheduled-reports`,
`analytics`, `analytics-admin`, `audits`, `bargaining`, `billing-admin`,
`calendar`, `cases`, `clause-library`, `clc`, `committees`,
`communications`, `compliance`, `compliance-admin`, `content`,
`continuity-intelligence`, `continuity-planning`, `continuity-simulation`,
`correspondence`, `cross-union-analytics`, `customer-success`, `data-source`,
`dispatch`, `documents`, `dues`, `education`, `elections`, `employer-execution`,
`federation`, `finance`, `financial`, `health-safety`, `integrations`,
`knowledge`, `knowledge-base`, `knowledge-transfer`, `leadership`,
`longitudinal-cognition`, `member`, `members`, `movement-insights`,
`notifications`, `operations`, `ops`, `organizer`, `organizing`,
`outcomes`, `pay`, `pension`, `pilot`, `precedents`, `profile`,
`reports`, `rewards`, `sector-analytics`, `security`, `settings`,
`stewards`, `strike-fund`, `structure`, `support`, `targets`, `trust`,
`voting`, `workbench`.

## Confirmed retire (6 sections — soft-redirect shims)

| Section | Redirect target |
| ------- | --------------- |
| `claims` | `/dashboard/inbox?filter=intake` |
| `deadlines` | `/dashboard/priorities` |
| `executive` | `/dashboard/intelligence?tab=executive` |
| `grievances` | `/dashboard/work` |
| `insights` | `/dashboard/intelligence?tab=federation` |
| `messages` | `/dashboard/inbox?filter=messages` |

These remain in the tree as a migration grace-window. Eligibility for deletion
is governed by `full-legacy-surface-elimination.md`.

## Likely merge candidates (Wave 2 to confirm)

- `analytics` ⇄ `analytics-admin` ⇄ `cross-union-analytics` ⇄ `sector-analytics`
- `compliance` ⇄ `compliance-admin`
- `finance` ⇄ `financial` ⇄ `billing-admin`
- `governance` ⇄ `governance-center` ⇄ `governance-culture` ⇄ `governance-recommendations`
- `institutional-intelligence` ⇄ `institutional-operating-intelligence`
   ⇄ `executive-operating-intelligence` ⇄ `intelligence`
- `member` ⇄ `members`
- `knowledge` ⇄ `knowledge-base` ⇄ `knowledge-transfer`
- `operations` ⇄ `ops`
- `organizer` ⇄ `organizing`

## Mandatory sections checklist

- [x] Canonical pillars
- [x] Operational modules
- [x] Retire list
- [x] Merge candidates
