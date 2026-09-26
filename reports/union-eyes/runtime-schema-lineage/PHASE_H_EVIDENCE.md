# Phase H Evidence — Pilot & Production Readiness Disposition

Generated: 2026-09-23T19:43:44Z (UTC) · Consumer TZ America/Toronto (ET)

**Scope:** evidence only. No merge, no production touch, no schema redesign.

| Field | Value |
|---|---|
| Repo / PR | anungis437/nzila-os #797 |
| Head | `72c1125190b790a5b6f43def739f846cf1cdb726` |
| Branch | `workstream/ue-runtime-schema-lineage-restoration` |
| Worktree | `C:\APPS\nzila-ue-runtime-schema-lineage` |
| Staging ACA | `nzila-os-union-eyes-staging--0000259` |
| Snapshot | `staging-canonical-20260923T184938Z-92611387` |
| Digest | `926113873e8b545a1ae3017e43c303a4d51daabd86b9f530398df8f62a789db7` |
| PRODUCTION_TOUCHED | NO |
| Merge | **DO_NOT_MERGE** (`mergeable_state=unstable`) |

## Accepted baseline (trusted)

FRESH_CANONICAL_STAGING=PASS · PHASE_G_DEPLOYED_RUNTIME_AUTHORITY=PASS · READY_FOR_POST_G_RELEASE_DISPOSITION=YES · 332 tables · RLS 1697/1697 · CANONICAL_SNAPSHOT_LIFECYCLE=PASS · SNAPSHOT_IMMUTABILITY=**PARTIAL**

Citations: `PHASE_G_STATUS.json`, `CANONICAL_SNAPSHOT_LIFECYCLE.json`, `DISPATCH_STATUS.json`.

## A. PR #797 checks

- Check runs on head: **85** (60 success / 14 failure / 10 skipped / 1 in_progress at collection).
- **Attributable to this PR:** `branch-policy` (`workstream/*`), `Security Design Review Required` (needs `security-design-reviewed`).
- **All other red checks:** `PRE_EXISTING_MAINLINE_DEBT` vs main `ff989637` (per parent steering; not re-derived).
- **Disposition:** DO_NOT_MERGE.

## B. Authentication lanes (corrected framing)

| Lane | Mechanism | Status |
|---|---|---|
| **PRIMARY_AUTHENTICATION** | PG password/session (`nzila_session`); magic-link alternate | **NOT_YET_PROVEN** |
| **BACKUP_ENTRA_AUTHENTICATION** | Entra External ID / NextAuth azure-ad | **NOT_YET_PROVEN** (backup only; **not** pilot login blocker) |
| **ACCEPTANCE_AUTH** | `x-unioneyes-acceptance-auth` | **PASS** (Phase G) |
| **INFRA_OIDC** | GitHub OIDC → Azure RBAC (deploy/snapshot) | **PARTIAL_PASS** (not SaaS login) |
| IDENTITY / ORG / ROLE resolution | shared boundary after `auth()` | LIMITATION_CODE_PATH_ONLY |
| SHARED_AUTHORITY_BOUNDARY | acceptance + PG + Entra → org → role → withRLSContext | **PASS_BY_CODE_INSPECTION** |

**Primary (CODE_CONFIRMED):** `@nzila/platform-auth/password` + cookie `nzila_session`. LoginForm default `mode=password` → `POST /api/auth/login`.

**Backup SSO:** `/api/auth/signin/azure-ad` (Entra). Do not conflate with INFRA_OIDC.

**Shared boundary (code-path proof, not interactive primary login):**
1. `auth()` → acceptance | **PG session (primary)** | Entra JWT (backup)
2. `getOrganizationIdForUser` / org fallbacks
3. Role from `organizationMembers.role`
4. `withRLSContext` → `auth()` then `set_config('app.current_user_id'|'app.current_org_id')`

**PILOT_BLOCKER (corrected):** `PRIMARY_AUTHENTICATION_NOT_PROVEN` — **not** Entra.

Limitation: interactive PG password login on staging **not** exercised with real credentials → do not inflate to PASS. See `PHASE_H_AUTH_PATH_CORRECTION.md`.


## C. Isolation gaps (consume Phase G)

| Control | Status | Citation |
|---|---|---|
| CROSS_ORG_ISOLATION | PASS | Phase G cross-org grievance/document 404 |
| SAME_ROLE_UNAUTHORIZED_ACCESS | PASS | MEMBER → admin orgs 403 |
| MATTER_AUTHORITY | PASS | grievance list/get + cross-org 404 |
| DOCUMENT_AUTHORITY | PASS | DOC_A 200 / DOC_B 404 on repository route |
| EXTERNAL_SPECIALIST_BOUNDARY | **PARTIAL** | org_current 200 only; deny matrix thin |
| RLS_CONTEXT_LEAKAGE | PASS | leakage=0 on exercised surfaces |

## D. LIUNA demo surface

Docs under `docs/categories/products-and-market/union-eyes/liuna-opdc-cecof-readiness/` + e2e `liuna-bilingual-mobile-transition.spec.ts`. Phase G pilot smoke PASS for authority flows; bilingual/mobile/a11y **not re-certified** in Phase H. DEMO_FLOWS=`PASS_WITH_LIMITATIONS`.

## E. Security debt

| Gate | Status | Demo | Pilot | Prod |
|---|---|---|---|---|
| CODEQL | PASS | ok | ok | ok |
| SECRET_SCANNING | PASS | ok | ok | ok |
| DEPENDENCY_VULNERABILITIES | FAIL preexisting | soft | **block** | **block** |
| CONTAINER_CVES | FAIL preexisting (baseline Trivy) | soft | caution | **block** |
| EXPIRED_WAIVERS | FAIL preexisting | soft | **block** | **block** |
| SUPPLY_CHAIN_GATE | FAIL preexisting | soft | **block** | **block** |
| GOVERNANCE_GATE | FAIL preexisting | soft | **block** | **block** |
| SNYK | UNKNOWN (not named on PR checks) | — | — | — |

## F. Ops / snapshot immutability

SNAPSHOT_IMMUTABILITY=**PARTIAL** (no object WORM; versioning + 30d soft-delete + sha256 compensating).

| Audience | Compensating controls enough? |
|---|---|
| Demo | YES |
| Pilot | MARGINAL (govern snapshot account access) |
| Production | NO |

Health probes PASS on staging. SLO/alerting thin. Restore to disposable PG15 PASS. Deployment provenance for 0000259 recorded.

## G. PostgreSQL majors

| Surface | Major |
|---|---|
| Staging | **15** |
| Snapshot restore proof | **15** |
| Cleanroom / most CI workflows | **16** (some 17) |
| Target production (docs) | **conflict 15 vs 16** |

CI_ALIGNED_TO_15=**false**.

## H. Snapshot E2E

`db:restore` **exists**. CI wiring of snapshot id + Playwright **NOT_FOUND**.

SNAPSHOT_BOOTSTRAP / APPLICATION_START / PLAYWRIGHT_E2E = **NOT_RUN**.

## I. Data lifecycle

| Control | Class |
|---|---|
| AUDIT_RETENTION | operationally_governed |
| BUSINESS_DATA_RETENTION | documented_only |
| USER_OFFBOARDING | documented_only |
| ORG_OFFBOARDING | documented_only |
| DATA_EXPORT | documented_only |
| DATA_DELETION | documented_only |
| BACKUP_RETENTION | operationally_governed |
| SNAPSHOT_RETENTION | operationally_governed |

## J. Pilot envelope (max evidence-justified)

- **Orgs:** 1
- **Users:** officer, member, steward (exclude external_specialist until deny proofs)
- **Features:** org context, grievance R, granted document R, billing-cycle R, health
- **Data:** synthetic/staging preferred
- **Duration:** <= 2 weeks on staging tip lineage
- **Support:** engineering on-call; rollback via ACA revision + known snapshot
- **Not:** production, multi-org federation, WORM-required retention claims

## Summary

| Question | Answer |
|---|---|
| Closed demo on staging? | **CONDITIONAL_YES** |
| External pilot? | **NO** |
| Production? | **NO** |
| Merge #797? | **DO_NOT_MERGE** |

Machine-readable twin: `PHASE_H_EVIDENCE.json`. Disposition: `PHASE_H_DISPOSITION.md`.
