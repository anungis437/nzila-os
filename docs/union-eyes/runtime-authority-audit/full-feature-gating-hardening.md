# Full Feature Gating Hardening

## Current posture (scan)

| Signal | Files | Coverage |
| ------ | ----- | -------- |
| `requireUser` (authentication) | 124 | broad — all dashboard pages effectively gated |
| `isEntitled` | 0 | not used in `apps/union-eyes` |
| `requireRole` / `hasRole` | 0 | not used in `apps/union-eyes` |
| `ModuleGate` / `commercial_reporting` / `sovereignty_layer` | 20 | partial — concentrated in admin + intelligence surfaces |

## Posture analysis

- **Authentication is universal.** Every protected route hits `requireUser`,
  which is the project-standard PG-session-first / Entra-fallback resolver
  delegated through `@nzila/platform-auth`.
- **Authorisation is delegated** to `ModuleGate` plus org-membership checks
  performed inside data-access utilities. Direct role gates (`requireRole`,
  `hasRole`) are intentionally absent in app code — role lookups should always
  go through `getOrganizationIdForUser(userId)` first (see user memory).
- **Tier gating is sparse.** Only ~20 files reference module-level gating.
  Sections like `executive`, `executive-operating-intelligence`,
  `cross-union-analytics`, `clc/*`, and `pension/trustee` are reachable by any
  authenticated user — they should require an explicit ModuleGate.

## Gating gap candidates (prioritised)

Pages that should require an explicit `ModuleGate` (or equivalent) but
currently rely only on `requireUser`. Based on canonical-module
classification — to be verified per-route in Wave 2.

| Section | Required gate |
| ------- | ------------- |
| `admin/*` | platform-admin role |
| `analytics-admin`, `billing-admin`, `compliance-admin` | tenant-admin role |
| `clc/*` | CLC affiliate membership |
| `cross-union-analytics`, `sector-analytics` | federation tier |
| `executive`, `executive-operating-intelligence`, `intelligence` (executive tab) | executive tier |
| `pension/trustee`, `pension/admin` | trustee role |
| `strike-fund/*` | treasurer role |
| `employer-execution/*` | employer-services tier |
| `debug/*` | platform-admin role |

## Hardening plan (Wave 2)

1. Audit each section above against existing `ModuleGate` definitions.
2. For sections lacking a gate, add server-side guard in `page.tsx` using the
   project-standard `getOrganizationIdForUser` + entitlement check.
3. Add corresponding deny-test in `apps/union-eyes/e2e/`.

## Mandatory sections checklist

- [x] Posture metrics
- [x] Posture analysis
- [x] Gap candidates table
- [x] Hardening plan
